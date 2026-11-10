import {
  AvailabilityRuleId,
  LeaveCommentId,
  LeaveEventId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  type Leave,
  type LeaveComment,
  type LeaveEvent,
  type LeaveQuery,
  type PermissionCheck,
  type Result,
  type SoldierPreferencesRecord,
} from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanAnswers } from '../permissions/hooks'
import type { LogicPorts } from '../ports'
import { allowEverything, fakePorts, wrapperOf } from '../testing/ports'
import { useMyPreferences, useUpdateMyPreferences } from '../session/preferences'
import type { DateWindow } from '../view-state/window'
import { newLeaveValues } from './forms'
import { useLeaves } from './hooks'
import {
  closedLeaves,
  editReturnsToPending,
  editedLeaveCandidate,
  isEditable,
  leaveAfterStep,
  leaveDayCount,
  leaveEditChanges,
  leaveEditIssues,
  leaveEditValues,
  leaveSteps,
  leaveThread,
  pendingRequests,
  toTransitionInput,
} from './workflow'
import { useEditLeave, useLeave, useLeaveTransition, usePendingRequests } from './workflowHooks'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const YAEL = SoldierId.parse(uuid(1))
const DAN = SoldierId.parse(uuid(2))
const TYPE = LeaveTypeId.parse(uuid(30))
const OTHER_TYPE = LeaveTypeId.parse(uuid(31))
const RULE = AvailabilityRuleId.parse(uuid(40))
const AT = '2026-11-08T10:00:00.000Z'
const LATER = '2026-11-08T11:00:00.000Z'

function leave(n: number, overrides: Partial<Leave> = {}): Leave {
  return {
    id: LeaveId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: YAEL,
    leave_type_id: TYPE,
    batch_id: null,
    start_date: '2026-11-09',
    end_date: '2026-11-10',
    status: 'pending',
    availability_effect_override: null,
    reason: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: ACTOR,
    updated_at: AT,
    updated_by: ACTOR,
    version: 1,
    ...overrides,
  }
}

const approved = (n: number, overrides: Partial<Leave> = {}) =>
  leave(n, { status: 'approved', reviewed_by: DAN, reviewed_at: AT, ...overrides })

describe('the steps of a leave (D-063, OI-024)', () => {
  const stepsOf = (row: Leave) => Object.fromEntries([...leaveSteps(row, ACTOR, AT)].map(([step, permission]) => [step, permission.action]))

  it('offers what the status allows, each with the permission its command checks', () => {
    expect(stepsOf(leave(1))).toEqual({ approve: 'approve', reject: 'approve', cancel: 'delete' })
    expect(stepsOf(approved(1))).toEqual({ reject: 'approve', cancel: 'delete', reopen: 'approve' })
    expect(stepsOf(leave(1, { status: 'rejected' }))).toEqual({ reopen: 'create' })
    expect(stepsOf(leave(1, { status: 'cancelled' }))).toEqual({ reopen: 'create' })
  })

  it('shows the leave as the step will leave it, one version on', () => {
    expect(leaveAfterStep(leave(1), 'approve', ACTOR, LATER)).toMatchObject({
      status: 'approved',
      reviewed_by: ACTOR,
      reviewed_at: LATER,
      version: 2,
      updated_at: LATER,
    })
    expect(leaveAfterStep(approved(1), 'reopen', ACTOR, LATER)).toMatchObject({ status: 'pending', reviewed_by: null, reviewed_at: null })
    expect(leaveAfterStep(approved(1), 'cancel', ACTOR, LATER)).toMatchObject({ status: 'cancelled', reviewed_by: DAN })
    expect(leaveAfterStep(approved(1), 'approve', ACTOR, LATER)).toBeNull()
  })

  it('sends a note as a shared comment, and a blank one as none', () => {
    expect(toTransitionInput(leave(1, { version: 4 }), 'reject', '   ')).toEqual({
      id: leave(1).id,
      expected_version: 4,
      transition: 'reject',
      acknowledged_rule_ids: [],
      comment: null,
    })
    expect(toTransitionInput(leave(1), 'reject', 'No cover').comment).toMatchObject({ body: 'No cover', visibility: 'shared' })
  })
})

