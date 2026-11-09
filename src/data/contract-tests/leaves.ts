import {
  AvailabilityRuleId,
  LeaveCommentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CreateLeaveInput,
  type CreateLeaveTypeInput,
  type CreateSoldierInput,
  type DataChange,
  type OrganizationId,
  type Permission,
  type RuleEnforcement,
  type TableRow,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, seedActor, valueOf } from './support'

// Leave types, their groups and creating a leave against the shared contract (D-113, D-114), with the rule gate
// tested on seeded rules long before the rules screen exists (D-076, OI-027). Sample data, test files only.

const TODAY = '2026-11-08'
const TOMORROW = '2026-11-09'
const LAST_WEEK = '2026-11-01'
const NEXT_WEEK = '2026-11-15'

const newTypeId = () => LeaveTypeId.parse(crypto.randomUUID())
const newGroupId = () => LeaveTypeGroupId.parse(crypto.randomUUID())
const newLeaveId = () => LeaveId.parse(crypto.randomUUID())
const newSoldierId = () => SoldierId.parse(crypto.randomUUID())
const newUnitId = () => UnitId.parse(crypto.randomUUID())

function typeInput(overrides: Partial<CreateLeaveTypeInput> = {}): CreateLeaveTypeInput {
  return {
    id: newTypeId(),
    group_id: null,
    name: 'Home',
    color_key: 'teal',
    icon_key: null,
    availability_effect: 'unavailable',
    requires_reason: false,
    sort_order: 0,
    ...overrides,
  }
}

const VIEW_TYPES: Permission = { resource: 'leave_types', action: 'view' }
const CREATE_TYPES: Permission = { resource: 'leave_types', action: 'create' }
const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const CREATE_LEAVES: Permission = { resource: 'leaves', action: 'create' }
const APPROVE_LEAVES: Permission = { resource: 'leaves', action: 'approve' }
const CREATE_COMMENTS: Permission = { resource: 'leave_comments', action: 'create' }

