import {
  IssueCode,
  LeaveStatus,
  ReschedulePolicy,
  type Issue,
  type Leave,
  type LeaveEventType,
  type LeaveTransition,
  type LeaveType,
  type Permission,
  type Soldier,
  type SoldierId,
  type Timestamp,
} from '@contracts'

// Leave state machine (D-049, D-063) and the effect of edits on approval (D-013, D-041,
// D-064). Pure: the data layer checks the returned permissions with `can()` against the
// leave's soldier, writes the returned columns and appends the returned event.

/** The leave permissions of D-040 that leave commands check. */
export const LEAVE_PERMISSIONS = {
  view: { resource: 'leaves', action: 'view' },
  create: { resource: 'leaves', action: 'create' },
  update: { resource: 'leaves', action: 'update' },
  /** Cancels: "delete" never hard-deletes (D-017). */
  cancel: { resource: 'leaves', action: 'delete' },
  duplicate: { resource: 'leaves', action: 'duplicate' },
  approve: { resource: 'leaves', action: 'approve' },
} as const satisfies Record<string, Permission>

/** The status each allowed transition leads to, per current status (D-063). Absent = refused. */
export const LEAVE_TRANSITIONS: Readonly<
  Record<LeaveStatus, Readonly<Partial<Record<LeaveTransition, LeaveStatus>>>>
> = {
  pending: { approve: 'approved', reject: 'rejected', cancel: 'cancelled' },
  approved: { reject: 'rejected', cancel: 'cancelled', reopen: 'pending' },
  rejected: { reopen: 'pending' },
  cancelled: { reopen: 'pending' },
}

/** Statuses whose details and dates may be edited (D-064). Others must be reopened first. */
export const EDITABLE_LEAVE_STATUSES: readonly LeaveStatus[] = ['pending', 'approved']

const TRANSITION_EVENTS: Readonly<Record<LeaveTransition, LeaveEventType>> = {
  approve: 'approved',
  reject: 'rejected',
  cancel: 'cancelled',
  reopen: 'reopened',
}

/** The columns of a leave that record its status and its review. */
export type LeaveReviewState = Pick<Leave, 'status' | 'reviewed_by' | 'reviewed_at'>

/** Event columns of `leave_events` decided by the workflow. Statuses are NULL when unchanged. */
export interface LeaveWorkflowEvent {
  readonly event_type: LeaveEventType
  readonly from_status: LeaveStatus | null
  readonly to_status: LeaveStatus | null
}

/** An allowed step: the permissions to check, the next review state and its event. */
export interface LeaveWorkflowStep {
  readonly allowed: true
  /** Every one must pass `can()` on the leave's soldier, or the command is `forbidden`. */
  readonly permissions: readonly Permission[]
  readonly next: LeaveReviewState
  readonly event: LeaveWorkflowEvent
}

export type LeaveWorkflowPlan = LeaveWorkflowStep | { readonly allowed: false; readonly issues: Issue[] }

/** A cancelled leave answers `archived` (D-046); any other refusal is `invalid_transition`. */
function refused(status: LeaveStatus, path: Issue['path']): LeaveWorkflowPlan {
  const code = status === LeaveStatus.enum.cancelled ? IssueCode.enum.archived : IssueCode.enum.invalid_transition
  return { allowed: false, issues: [{ path, code }] }
}

function reviewedBy(status: LeaveStatus, actorId: SoldierId, now: Timestamp): LeaveReviewState {
  return { status, reviewed_by: actorId, reviewed_at: now }
}

function unreviewed(status: LeaveStatus): LeaveReviewState {
  return { status, reviewed_by: null, reviewed_at: null }
}

function transitionPermission(from: LeaveStatus, transition: LeaveTransition): Permission {
  switch (transition) {
    case 'approve':
    case 'reject':
      return LEAVE_PERMISSIONS.approve
    case 'cancel':
      return LEAVE_PERMISSIONS.cancel
    case 'reopen':
      // Undoing an approval is an approver's decision; reopening a closed leave is a new request.
      return from === LeaveStatus.enum.approved ? LEAVE_PERMISSIONS.approve : LEAVE_PERMISSIONS.create
  }
}

/**
 * `transitionLeave` (D-063). Approve and reject record the actor as reviewer; reopen returns
 * the leave to pending and clears the review; cancel keeps it.
 */
export function planLeaveTransition(
  leave: LeaveReviewState,
  transition: LeaveTransition,
  actorId: SoldierId,
  now: Timestamp,
): LeaveWorkflowPlan {
  const to = LEAVE_TRANSITIONS[leave.status][transition]
  if (to === undefined) return refused(leave.status, ['transition'])
  let next: LeaveReviewState
  switch (transition) {
    case 'approve':
    case 'reject':
      next = reviewedBy(to, actorId, now)
      break
    case 'reopen':
      next = unreviewed(to)
      break
    case 'cancel':
      next = { ...leave, status: to }
      break
  }
  return {
    allowed: true,
    permissions: [transitionPermission(leave.status, transition)],
    next,
    event: { event_type: TRANSITION_EVENTS[transition], from_status: leave.status, to_status: to },
  }
}

/** How a leave is created: `create` and `createBatch` need `leaves:create`, `duplicate` `leaves:duplicate`. */
export type LeaveCreationSource = 'create' | 'duplicate'

