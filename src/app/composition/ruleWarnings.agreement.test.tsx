import 'fake-indexeddb/auto'
import {
  DeploymentId,
  AccessGrantId,
  AvailabilityRuleId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  RoleId,
  RuleEnforcement,
  SoldierAccountId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AvailabilityRule,
  type CalendarDate,
  type CreateAvailabilityRuleInput,
  type Leave,
  type Result,
  type RuleViolation,
  type Timestamp,
} from '@contracts'
import { loadLocalData, type IdentityStore } from '@data'
import {
  LogicProvider,
  acknowledgedRuleIds,
  editedLeaveCandidate,
  leaveEditValues,
  newSheetRow,
  sheetCandidates,
  useLeaveRuleCheck,
  type LeaveCandidate,
  type LogicPorts,
} from '@logic'
import { useQueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

// OI-100: a live warning (D-142, D-162) says what the command answers. The warning is the real hook over the real
// repositories; the answer is the real local adapter's, on the same stored world. `app` is the one layer that may
// import both `data` and `logic` (.dependency-cruiser.cjs), so the test lives here. Sample data, test files only.

const NOW: Timestamp = '2026-11-08T10:00:00.000Z'
const D1: CalendarDate = '2026-11-09'
const D2: CalendarDate = '2026-11-10'
const D5: CalendarDate = '2026-11-13'
const D6: CalendarDate = '2026-11-14'
const D8: CalendarDate = '2026-11-16'
const D10: CalendarDate = '2026-11-18'
const D11: CalendarDate = '2026-11-19'

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${JSON.stringify(result.error)}`)
  return result.value
}

function memoryStore(): IdentityStore {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    subscribe: () => () => undefined,
  }
}

const QUIET_SHELL = { updateReady: false, install: 'none' } as const

/** A fresh database, an owner signed in and an organization claimed. */
async function ownerPorts(): Promise<LogicPorts> {
  const time = { now: () => NOW }
  const { createLocalAuthProvider, createLocalDataAdapter } = await loadLocalData()
  const auth = createLocalAuthProvider(memoryStore())
  const id = crypto.randomUUID()
  const data = createLocalDataAdapter({ identity: auth, time }, { database: `agreement-${id}`, channel: `agreement-${id}` })
  valueOf(await auth.signInAs({ email: 'owner@example.test', display_name: null }))
  valueOf(
    await data.commands.organizations.bootstrapOwner({
      organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Battalion', timezone: 'Asia/Jerusalem' },
      soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      root_unit_id: UnitId.parse(crypto.randomUUID()),
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
    }),
  )
  const shell = { subscribe: () => () => undefined, current: () => QUIET_SHELL, applyUpdate: () => undefined, install: () => Promise.resolve() }
  // The agreement reads no convenience of the device (D-197).
  const nothingKept = { read: () => null, write: () => undefined }
  return { auth, data, time, shell, device: { local: nothingKept, session: nothingKept } }
}

interface World {
  readonly ports: LogicPorts
  readonly type: LeaveTypeId
  readonly rotation: DeploymentId
  readonly soft: AvailabilityRule
  readonly hard: AvailabilityRule
  readonly soldiers: Record<'a1' | 'a2' | 'a3' | 'b1' | 'b2', SoldierId>
  readonly leaves: Record<'a1Away' | 'a3Later' | 'b1Away', Leave>
}

/**
 * A company with platoons A (three soldiers) and B (two). Soft: at least 4 available in the company. Hard: at least 1
 * available in platoon B. Stored: A1 away D1–D2 (the company at its limit), A3 pending D10–D11, B1 away D8.
 */
async function buildWorld(): Promise<World> {
  const ports = await ownerPorts()
  const { commands } = ports.data
  const unit = async (name: string, parent_id: UnitId) =>
    valueOf(
      await commands.units.create({
        id: UnitId.parse(crypto.randomUUID()),
        parent_id,
        sort_order: 0,
        name,
        code: null,
        unit_level_id: null,
        kind: 'standing',
        valid_from: null,
        valid_to: null,
        color_key: null,
        properties: {},
      }),
    ).id
  // The company hangs under the root unit the claim created (D-251), which holds the owner: the rules count the company.
  const root = valueOf(await ports.data.repositories.units.list({ include_archived: false })).find(
    (row) => row.parent_id === null,
  )?.id
  if (root === undefined) throw new Error('no root unit')
  const company = await unit('Company', root)
  const platoonA = await unit('Platoon A', company)
  const platoonB = await unit('Platoon B', company)
  const soldier = async (first_name: string, unit_id: UnitId) =>
    valueOf(
      await commands.soldiers.create({
        id: SoldierId.parse(crypto.randomUUID()),
        first_name,
        last_name: 'Bar',
        nickname: null,
        command_rank_id: null,
        status: 'active',
        properties: {},
        private: null,
        membership: { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id, valid_from: '2026-11-01' },
      }),
    ).id
  const soldiers = {
    a1: await soldier('Adi', platoonA),
    a2: await soldier('Avi', platoonA),
    a3: await soldier('Alon', platoonA),
    b1: await soldier('Ben', platoonB),
    b2: await soldier('Bat', platoonB),
  }
  const type = valueOf(
    await commands.leave_types.create({
      id: LeaveTypeId.parse(crypto.randomUUID()),
      group_id: null,
      name: 'Home',
      color_key: 'teal',
      icon_key: null,
      availability_effect: 'unavailable',
      requires_reason: false,
      sort_order: 0,
    }),
  ).id
  const rule = async (input: Pick<CreateAvailabilityRuleInput, 'name' | 'enforcement' | 'scope_unit_id' | 'min_value'>) =>
    valueOf(
      await commands.availability_rules.create({
        id: AvailabilityRuleId.parse(crypto.randomUUID()),
        description: null,
        is_enabled: true,
        priority: 0,
        scope_mode: 'unit_tree',
        scope_level_id: null,
        population_filter: {},
        group_by: 'none',
        group_tag_category_id: null,
        metric: 'count',
        max_value: null,
        effective_from: null,
        effective_to: null,
        deployment_id: null,
        count_pending_as_unavailable: true,
        ...input,
      }),
    )
  // The rotation every request belongs to (D-216): all five soldiers, for the company.
  const rotation = valueOf(
    await commands.deployments.create({ id: DeploymentId.parse(crypto.randomUUID()), name: 'Rotation', unit_id: company, start_date: '2026-11-01', end_date: null }),
  )
  valueOf(
    await commands.deployments.setMembers({
      deployment_id: rotation.id,
      expected_version: rotation.version,
      members: Object.values(soldiers).map((soldier_id) => ({ soldier_id, start_date: null, end_date: null })),
    }),
  )
  const soft = await rule({ name: 'Company keeps four', enforcement: RuleEnforcement.enum.soft, scope_unit_id: company, min_value: 4 })
  const hard = await rule({ name: 'Platoon B keeps one', enforcement: RuleEnforcement.enum.hard, scope_unit_id: platoonB, min_value: 1 })
  const store = async (soldier_id: SoldierId, start_date: CalendarDate, end_date: CalendarDate, as_approved: boolean) =>
    valueOf(await commands.leaves.create(createInput({ soldier_id, leave_type_id: type, start_date, end_date, as_approved }, rotation.id)))
  const leaves = {
    a1Away: await store(soldiers.a1, D1, D2, true),
    a3Later: await store(soldiers.a3, D10, D11, false),
    b1Away: await store(soldiers.b1, D8, D8, true),
  }
  return { ports, type, rotation: rotation.id, soft, hard, soldiers, leaves }
}

interface NewLeave {
  readonly soldier_id: SoldierId
  readonly leave_type_id: LeaveTypeId
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
  readonly as_approved: boolean
}

function createInput(leave: NewLeave, deployment_id: DeploymentId, acknowledged: readonly AvailabilityRuleId[] = []) {
  return {
    id: LeaveId.parse(crypto.randomUUID()),
    ...leave,
    deployment_id,
    availability_effect_override: null,
    reason: null,
    properties: {},
    acknowledged_rule_ids: [...acknowledged],
    comment: null,
  }
}

/**
 * The live warning, as a form shows it: the real hook under the real ports. Settled when every query the hook asked
 * has answered, the leaves of its span among them: they are asked only once the actor is known to read everything.
 */
async function warningOf(ports: LogicPorts, candidate: LeaveCandidate | readonly LeaveCandidate[] | null, stored: Leave | null = null) {
  const wrapper = ({ children }: { readonly children: ReactNode }) => <LogicProvider ports={ports}>{children}</LogicProvider>
  const { result, unmount } = renderHook(
    () => {
      const check = useLeaveRuleCheck(candidate, stored)
      const queries = useQueryClient().getQueryCache().getAll()
      const leavesAsked = queries.some((query) => query.queryKey.includes('leaves') && query.state.status === 'success')
      // A disabled query (the leaves of no span, before the span is known) stays pending without fetching.
      const settled = leavesAsked && queries.every((query) => query.state.status !== 'error' && query.state.fetchStatus === 'idle')
      return { check, settled }
    },
    { wrapper },
  )
  await waitFor(() => {
    expect(result.current.settled).toBe(true)
  })
  const { check } = result.current
  unmount()
  if (check.status !== 'ready') throw new Error(`the settled warning is ${check.status}`)
  return check.value
}

/** The same ports, with the leaves read through `list` instead. */
function withLeavesList(ports: LogicPorts, list: LogicPorts['data']['repositories']['leaves']['list']): LogicPorts {
  const { repositories } = ports.data
  return { ...ports, data: { ...ports.data, repositories: { ...repositories, leaves: { ...repositories.leaves, list } } } }
}

/** A promise and the hand that settles it. */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

const idsOf = (violations: readonly RuleViolation[]) => [...new Set(violations.map((violation) => violation.rule_id))].sort()
const ofEnforcement = (violations: readonly RuleViolation[], enforcement: RuleEnforcement) =>
  violations.filter((violation) => violation.enforcement === enforcement)

/**
 * The agreement of OI-100: no warning iff the command succeeds; a hard warning iff `rule_violation`, with the same hard
 * violations; a soft-only warning iff `rule_acknowledgment_required`, with the same violations. Then the acknowledged
 * warning is enough for the command.
 */
async function expectAgreement(
  warnings: readonly RuleViolation[],
  send: (acknowledged: readonly AvailabilityRuleId[]) => Promise<Result<unknown>>,
) {
  const answer = await send([])
  const hard = ofEnforcement(warnings, RuleEnforcement.enum.hard)
  if (warnings.length === 0) {
    expect(answer.ok).toBe(true)
    return answer
  }
  if (answer.ok) throw new Error(`warned ${JSON.stringify(idsOf(warnings))} but the command succeeded`)
  if (hard.length > 0) {
    expect(answer.error).toEqual({ code: 'rule_violation', violations: hard })
    return answer
  }
  expect(answer.error).toEqual({ code: 'rule_acknowledgment_required', violations: warnings })
  const acknowledged = await send(acknowledgedRuleIds(warnings))
  expect(acknowledged.ok).toBe(true)
  return acknowledged
}

describe('a live rule warning is the command’s answer (OI-100, D-142)', () => {
  let world: World

  beforeEach(async () => {
    world = await buildWorld()
  })

  /** The leaves a sheet of one soldier would create, as the form judges them (D-275). */
  const candidatesOf = (leave: Omit<NewLeave, 'leave_type_id' | 'start_date' | 'end_date'>, days: readonly (readonly [CalendarDate, CalendarDate])[]) =>
    sheetCandidates({
      soldier_id: leave.soldier_id,
      as_approved: leave.as_approved,
      rows: days.map(([start, end]) => ({ ...newSheetRow(start, end), leave_type_id: world.type })),
    }, () => ({ deployment_id: world.rotation, issues: [] }))

  /** The sheet's leaves, judged live and then sent as the form sends them: one `createMany`. */
  async function checkSheet(leave: Omit<NewLeave, 'leave_type_id' | 'start_date' | 'end_date'>, days: readonly (readonly [CalendarDate, CalendarDate])[]) {
    const warnings = await warningOf(world.ports, candidatesOf(leave, days))
    await expectAgreement(warnings, (acknowledged) =>
      world.ports.data.commands.leaves.createMany({
        soldier_id: leave.soldier_id,
        as_approved: leave.as_approved,
        acknowledged_rule_ids: [...acknowledged],
        leaves: days.map(([start_date, end_date]) => ({
          id: LeaveId.parse(crypto.randomUUID()),
          deployment_id: world.rotation,
          leave_type_id: world.type,
          start_date,
          end_date,
          availability_effect_override: null,
          reason: null,
          properties: {},
        })),
      }),
    )
    return warnings
  }

  const checkCreate = ({ start_date, end_date, ...leave }: Omit<NewLeave, 'leave_type_id'>) => checkSheet(leave, [[start_date, end_date]])

  async function checkMove(stored: Leave, start_date: CalendarDate, end_date: CalendarDate) {
    const values = { ...leaveEditValues(stored), start_date, end_date }
    const warnings = await warningOf(world.ports, editedLeaveCandidate(stored, values, false), stored)
    await expectAgreement(warnings, (acknowledged) =>
      world.ports.data.commands.leaves.update({
        id: stored.id,
        expected_version: stored.version,
        changes: { start_date, end_date },
        acknowledged_rule_ids: [...acknowledged],
      }),
    )
    return warnings
  }

  it('a leave that breaks nothing: no warning, and the command stores it', async () => {
    const warnings = await checkCreate({ soldier_id: world.soldiers.b1, start_date: D5, end_date: D6, as_approved: false })
    expect(warnings).toEqual([])
  })

  it('a leave that breaks the soft rule: its warning is what the command asks to acknowledge', async () => {
    const warnings = await checkCreate({ soldier_id: world.soldiers.a2, start_date: D1, end_date: D1, as_approved: false })
    expect(idsOf(warnings)).toEqual([world.soft.id])
  })

  it('a leave that breaks the hard rule: its hard warning is the command’s refusal', async () => {
    const warnings = await checkCreate({ soldier_id: world.soldiers.b2, start_date: D8, end_date: D8, as_approved: true })
    // The company drops to three as well: the warning names both, the refusal the hard one.
    expect(idsOf(warnings)).toEqual([world.soft.id, world.hard.id].sort())
    expect(idsOf(ofEnforcement(warnings, RuleEnforcement.enum.hard))).toEqual([world.hard.id])
  })

  it('a sheet of several leaves: one warning over them all is what the one command answers (D-275)', async () => {
    const warnings = await checkSheet({ soldier_id: world.soldiers.a2, as_approved: false }, [
      [D5, D6],
      [D1, D1],
    ])
    expect(idsOf(warnings)).toEqual([world.soft.id])
  })

  it('an edit that moves a leave onto a full day: the warning judges it as the command does', async () => {
    const warnings = await checkMove(world.leaves.a3Later, D1, D2)
    expect(idsOf(warnings)).toEqual([world.soft.id])
  })

  it('an edit that moves a leave onto the day platoon B is down to one: refused as warned', async () => {
    const b2Later = valueOf(
      await world.ports.data.commands.leaves.create(
        createInput({ soldier_id: world.soldiers.b2, leave_type_id: world.type, start_date: D5, end_date: D5, as_approved: false }, world.rotation),
      ),
    )
    const warnings = await checkMove(b2Later, D8, D8)
    expect(idsOf(ofEnforcement(warnings, RuleEnforcement.enum.hard))).toEqual([world.hard.id])
  })

  it('an edit that moves a leave off a full day breaks nothing', async () => {
    const warnings = await checkMove(world.leaves.a1Away, D5, D6)
    expect(warnings).toEqual([])
  })
})

describe('a live rule warning says when it has no answer (OI-099)', () => {
  let world: World

  beforeEach(async () => {
    world = await buildWorld()
  })

  const candidateOn = (start_date: CalendarDate, end_date: CalendarDate) =>
    sheetCandidates({
      soldier_id: world.soldiers.a2,
      as_approved: false,
      rows: [{ ...newSheetRow(start_date, end_date), leave_type_id: world.type }],
    }, () => ({ deployment_id: world.rotation, issues: [] }))[0] ?? null

  function render(ports: LogicPorts, candidate: LeaveCandidate | null) {
    const wrapper = ({ children }: { readonly children: ReactNode }) => <LogicProvider ports={ports}>{children}</LogicProvider>
    return renderHook(({ changed }) => useLeaveRuleCheck(changed), { wrapper, initialProps: { changed: candidate } })
  }

  it('is loading, not "nothing broken", until the leaves are read', async () => {
    const leaves = world.ports.data.repositories.leaves
    const held = deferred<null>()
    const ports = withLeavesList(world.ports, async (query) => {
      await held.promise
      return leaves.list(query)
    })
    const { result, unmount } = render(ports, candidateOn(D1, D1))
    expect(result.current.status).toBe('loading')
    held.settle(null)
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    if (result.current.status === 'ready') expect(idsOf(result.current.value)).toEqual([world.soft.id])
    unmount()
  })

  it('fails when the leaves cannot be read', async () => {
    const ports = withLeavesList(world.ports, () => Promise.resolve({ ok: false, error: { code: 'unavailable' } }))
    const { result, unmount } = render(ports, candidateOn(D1, D1))
    await waitFor(() => {
      expect(result.current.status).toBe('failed')
    })
    unmount()
  })

  it('keeps its last answer while a new span is read', async () => {
    const leaves = world.ports.data.repositories.leaves
    let held: Promise<null> = Promise.resolve(null)
    const ports = withLeavesList(world.ports, async (query) => {
      await held
      return leaves.list(query)
    })
    const { result, rerender, unmount } = render(ports, candidateOn(D1, D1))
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    const answered = result.current
    const next = deferred<null>()
    held = next.promise
    rerender({ changed: candidateOn(D5, D6) })
    expect(result.current).toEqual(answered)
    next.settle(null)
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: [] })
    })
    unmount()
  })
})