export function describeLeaveContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('leaves', () => {
    let organization: OrganizationId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    const actorWith = (pairs: readonly Permission[], scope: Parameters<typeof seedActor>[3], home?: UnitId) =>
      seedActor(harnessOf(), organization, pairs, scope, home)

    async function unit(name: string, parent_id: UnitId | null = null) {
      return valueOf(
        await adapter().commands.units.create({
          id: newUnitId(),
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
      )
    }

    async function soldier(unitId: UnitId | null, overrides: Partial<CreateSoldierInput> = {}) {
      return valueOf(
        await adapter().commands.soldiers.create({
          id: newSoldierId(),
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership:
            unitId === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unitId, valid_from: LAST_WEEK },
          ...overrides,
        }),
      )
    }

    const createType = async (overrides: Partial<CreateLeaveTypeInput> = {}) =>
      valueOf(await adapter().commands.leave_types.create(typeInput(overrides)))

    function leaveInput(soldier_id: SoldierId, leave_type_id: LeaveTypeId, overrides: Partial<CreateLeaveInput> = {}) {
      const input: CreateLeaveInput = {
        id: newLeaveId(),
        soldier_id,
        leave_type_id,
        start_date: TODAY,
        end_date: TOMORROW,
        availability_effect_override: null,
        reason: null,
        properties: {},
        as_approved: false,
        acknowledged_rule_ids: [],
        comment: null,
        ...overrides,
      }
      return input
    }

    describe('leave type groups and types (D-113)', () => {
      it('creates groups and types, in order, with the defaults of a new type (D-032)', async () => {
        const second = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'Courses', sort_order: 1 }))
        const first = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'Home', sort_order: 0 }))
        const groups = valueOf(await adapter().repositories.leave_type_groups.list({ include_archived: false }))
        expect(groups.map((group) => group.id)).toEqual([first.id, second.id])

        const type = await createType({ group_id: first.id, icon_key: 'home' })
        expect(type).toMatchObject({ availability_effect: 'unavailable', requires_reason: false, version: 1, created_by: ownerId })
        expect(valueOf(await adapter().repositories.leave_types.get(type.id))).toEqual(type)
      })

      it('checks the color and the icon against their closed lists (D-074, D-113)', async () => {
        const result = await adapter().commands.leave_types.create(typeInput({ color_key: 'magenta', icon_key: 'rocket' }))
        expect(issuesOf(result)).toEqual([
          { path: ['color_key'], code: 'invalid_value' },
          { path: ['icon_key'], code: 'invalid_value' },
        ])
        const type = await createType({ icon_key: 'exam' })
        const renamed = await adapter().commands.leave_types.update({ id: type.id, expected_version: 1, changes: { icon_key: 'x' } })
        expect(issuesOf(renamed)).toEqual([{ path: ['changes', 'icon_key'], code: 'invalid_value' }])
      })

      it('refuses a group that is unknown or archived, and leaves an unchanged archived one alone', async () => {
        expect(issuesOf(await adapter().commands.leave_types.create(typeInput({ group_id: newGroupId() })))).toEqual([
          { path: ['group_id'], code: 'reference_not_found' },
        ])
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const type = await createType({ group_id: group.id })
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        valueOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leave_types.create(typeInput({ group_id: group.id })))).toEqual([
          { path: ['group_id'], code: 'reference_archived' },
        ])
      })

      it('refuses to archive a group that holds a live type, and allows it once none does', async () => {
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const type = await createType({ group_id: group.id })
        expect(issuesOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'group_in_use' },
        ])
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(valueOf(await adapter().commands.leave_type_groups.archive({ id: group.id, expected_version: 1 })).archived_at).toBe(NOW)
      })

      it('reorders types inside their group only', async () => {
        const group = valueOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 }))
        const a = await createType({ group_id: group.id, name: 'A', sort_order: 0 })
        const b = await createType({ group_id: group.id, name: 'B', sort_order: 1 })
        const loose = await createType({ name: 'Loose' })
        const reordered = valueOf(
          await adapter().commands.leave_types.reorder({
            items: [
              { id: b.id, expected_version: 1 },
              { id: a.id, expected_version: 1 },
            ],
          }),
        )
        expect(reordered.map((type) => [type.name, type.sort_order])).toEqual([
          ['B', 0],
          ['A', 1],
        ])
        const mixed = await adapter().commands.leave_types.reorder({
          items: [
            { id: loose.id, expected_version: 1 },
            { id: a.id, expected_version: 2 },
          ],
        })
        expect(issuesOf(mixed)).toEqual([{ path: ['items'], code: 'invalid_order' }])
      })

      it('keeps types behind leave_types, at organization scope only (D-053)', async () => {
        const type = await createType()
        const { identity: nobody } = await actorWith([], { anchor_type: 'organization' })
        harnessOf().signIn(nobody)
        expect(valueOf(await adapter().repositories.leave_types.list({ include_archived: true }))).toEqual([])
        expect(errorOf(await adapter().repositories.leave_types.get(type.id)).code).toBe('not_found')

        harnessOf().signIn(owner)
        const { identity: viewer } = await actorWith([VIEW_TYPES], { anchor_type: 'organization' })
        harnessOf().signIn(viewer)
        expect(errorOf(await adapter().commands.leave_types.create(typeInput())).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.leave_type_groups.create({ id: newGroupId(), name: 'G', sort_order: 0 })).code).toBe(
          'forbidden',
        )

        harnessOf().signIn(owner)
        const platoon = await unit('Platoon')
        const { identity: local } = await actorWith([VIEW_TYPES, CREATE_TYPES], { anchor_type: 'unit', anchor_unit_id: platoon.id })
        harnessOf().signIn(local)
        expect(valueOf(await adapter().repositories.leave_types.get(type.id)).id).toBe(type.id)
        expect(errorOf(await adapter().commands.leave_types.create(typeInput())).code).toBe('forbidden')
      })
    })

    describe('creating a leave (D-063, D-114)', () => {
      it('is pending by default, writes its created event, and tells the feed', async () => {
        const type = await createType()
        const platoon = await unit('Platoon')
        const yael = await soldier(platoon.id)
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: '   ' })))
        expect(leave).toMatchObject({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          reason: null,
          batch_id: null,
          version: 1,
          created_by: ownerId,
        })
        expect((await heard).map((change) => change.table).sort()).toEqual(['leave_events', 'leaves'])
        const events = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(events).toMatchObject([
          { event_type: 'created', from_status: null, to_status: 'pending', actor_id: ownerId, acknowledged_rule_ids: [], changes: {} },
        ])
      })

      it('is approved in one step by who may approve, with the actor as reviewer (D-013)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { as_approved: true })))
        expect(leave).toMatchObject({ status: 'approved', reviewed_by: ownerId, reviewed_at: NOW })
        const [event] = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(event?.to_status).toBe('approved')
      })

      it('asks for a reason when the type requires one (D-064)', async () => {
        const type = await createType({ requires_reason: true })
        const yael = await soldier(null)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: ' ' })))).toEqual([
          { path: ['reason'], code: 'reason_required' },
        ])
        expect(valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { reason: 'Wedding' }))).reason).toBe('Wedding')
      })

      it('refuses a type that is unknown or archived, and an archived soldier', async () => {
        const yael = await soldier(null)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, newTypeId())))).toEqual([
          { path: ['leave_type_id'], code: 'reference_not_found' },
        ])
        const type = await createType()
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['leave_type_id'], code: 'reference_archived' },
        ])
        const live = await createType()
        valueOf(await adapter().commands.soldiers.archive({ id: yael.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, live.id)))).toEqual([
          { path: ['soldier_id'], code: 'archived' },
        ])
        expect(await harnessOf().rows('leaves')).toEqual([])
      })

      it('keeps showing a leave whose type was archived later (D-113)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        expect(valueOf(await adapter().repositories.leaves.get(leave.id)).leave_type_id).toBe(type.id)
      })

      it('answers field codes from the schema, and an id that is taken (D-044, D-068)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const inverted = await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: TOMORROW, end_date: TODAY }))
        expect(issuesOf(inverted)).toEqual([{ path: ['end_date'], code: 'range_inverted' }])
        const first = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { id: first.id })))).toEqual([
          { path: ['id'], code: 'already_exists' },
        ])
      })

      it('writes a comment with its leave, for who may write one (D-063)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const comment = { id: LeaveCommentId.parse(crypto.randomUUID()), body: 'Family event', visibility: 'shared' as const }
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment })))
        expect(await harnessOf().rows('leave_comments')).toMatchObject([{ id: comment.id, author_id: ownerId, body: 'Family event' }])
      })
    })

    describe('permissions of a leave (D-114)', () => {
      async function platoons() {
        const company = await unit('Company')
        return { platoonA: await unit('Platoon A', company.id), platoonB: await unit('Platoon B', company.id) }
      }

      it('needs leaves:create over the soldier, and leaves:approve to approve now', async () => {
        const type = await createType()
        const { platoonA, platoonB } = await platoons()
        const inA = await soldier(platoonA.id)
        const inB = await soldier(platoonB.id)
        const { identity } = await actorWith(
          [VIEW_SOLDIERS, VIEW_LEAVES, CREATE_LEAVES, VIEW_TYPES],
          { anchor_type: 'unit', anchor_unit_id: platoonA.id },
        )
        harnessOf().signIn(identity)
        valueOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id)))
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id, { as_approved: true }))).code).toBe(
          'forbidden',
        )
        // A soldier the actor cannot see answers not_found, not forbidden (D-046).
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(inB.id, type.id))).code).toBe('not_found')
        expect((await harnessOf().rows('leaves')).length).toBe(1)
      })

      it('answers forbidden to who sees the soldier but may not create a leave, before the state of the type', async () => {
        const type = await createType()
        valueOf(await adapter().commands.leave_types.archive({ id: type.id, expected_version: 1 }))
        const yael = await soldier(null)
        const { identity } = await actorWith([VIEW_SOLDIERS, VIEW_TYPES], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id))).code).toBe('forbidden')
      })

      it('approves in one step with both pairs', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const { identity, soldierId } = await actorWith(
          [VIEW_SOLDIERS, CREATE_LEAVES, APPROVE_LEAVES, VIEW_TYPES],
          { anchor_type: 'organization' },
        )
        harnessOf().signIn(identity)
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { as_approved: true })))
        expect(leave).toMatchObject({ status: 'approved', reviewed_by: soldierId })
      })

      it('needs the comment pair to write a comment, and then writes nothing', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const pairs = [VIEW_SOLDIERS, CREATE_LEAVES, VIEW_TYPES]
        const { identity } = await actorWith(pairs, { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        const comment = { id: LeaveCommentId.parse(crypto.randomUUID()), body: 'Note', visibility: 'shared' as const }
        expect(errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment }))).code).toBe('forbidden')
        expect(await harnessOf().rows('leaves')).toEqual([])

        harnessOf().signIn(owner)
        const { identity: writer } = await actorWith([...pairs, CREATE_COMMENTS], { anchor_type: 'organization' })
        harnessOf().signIn(writer)
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { comment })))
      })

      it('needs leave_types:view to point at a type (D-046)', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const { identity } = await actorWith([VIEW_SOLDIERS, CREATE_LEAVES], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(issuesOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))).toEqual([
          { path: ['leave_type_id'], code: 'reference_not_found' },
        ])
      })
    })

    describe('reading leaves', () => {
      it('lists the leaves that overlap the window, by soldier and status', async () => {
        const type = await createType()
        const yael = await soldier(null)
        const dan = await soldier(null, { first_name: 'Dan' })
        const before = valueOf(
          await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: LAST_WEEK, end_date: LAST_WEEK })),
        )
        const across = valueOf(
          await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { start_date: LAST_WEEK, end_date: TODAY })),
        )
        const approved = valueOf(
          await adapter().commands.leaves.create(leaveInput(dan.id, type.id, { start_date: NEXT_WEEK, end_date: NEXT_WEEK, as_approved: true })),
        )
        const window = { start_date: TODAY, end_date: NEXT_WEEK }
        const all = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: null }))
        expect(all.map((leave) => leave.id)).toEqual([across.id, approved.id])
        const onlyApproved = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: ['approved'] }))
        expect(onlyApproved.map((leave) => leave.id)).toEqual([approved.id])
        const ofYael = valueOf(
          await adapter().repositories.leaves.list({ window: { start_date: LAST_WEEK, end_date: NEXT_WEEK }, soldier_ids: [yael.id], statuses: null }),
        )
        expect(ofYael.map((leave) => leave.id).sort()).toEqual([before.id, across.id].sort())
      })

      it('shows a leave and its events only with leaves:view over its soldier (D-046)', async () => {
        const type = await createType()
        const platoonA = await unit('Platoon A')
        const platoonB = await unit('Platoon B')
        const inA = await soldier(platoonA.id)
        const inB = await soldier(platoonB.id)
        const seen = valueOf(await adapter().commands.leaves.create(leaveInput(inA.id, type.id)))
        const hidden = valueOf(await adapter().commands.leaves.create(leaveInput(inB.id, type.id)))
        const { identity } = await actorWith([VIEW_LEAVES], { anchor_type: 'unit', anchor_unit_id: platoonA.id })
        harnessOf().signIn(identity)
        const window = { start_date: TODAY, end_date: TOMORROW }
        const listed = valueOf(await adapter().repositories.leaves.list({ window, soldier_ids: null, statuses: null }))
        expect(listed.map((leave) => leave.id)).toEqual([seen.id])
        expect(errorOf(await adapter().repositories.leaves.get(hidden.id)).code).toBe('not_found')
        expect(errorOf(await adapter().repositories.leave_events.list({ leave_id: hidden.id })).code).toBe('not_found')
        expect(valueOf(await adapter().repositories.leave_events.list({ leave_id: seen.id }))).toHaveLength(1)
      })
    })

    describe('the rule gate (D-047, D-073, OI-027)', () => {
      /** "At least one available in the organization", counting pending leaves. */
      async function seedRule(enforcement: RuleEnforcement) {
        const id = AvailabilityRuleId.parse(crypto.randomUUID())
        const rule: TableRow<'availability_rules'> = {
          id,
          organization_id: organization,
          name: 'Keep one',
          description: null,
          is_enabled: true,
          priority: 0,
          enforcement,
          scope_unit_id: null,
          scope_mode: 'unit_tree',
          scope_level_id: null,
          population_filter: {},
          group_by: 'none',
          group_tag_category_id: null,
          metric: 'count',
          min_value: 1,
          max_value: null,
          effective_from: null,
          effective_to: null,
          deployment_id: null,
          count_pending_as_unavailable: true,
          created_at: NOW,
          created_by: null,
          updated_at: NOW,
          updated_by: null,
          version: 1,
          archived_at: null,
        }
        await harnessOf().seed('availability_rules', [rule])
        return id
      }

      async function lastSoldierStanding() {
        const type = await createType()
        const platoon = await unit('Platoon')
        return { type, yael: await soldier(platoon.id) }
      }

      it('refuses what breaks a hard rule, and writes nothing', async () => {
        const { type, yael } = await lastSoldierStanding()
        const ruleId = await seedRule('hard')
        const refused = errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { acknowledged_rule_ids: [ruleId] })))
        expect(refused).toMatchObject({ code: 'rule_violation', violations: [{ rule_id: ruleId, enforcement: 'hard', bound: 'min' }] })
        expect(await harnessOf().rows('leaves')).toEqual([])
        expect(await harnessOf().rows('leave_events')).toEqual([])
      })

      it('asks to acknowledge a soft rule, then stores the acknowledgment in the event', async () => {
        const { type, yael } = await lastSoldierStanding()
        const ruleId = await seedRule('soft')
        const asked = errorOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id)))
        expect(asked).toMatchObject({
          code: 'rule_acknowledgment_required',
          violations: [{ rule_id: ruleId, days: [{ date: TODAY, required: 1, actual: 0 }, { date: TOMORROW, required: 1, actual: 0 }] }],
        })
        const leave = valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, type.id, { acknowledged_rule_ids: [ruleId] })))
        const [event] = valueOf(await adapter().repositories.leave_events.list({ leave_id: leave.id }))
        expect(event?.acknowledged_rule_ids).toEqual([ruleId])
      })

      it('lets a marker through, because the soldier stays available (D-032)', async () => {
        const { yael } = await lastSoldierStanding()
        await seedRule('hard')
        const marker = await createType({ availability_effect: 'available' })
        valueOf(await adapter().commands.leaves.create(leaveInput(yael.id, marker.id)))
      })
    })
  })
}
