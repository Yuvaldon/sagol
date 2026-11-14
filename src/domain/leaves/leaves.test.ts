import { describe, expect, it } from 'vitest'
import {
  LeaveStatus,
  LeaveTransition,
  LeaveTypeGroupId,
  LeaveTypeId,
  ReschedulePolicy,
  SoldierId,
  type Permission,
} from '@contracts'
import {
  COMMENT_PERMISSIONS,
  archiveBuiltInGroupIssues,
  archiveLeaveTypeGroupIssues,
  archiveLeaveTypeIssues,
  isRotationLeaveType,
  rotationLeaveReasonIssues,
  rotationLeaveTypeIssues,
  archivedSoldierIssues,
  LEAVE_PERMISSIONS,
  commentChangeIssues,
  isCommentAuthor,
  isMaterialLeaveUpdate,
  leaveEditKind,
  leaveReasonIssues,
  planLeaveCreation,
  planLeaveEdit,
  planLeaveTransition,
  type LeaveReviewState,
  type LeaveWorkflowPlan,
  type LeaveWorkflowStep,
} from './index'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ACTOR = SoldierId.parse(uuid(1))
const EARLIER_REVIEWER = SoldierId.parse(uuid(2))
const NOW = '2026-11-04T10:00:00+02:00'
const EARLIER = '2026-11-01T09:00:00Z'

function stateOf(status: LeaveStatus): LeaveReviewState {
  const reviewed = status === 'approved' || status === 'rejected'
  return {
    status,
    reviewed_by: reviewed ? EARLIER_REVIEWER : null,
    reviewed_at: reviewed ? EARLIER : null,
  }
}

function step(plan: LeaveWorkflowPlan): LeaveWorkflowStep {
  if (!plan.allowed) throw new Error(`refused: ${JSON.stringify(plan.issues)}`)
  return plan
}

// ================================================================ state machine (D-063)

type Outcome = LeaveStatus | 'invalid_transition' | 'archived'

/** Every status × transition. Cancelled answers `archived` to everything but reopen. */
const EXPECTED: Record<LeaveStatus, Record<LeaveTransition, Outcome>> = {
  pending: { approve: 'approved', reject: 'rejected', cancel: 'cancelled', reopen: 'invalid_transition' },
  approved: { approve: 'invalid_transition', reject: 'rejected', cancel: 'cancelled', reopen: 'pending' },
  rejected: {
    approve: 'invalid_transition',
    reject: 'invalid_transition',
    cancel: 'invalid_transition',
    reopen: 'pending',
  },
  cancelled: { approve: 'archived', reject: 'archived', cancel: 'archived', reopen: 'pending' },
}

const PERMISSION: Record<LeaveTransition, (from: LeaveStatus) => Permission> = {
  approve: () => LEAVE_PERMISSIONS.approve,
  reject: () => LEAVE_PERMISSIONS.approve,
  cancel: () => LEAVE_PERMISSIONS.cancel,
  reopen: (from) => (from === 'approved' ? LEAVE_PERMISSIONS.approve : LEAVE_PERMISSIONS.create),
}

describe('planLeaveTransition', () => {
  for (const from of LeaveStatus.options) {
    for (const transition of LeaveTransition.options) {
      const expected = EXPECTED[from][transition]
      it(`${from} --${transition}--> ${expected}`, () => {
        const plan = planLeaveTransition(stateOf(from), transition, ACTOR, NOW)
        if (expected === 'invalid_transition' || expected === 'archived') {
          expect(plan).toEqual({ allowed: false, issues: [{ path: ['transition'], code: expected }] })
          return
        }
        const allowed = step(plan)
        expect(allowed.next.status).toBe(expected)
        expect(allowed.permissions).toEqual([PERMISSION[transition](from)])
        expect(allowed.event).toEqual({
          event_type: { approve: 'approved', reject: 'rejected', cancel: 'cancelled', reopen: 'reopened' }[transition],
          from_status: from,
          to_status: expected,
        })
      })
    }
  }

  it('approve and reject record the actor as reviewer', () => {
    for (const transition of ['approve', 'reject'] as const) {
      const allowed = step(planLeaveTransition(stateOf('pending'), transition, ACTOR, NOW))
      expect(allowed.next).toMatchObject({ reviewed_by: ACTOR, reviewed_at: NOW })
    }
    const rejectApproved = step(planLeaveTransition(stateOf('approved'), 'reject', ACTOR, NOW))
    expect(rejectApproved.next).toEqual({ status: 'rejected', reviewed_by: ACTOR, reviewed_at: NOW })
  })

  it('reopen clears the review; cancel keeps it', () => {
    for (const from of ['approved', 'rejected', 'cancelled'] as const) {
      const allowed = step(planLeaveTransition(stateOf(from), 'reopen', ACTOR, NOW))
      expect(allowed.next).toEqual({ status: 'pending', reviewed_by: null, reviewed_at: null })
    }
    const cancelled = step(planLeaveTransition(stateOf('approved'), 'cancel', ACTOR, NOW))
    expect(cancelled.next).toEqual({ status: 'cancelled', reviewed_by: EARLIER_REVIEWER, reviewed_at: EARLIER })
  })
})