describe('the edit form (D-064, D-119)', () => {
  const stored = approved(1, { reason: 'Wedding' })
  const values = leaveEditValues(stored)

  it('sends what changed as one update, the dates and the details together (D-123)', () => {
    expect(leaveEditChanges(stored, values)).toBeNull()
    expect(leaveEditChanges(stored, { ...values, end_date: '2026-11-12', reason: '  ' })).toEqual({ end_date: '2026-11-12', reason: null })
    expect(leaveEditChanges(stored, { ...values, leave_type_id: OTHER_TYPE })).toEqual({ leave_type_id: OTHER_TYPE })
    // A missing date is the schema's to report, not a change to send.
    expect(leaveEditChanges(stored, { ...values, end_date: '' })).toBeNull()
  })

  it('answers the codes the command answers, under changes', () => {
    expect(leaveEditIssues(stored, { ...values, end_date: '' }, null)).toEqual([{ path: ['changes', 'end_date'], code: 'required' }])
    expect(leaveEditIssues(stored, { ...values, end_date: '2026-11-01' }, null)).toEqual([
      { path: ['changes', 'end_date'], code: 'range_inverted' },
    ])
    expect(leaveEditIssues(stored, { ...values, reason: '' }, { requires_reason: true })).toEqual([
      { path: ['changes', 'reason'], code: 'reason_required' },
    ])
    // The reason is checked only when the type or the reason changes (D-117).
    expect(leaveEditIssues(leave(2), leaveEditValues(leave(2)), { requires_reason: true })).toEqual([])
  })

  it('says when an approved leave will return to pending', () => {
    const moved = { ...values, end_date: '2026-11-12' }
    const pendingAfter = (edit: typeof values, policy: 'keep_if_can_approve' | 'always_pending', canApprove: boolean, row = stored) =>
      editReturnsToPending(row, edit, policy, canApprove, ACTOR, AT)
    expect(pendingAfter(moved, 'keep_if_can_approve', true)).toBe(false)
    expect(pendingAfter(moved, 'keep_if_can_approve', false)).toBe(true)
    expect(pendingAfter(moved, 'always_pending', true)).toBe(true)
    expect(pendingAfter({ ...values, leave_type_id: OTHER_TYPE }, 'always_pending', true)).toBe(true)
    // A reason is not material, and a pending leave has no approval to lose.
    expect(pendingAfter({ ...values, reason: 'Other' }, 'always_pending', false)).toBe(false)
    expect(pendingAfter({ ...leaveEditValues(leave(2)), end_date: '2026-11-12' }, 'always_pending', false, leave(2))).toBe(false)
  })
})

describe('the thread, the inbox and the day count (D-119, D-120)', () => {
  const event = (n: number, created_at: string): LeaveEvent => ({
    id: LeaveEventId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    leave_id: leave(1).id,
    actor_id: ACTOR,
    event_type: 'created',
    from_status: null,
    to_status: 'pending',
    changes: {},
    acknowledged_rule_ids: [],
    created_at,
  })
  const comment = (n: number, created_at: string): LeaveComment => ({
    id: LeaveCommentId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    leave_id: leave(1).id,
    author_id: DAN,
    body: 'Note',
    visibility: 'shared',
    created_at,
    edited_at: null,
    archived_at: null,
  })

  it('merges events and comments oldest first, a step before its note', () => {
    const thread = leaveThread([event(52, LATER), event(50, AT)], [comment(40, LATER), comment(41, AT)])
    expect(thread.map((entry) => [entry.kind, entry.at, entry.actorId])).toEqual([
      ['event', AT, ACTOR],
      ['comment', AT, DAN],
      ['event', LATER, ACTOR],
      ['comment', LATER, DAN],
    ])
  })

  it('lists the pending leaves the actor may approve, the earliest first', () => {
    const rows = [
      leave(1, { start_date: '2026-12-01', end_date: '2026-12-02' }),
      leave(2),
      leave(3, { soldier_id: DAN }),
      approved(4),
    ]
    expect(pendingRequests(rows, (soldierId) => soldierId === YAEL).map((row) => row.id)).toEqual([leave(2).id, leave(1).id])
  })

  it('lists closed leaves, the last changed first', () => {
    const rows = [
      leave(1, { status: 'rejected', updated_at: AT }),
      leave(2, { status: 'cancelled', updated_at: LATER }),
      leave(3),
    ]
    expect(closedLeaves(rows).map((row) => row.id)).toEqual([leave(2).id, leave(1).id])
  })

  it('counts both ends of a leave', () => {
    expect(leaveDayCount(leave(1))).toBe(2)
    expect(leaveDayCount(leave(1, { end_date: '2026-11-09' }))).toBe(1)
  })
})

// ------------------------------------------------------------------- the hooks

const WINDOW: DateWindow = { from: '2026-11-08', to: '2026-11-14', days: [], followsToday: true, holdsToday: true }

interface Fakes {
  readonly stored: Leave[]
  readonly transition?: (input: unknown) => Promise<Result<Leave>>
  readonly update?: (input: unknown) => Promise<Result<Leave>>
  readonly can?: (checks: readonly PermissionCheck[]) => Promise<Result<boolean[]>>
  readonly preferences?: SoldierPreferencesRecord | null
  readonly updateMyPreferences?: (input: unknown) => Promise<Result<SoldierPreferencesRecord>>
}