/**
 * A new leave is pending, or approved in one step when `as_approved` and the actor also
 * holds `leaves:approve` over the soldier (D-013).
 */
export function planLeaveCreation(
  source: LeaveCreationSource,
  asApproved: boolean,
  actorId: SoldierId,
  now: Timestamp,
): LeaveWorkflowStep {
  const base = source === 'create' ? LEAVE_PERMISSIONS.create : LEAVE_PERMISSIONS.duplicate
  const next = asApproved
    ? reviewedBy(LeaveStatus.enum.approved, actorId, now)
    : unreviewed(LeaveStatus.enum.pending)
  return {
    allowed: true,
    permissions: asApproved ? [base, LEAVE_PERMISSIONS.approve] : [base],
    next,
    event: { event_type: 'created', from_status: null, to_status: next.status },
  }
}

/** The event of an edit: `rescheduled` when only the dates changed, otherwise `updated` (D-123). */
export type LeaveEditKind = 'update' | 'reschedule'

const DATE_COLUMNS: readonly string[] = ['start_date', 'end_date']

/** The kind of an edit from the columns it changed (D-123). */
export function leaveEditKind(changedColumns: Iterable<string>): LeaveEditKind {
  const changed = [...changedColumns]
  return changed.length > 0 && changed.every((column) => DATE_COLUMNS.includes(column)) ? 'reschedule' : 'update'
}

/** A step on a leave: a transition, or an edit (`leaves.update`). */
export type LeaveStep = LeaveTransition | 'update'

/** The only step a leave of an archived soldier takes (D-124). */
export const ARCHIVED_SOLDIER_STEPS: readonly LeaveStep[] = ['cancel']

/**
 * A leave of an archived soldier can only be cancelled (D-124): every other step answers `archived`, at the state
 * step of the command's order. An inactive soldier is not archived. `path` is where the command names the step.
 */
export function archivedSoldierIssues(soldier: Pick<Soldier, 'archived_at'>, step: LeaveStep, path: Issue['path']): Issue[] {
  if (soldier.archived_at === null || ARCHIVED_SOLDIER_STEPS.includes(step)) return []
  return [{ path, code: IssueCode.enum.archived }]
}

export interface LeaveEdit {
  readonly kind: LeaveEditKind
  /** The dates move, or the type or effect override changes (`isMaterialLeaveUpdate`, D-064). */
  readonly material: boolean
  readonly policy: ReschedulePolicy
  /** `can(actor, leaves:approve, the leave's soldier)` now. */
  readonly actor_can_approve: boolean
}

const EDIT_EVENTS: Readonly<Record<LeaveEditKind, LeaveEventType>> = {
  update: 'updated',
  reschedule: 'rescheduled',
}

/**
 * Edits need `leaves:update` and an editable status (D-064). A material edit of an approved
 * leave keeps it approved only under `keep_if_can_approve` when the actor can approve, and
 * the actor becomes its reviewer; otherwise it returns to pending (D-013, D-041).
 */
export function planLeaveEdit(
  leave: LeaveReviewState,
  edit: LeaveEdit,
  actorId: SoldierId,
  now: Timestamp,
): LeaveWorkflowPlan {
  if (!EDITABLE_LEAVE_STATUSES.includes(leave.status)) return refused(leave.status, [])
  let next: LeaveReviewState = leave
  if (leave.status === LeaveStatus.enum.approved && edit.material) {
    const keeps = edit.policy === ReschedulePolicy.enum.keep_if_can_approve && edit.actor_can_approve
    next = keeps ? reviewedBy(LeaveStatus.enum.approved, actorId, now) : unreviewed(LeaveStatus.enum.pending)
  }
  const changed = next.status !== leave.status
  return {
    allowed: true,
    permissions: [LEAVE_PERMISSIONS.update],
    next,
    event: {
      event_type: EDIT_EVENTS[edit.kind],
      from_status: changed ? leave.status : null,
      to_status: changed ? next.status : null,
    },
  }
}

type MaterialColumns = Pick<Leave, 'leave_type_id' | 'availability_effect_override' | 'start_date' | 'end_date'>

/** An edit is material when it moves a date or changes the type or the effect override (D-064, D-123). */
export function isMaterialLeaveUpdate(current: MaterialColumns, changes: Partial<MaterialColumns>): boolean {
  const differs = <K extends keyof MaterialColumns>(column: K) =>
    changes[column] !== undefined && changes[column] !== current[column]
  return (
    differs('leave_type_id') || differs('availability_effect_override') || differs('start_date') || differs('end_date')
  )
}

type LeaveDates = Pick<Leave, 'start_date' | 'end_date'>

/** A reschedule is material when either date moves. */
export function isMaterialReschedule(current: LeaveDates, next: LeaveDates): boolean {
  return current.start_date !== next.start_date || current.end_date !== next.end_date
}

/** A leave type with `requires_reason` needs a non-blank reason (`reason_required`). */
export function leaveReasonIssues(
  leaveType: Pick<LeaveType, 'requires_reason'>,
  reason: string | null,
): Issue[] {
  if (!leaveType.requires_reason) return []
  if (reason !== null && reason.trim() !== '') return []
  return [{ path: ['reason'], code: IssueCode.enum.reason_required }]
}