// ===================================================================== creation (D-013)

describe('planLeaveCreation', () => {
  it('creates pending with leaves:create, unreviewed', () => {
    expect(planLeaveCreation('create', false, ACTOR, NOW)).toEqual({
      allowed: true,
      permissions: [LEAVE_PERMISSIONS.create],
      next: { status: 'pending', reviewed_by: null, reviewed_at: null },
      event: { event_type: 'created', from_status: null, to_status: 'pending' },
    })
  })

  it('creates approved only with leaves:approve as well, and records the reviewer', () => {
    const plan = planLeaveCreation('create', true, ACTOR, NOW)
    expect(plan.permissions).toEqual([LEAVE_PERMISSIONS.create, LEAVE_PERMISSIONS.approve])
    expect(plan.next).toEqual({ status: 'approved', reviewed_by: ACTOR, reviewed_at: NOW })
    expect(plan.event.to_status).toBe('approved')
  })

  it('duplicates with leaves:duplicate instead of leaves:create', () => {
    expect(planLeaveCreation('duplicate', false, ACTOR, NOW).permissions).toEqual([LEAVE_PERMISSIONS.duplicate])
    expect(planLeaveCreation('duplicate', true, ACTOR, NOW).permissions).toEqual([
      LEAVE_PERMISSIONS.duplicate,
      LEAVE_PERMISSIONS.approve,
    ])
  })
})

// ======================================================================== edits (D-064)

describe('planLeaveEdit', () => {
  const edit = (overrides: Partial<Parameters<typeof planLeaveEdit>[1]> = {}) => ({
    kind: 'reschedule' as const,
    material: true,
    policy: ReschedulePolicy.enum.keep_if_can_approve,
    actor_can_approve: true,
    ...overrides,
  })

  it('refuses closed leaves: rejected is invalid_transition, cancelled is archived', () => {
    expect(planLeaveEdit(stateOf('rejected'), edit(), ACTOR, NOW)).toEqual({
      allowed: false,
      issues: [{ path: [], code: 'invalid_transition' }],
    })
    expect(planLeaveEdit(stateOf('cancelled'), edit({ kind: 'update' }), ACTOR, NOW)).toEqual({
      allowed: false,
      issues: [{ path: [], code: 'archived' }],
    })
  })

  it('a pending leave stays pending; the event names the edit and no status change', () => {
    for (const kind of ['update', 'reschedule'] as const) {
      const allowed = step(planLeaveEdit(stateOf('pending'), edit({ kind }), ACTOR, NOW))
      expect(allowed.permissions).toEqual([LEAVE_PERMISSIONS.update])
      expect(allowed.next).toEqual(stateOf('pending'))
      expect(allowed.event).toEqual({
        event_type: kind === 'update' ? 'updated' : 'rescheduled',
        from_status: null,
        to_status: null,
      })
    }
  })

  it('a non-material edit keeps an approved leave and its reviewer', () => {
    const allowed = step(planLeaveEdit(stateOf('approved'), edit({ material: false, actor_can_approve: false }), ACTOR, NOW))
    expect(allowed.next).toEqual(stateOf('approved'))
    expect(allowed.event.to_status).toBeNull()
  })

  it('keep_if_can_approve keeps an approved leave when the actor can approve; the actor re-approves', () => {
    const allowed = step(planLeaveEdit(stateOf('approved'), edit(), ACTOR, NOW))
    expect(allowed.next).toEqual({ status: 'approved', reviewed_by: ACTOR, reviewed_at: NOW })
    expect(allowed.event).toEqual({ event_type: 'rescheduled', from_status: null, to_status: null })
  })

  it('returns to pending when the actor cannot approve, or under always_pending', () => {
    const cases = [
      edit({ actor_can_approve: false }),
      edit({ policy: ReschedulePolicy.enum.always_pending }),
      edit({ kind: 'update', policy: ReschedulePolicy.enum.always_pending }),
    ]
    for (const change of cases) {
      const allowed = step(planLeaveEdit(stateOf('approved'), change, ACTOR, NOW))
      expect(allowed.next).toEqual({ status: 'pending', reviewed_by: null, reviewed_at: null })
      expect(allowed.event).toMatchObject({ from_status: 'approved', to_status: 'pending' })
    }
  })
})