function portsWith(fakes: Fakes): LogicPorts {
  const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
  const list = (query: LeaveQuery) =>
    Promise.resolve<Result<Leave[]>>({
      ok: true,
      value: fakes.stored.filter((row) => query.statuses === null || query.statuses.includes(row.status)),
    })
  const get = (id: string) => {
    const found = fakes.stored.find((row) => row.id === id)
    return Promise.resolve<Result<Leave>>(found === undefined ? { ok: false, error: { code: 'not_found' } } : { ok: true, value: found })
  }
  return fakePorts({
    session: { current: () => Promise.resolve({ ok: true, value: session }), can: fakes.can ?? allowEverything },
    repositories: {
      leaves: { list, get },
      organizations: { current: () => Promise.resolve({ ok: false, error: { code: 'not_found' } }) },
      soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: fakes.preferences ?? null }) },
    },
    commands: {
      leaves: { transition: fakes.transition, update: fakes.update },
      accounts: { updateMyPreferences: fakes.updateMyPreferences },
    },
    now: () => AT,
  })
}

const statusesOf = (state: { status: string; value?: readonly Leave[] }) => state.value?.map((row) => row.status) ?? null

describe('a step with an optimistic update (D-119)', () => {
  function render(ports: LogicPorts) {
    return renderHook(
      () => ({
        week: useLeaves(WINDOW),
        inbox: usePendingRequests(),
        one: useLeave(leave(1).id),
        step: useLeaveTransition(),
      }),
      { wrapper: wrapperOf(ports) },
    )
  }

  it('shows the new status everywhere at once, and takes it back on stale_version', async () => {
    let answer: (result: Result<Leave>) => void = () => undefined
    const stored = [leave(1)]
    const { result } = render(portsWith({ stored, transition: () => new Promise((resolve) => (answer = resolve)) }))
    await waitFor(() => {
      expect(statusesOf(result.current.week)).toEqual(['pending'])
      expect(statusesOf(result.current.inbox)).toEqual(['pending'])
      expect(result.current.one.status).toBe('ready')
    })

    let settled: Promise<Result<Leave>> | null = null
    act(() => {
      settled = result.current.step.run(leave(1), 'approve')
    })
    await waitFor(() => {
      expect(statusesOf(result.current.week)).toEqual(['approved'])
    })
    // An approved leave is no longer a pending request.
    expect(statusesOf(result.current.inbox)).toEqual([])
    expect(result.current.one).toMatchObject({ status: 'ready', value: { status: 'approved', reviewed_by: ACTOR, version: 2 } })

    await act(async () => {
      answer({ ok: false, error: { code: 'stale_version' } })
      await settled
    })
    await waitFor(() => {
      expect(statusesOf(result.current.week)).toEqual(['pending'])
      expect(statusesOf(result.current.inbox)).toEqual(['pending'])
    })
    expect(result.current.one).toMatchObject({ status: 'ready', value: { status: 'pending', version: 1 } })
  })

  it('takes a rejected leave off the board, and reads the stored rows once the command answers', async () => {
    const stored = [leave(1)]
    const transition = vi.fn(() => {
      stored[0] = leave(1, { status: 'rejected', version: 2 })
      return Promise.resolve<Result<Leave>>({ ok: true, value: leave(1, { status: 'rejected', version: 2 }) })
    })
    const { result } = render(portsWith({ stored, transition }))
    await waitFor(() => {
      expect(statusesOf(result.current.week)).toEqual(['pending'])
    })
    await act(async () => {
      await result.current.step.run(leave(1), 'reject', 'No cover')
    })
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ transition: 'reject', expected_version: 1 }))
    await waitFor(() => {
      expect(statusesOf(result.current.week)).toEqual([])
      expect(result.current.one).toMatchObject({ value: { status: 'rejected' } })
    })
  })

  it('lists only the requests the actor may approve', async () => {
    const stored = [leave(1), leave(2, { soldier_id: DAN })]
    const can = (checks: readonly PermissionCheck[]) =>
      Promise.resolve<Result<boolean[]>>({
        ok: true,
        value: checks.map((check) => check.target.kind === 'soldier' && check.target.soldier_id === YAEL),
      })
    const { result } = renderHook(() => usePendingRequests(), { wrapper: wrapperOf(portsWith({ stored, can })) })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', value: [{ id: leave(1).id }] })
    })
  })

  it('answers not_found for an id that is not a leave', async () => {
    const { result } = renderHook(() => useLeave('new-ish'), { wrapper: wrapperOf(portsWith({ stored: [] })) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'failed', error: { code: 'not_found' } })
    })
  })
})