describe('material changes (D-064)', () => {
  const TYPE_A = LeaveTypeId.parse(uuid(11))
  const TYPE_B = LeaveTypeId.parse(uuid(12))
  const current = { leave_type_id: TYPE_A, availability_effect_override: null, start_date: '2026-11-10', end_date: '2026-11-12' }

  it('type, effect override and date changes are material; reason and properties are not (D-123)', () => {
    expect(isMaterialLeaveUpdate(current, { end_date: '2026-11-13' })).toBe(true)
    expect(isMaterialLeaveUpdate(current, { start_date: '2026-11-09' })).toBe(true)
    expect(isMaterialLeaveUpdate(current, { start_date: current.start_date, end_date: current.end_date })).toBe(false)
    expect(isMaterialLeaveUpdate(current, { leave_type_id: TYPE_B })).toBe(true)
    expect(isMaterialLeaveUpdate(current, { availability_effect_override: 'available' })).toBe(true)
    expect(
      isMaterialLeaveUpdate({ ...current, availability_effect_override: 'available' }, { availability_effect_override: null }),
    ).toBe(true)
    expect(isMaterialLeaveUpdate(current, { leave_type_id: TYPE_A, availability_effect_override: null })).toBe(false)
    expect(isMaterialLeaveUpdate(current, {})).toBe(false)
  })
})

describe('leaveReasonIssues', () => {
  it('requires a non-blank reason only when the type requires one', () => {
    const required = { requires_reason: true }
    expect(leaveReasonIssues(required, null)).toEqual([{ path: ['reason'], code: 'reason_required' }])
    expect(leaveReasonIssues(required, '   ')).toEqual([{ path: ['reason'], code: 'reason_required' }])
    expect(leaveReasonIssues(required, 'family event')).toEqual([])
    expect(leaveReasonIssues({ requires_reason: false }, null)).toEqual([])
  })
})

describe('comments', () => {
  it('each visibility has its own resource', () => {
    expect(COMMENT_PERMISSIONS.shared.create).toEqual({ resource: 'leave_comments', action: 'create' })
    expect(COMMENT_PERMISSIONS.internal.view).toEqual({ resource: 'internal_comments', action: 'view' })
  })

  it('only the author changes a comment, and an archived comment does not change', () => {
    const comment = { author_id: ACTOR, archived_at: null }
    expect(isCommentAuthor(comment, ACTOR)).toBe(true)
    expect(isCommentAuthor(comment, EARLIER_REVIEWER)).toBe(false)
    expect(commentChangeIssues(comment)).toEqual([])
    expect(commentChangeIssues({ ...comment, archived_at: EARLIER })).toEqual([{ path: [], code: 'archived' }])
  })
})

describe('archiving a leave type group (D-113)', () => {
  const group = LeaveTypeGroupId.parse(uuid(40))
  const other = LeaveTypeGroupId.parse(uuid(41))
  const refused = [{ path: [], code: 'group_in_use' }]

  it('is refused while a live type belongs to the group', () => {
    expect(archiveLeaveTypeGroupIssues([{ group_id: group, archived_at: null }], group)).toEqual(refused)
  })

  it('is allowed when its types are archived, belong elsewhere, or there are none', () => {
    expect(archiveLeaveTypeGroupIssues([{ group_id: group, archived_at: EARLIER }], group)).toEqual([])
    expect(archiveLeaveTypeGroupIssues([{ group_id: other, archived_at: null }], group)).toEqual([])
    expect(archiveLeaveTypeGroupIssues([{ group_id: null, archived_at: null }], group)).toEqual([])
    expect(archiveLeaveTypeGroupIssues([], group)).toEqual([])
  })
})