describe('the one command of the edit form (D-123, OI-076)', () => {
  const stored = leave(1)
  const values = leaveEditValues(stored)

  it('sends the dates and the details in one update, with the acknowledged rules', async () => {
    const update = vi.fn(() => Promise.resolve<Result<Leave>>({ ok: true, value: leave(1, { reason: 'Flu', version: 2 }) }))
    const { result } = renderHook(() => useEditLeave(), { wrapper: wrapperOf(portsWith({ stored: [stored], update })) })
    let answer: Result<Leave> | null = null
    await act(async () => {
      answer = await result.current.run(stored, { ...values, end_date: '2026-11-12', reason: 'Flu' }, [RULE])
    })
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      id: stored.id,
      expected_version: 1,
      changes: { end_date: '2026-11-12', reason: 'Flu' },
      acknowledged_rule_ids: [RULE],
    })
    expect(answer).toMatchObject({ ok: true, value: { version: 2 } })
  })

  it('sends nothing when nothing changed, and a refused edit leaves nothing half done', async () => {
    const update = vi.fn(() => Promise.resolve<Result<Leave>>({ ok: false, error: { code: 'stale_version' } }))
    const { result } = renderHook(() => useEditLeave(), { wrapper: wrapperOf(portsWith({ stored: [stored], update })) })
    await act(async () => {
      expect(await result.current.run(stored, values)).toEqual({ ok: true, value: stored })
    })
    expect(update).not.toHaveBeenCalled()
    await act(async () => {
      const refused = await result.current.run(stored, { ...values, end_date: '2026-11-12', reason: 'Flu' })
      expect(refused).toEqual({ ok: false, error: { code: 'stale_version' } })
    })
    // One command: its refusal is the whole answer, with no second command to send and no first one saved.
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe('the live warning of an edit (D-142)', () => {
  it('judges the leave with the status the edit leaves it in', () => {
    const stored = approved(1)
    const moved = { ...leaveEditValues(stored), end_date: '2026-11-12' }
    expect(editedLeaveCandidate(stored, moved, true)).toMatchObject({ status: 'pending', end_date: '2026-11-12' })
    expect(editedLeaveCandidate(stored, moved, false)).toMatchObject({ status: 'approved' })
    expect(editedLeaveCandidate(stored, { ...moved, end_date: '' }, false)).toBeNull()
  })
})

describe('a leave of an archived soldier (D-124, OI-077)', () => {
  const archived = { archived_at: AT }

  it('offers only cancel, and no edit', () => {
    expect([...leaveSteps(leave(1), ACTOR, AT, archived).keys()]).toEqual(['cancel'])
    expect([...leaveSteps(approved(1), ACTOR, AT, archived).keys()]).toEqual(['cancel'])
    expect(isEditable(leave(1), archived)).toBe(false)
    expect(isEditable(leave(1))).toBe(true)
  })

  it('edits only the statuses domain names (OI-083)', () => {
    expect(isEditable(leave(1, { status: 'rejected' }))).toBe(false)
    expect(isEditable(approved(1))).toBe(true)
  })
})

describe('my preferences (D-121)', () => {
  it('reads the defaults until a row exists, and creates it at no version', async () => {
    const record: SoldierPreferencesRecord = {
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences: { create_leaves_as_approved: true },
      updated_at: AT,
      version: 1,
    }
    const updateMyPreferences = vi.fn(() => Promise.resolve<Result<SoldierPreferencesRecord>>({ ok: true, value: record }))
    const { result } = renderHook(() => ({ mine: useMyPreferences(), save: useUpdateMyPreferences() }), {
      wrapper: wrapperOf(portsWith({ stored: [], updateMyPreferences })),
    })
    await waitFor(() => {
      expect(result.current.mine).toEqual({ status: 'ready', value: { create_leaves_as_approved: false } })
    })
    await act(async () => {
      await result.current.save.run({ create_leaves_as_approved: true })
    })
    expect(updateMyPreferences).toHaveBeenCalledWith({ expected_version: null, preferences: { create_leaves_as_approved: true } })
  })

  it('starts "approve now" from the default (D-121)', () => {
    expect(newLeaveValues('2026-11-08', true).as_approved).toBe(true)
    expect(newLeaveValues('2026-11-08').as_approved).toBe(false)
  })
})

describe('hints that have not answered yet (D-122)', () => {
  it('say no without knowing, until the adapter answers', async () => {
    let answer: (result: Result<boolean[]>) => void = () => undefined
    const check: PermissionCheck = { permission: { resource: 'memberships', action: 'view' }, target: { kind: 'soldier', soldier_id: YAEL } }
    const checks = [check]
    const can = () => new Promise<Result<boolean[]>>((resolve) => (answer = resolve))
    const { result } = renderHook(() => useCanAnswers(checks), { wrapper: wrapperOf(portsWith({ stored: [], can })) })
    expect(result.current.can(check)).toBe(false)
    expect(result.current.known(check)).toBe(false)
    await act(async () => {
      answer({ ok: true, value: [false] })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(result.current.known(check)).toBe(true)
    })
    expect(result.current.can(check)).toBe(false)
  })
})