describe('the built-in group (D-347)', () => {
  const builtIn = { id: LeaveTypeGroupId.parse(uuid(42)), is_rotation_leave: true }
  const ordinary = { id: LeaveTypeGroupId.parse(uuid(43)), is_rotation_leave: false }
  const first = { id: LeaveTypeId.parse(uuid(44)), group_id: builtIn.id, archived_at: null }
  const second = { id: LeaveTypeId.parse(uuid(45)), group_id: builtIn.id, archived_at: null }
  const fixed = (field: string) => ({ path: [field], code: 'fixed_by_group' })
  const rotation = { group_id: builtIn.id, availability_effect: 'unavailable', requires_reason: false } as const

  it('is never archived', () => {
    expect(archiveBuiltInGroupIssues(builtIn)).toEqual([{ path: [], code: 'group_builtin' }])
    expect(archiveBuiltInGroupIssues(ordinary)).toEqual([])
  })

  it('keeps its last live type', () => {
    expect(archiveLeaveTypeIssues([first], first, builtIn)).toEqual([{ path: [], code: 'last_rotation_type' }])
    expect(archiveLeaveTypeIssues([first, { ...second, archived_at: EARLIER }], first, builtIn)).toEqual([
      { path: [], code: 'last_rotation_type' },
    ])
    expect(archiveLeaveTypeIssues([first, second], first, builtIn)).toEqual([])
    expect(archiveLeaveTypeIssues([first], first, ordinary)).toEqual([])
    expect(archiveLeaveTypeIssues([first], first, null)).toEqual([])
  })

  it('tells its types apart', () => {
    expect(isRotationLeaveType(first, [builtIn, ordinary])).toBe(true)
    expect(isRotationLeaveType({ group_id: ordinary.id }, [builtIn, ordinary])).toBe(false)
    expect(isRotationLeaveType({ group_id: null }, [builtIn])).toBe(false)
    expect(isRotationLeaveType(undefined, [builtIn])).toBe(false)
  })

  it('refuses a reason on a leave of its types (D-430)', () => {
    expect(rotationLeaveReasonIssues(builtIn, 'family event')).toEqual([fixed('reason')])
    expect(rotationLeaveReasonIssues(builtIn, null)).toEqual([])
    expect(rotationLeaveReasonIssues(builtIn, '  ')).toEqual([])
    expect(rotationLeaveReasonIssues(ordinary, 'family event')).toEqual([])
    expect(rotationLeaveReasonIssues(null, 'family event')).toEqual([])
  })

  it('fixes its types as absences that ask no reason', () => {
    expect(rotationLeaveTypeIssues(null, rotation, builtIn)).toEqual([])
    expect(rotationLeaveTypeIssues(null, { ...rotation, availability_effect: 'available', requires_reason: true }, builtIn)).toEqual([
      fixed('availability_effect'),
      fixed('requires_reason'),
    ])
    expect(rotationLeaveTypeIssues(null, { ...rotation, group_id: ordinary.id, requires_reason: true }, ordinary)).toEqual([])
  })

  it('lets no type move into it or out of it', () => {
    expect(rotationLeaveTypeIssues({ group: ordinary, group_id: ordinary.id }, rotation, builtIn)).toEqual([fixed('group_id')])
    expect(rotationLeaveTypeIssues({ group: builtIn, group_id: builtIn.id }, { ...rotation, group_id: null }, null)).toEqual([
      fixed('group_id'),
    ])
    expect(rotationLeaveTypeIssues({ group: builtIn, group_id: builtIn.id }, rotation, builtIn)).toEqual([])
    expect(rotationLeaveTypeIssues({ group: null, group_id: null }, { ...rotation, group_id: ordinary.id }, ordinary)).toEqual([])
  })
})

describe('one edit command (D-123)', () => {
  it('an edit of the dates alone is a reschedule; anything else is an update', () => {
    expect(leaveEditKind(['start_date'])).toBe('reschedule')
    expect(leaveEditKind(['start_date', 'end_date'])).toBe('reschedule')
    expect(leaveEditKind(['end_date', 'reason'])).toBe('update')
    expect(leaveEditKind(['leave_type_id'])).toBe('update')
  })
})

describe('a leave of an archived soldier (D-124)', () => {
  const archived = { archived_at: '2026-11-01T08:00:00Z' }
  const serving = { archived_at: null }

  it('can only be cancelled', () => {
    expect(archivedSoldierIssues(archived, 'cancel', ['transition'])).toEqual([])
    for (const step of ['approve', 'reject', 'reopen'] as const) {
      expect(archivedSoldierIssues(archived, step, ['transition'])).toEqual([{ path: ['transition'], code: 'archived' }])
    }
    expect(archivedSoldierIssues(archived, 'update', [])).toEqual([{ path: [], code: 'archived' }])
  })

  it('leaves every step to a soldier who is not archived', () => {
    for (const step of ['approve', 'reject', 'reopen', 'cancel', 'update'] as const) {
      expect(archivedSoldierIssues(serving, step, [])).toEqual([])
    }
  })
})
