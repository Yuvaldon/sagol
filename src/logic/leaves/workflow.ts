import {
  LeaveCommentId,
  LeaveStatus,
  LeaveTransition,
  RescheduleLeaveInput,
  type CalendarDate,
  type Issue,
  type Leave,
  type LeaveComment,
  type LeaveEvent,
  type LeaveQuery,
  type LeaveType,
  type LeaveTypeId,
  type Permission,
  type ReschedulePolicy,
  type SoldierId,
  type Timestamp,
  type TransitionLeaveInput,
  type UpdateLeaveInput,
} from '@contracts'
import {
  LEAVE_PERMISSIONS,
  compareDates,
  compareInstants,
  daysBetween,
  isMaterialLeaveUpdate,
  isMaterialReschedule,
  leaveReasonIssues,
  optionalText,
  planLeaveEdit,
  planLeaveTransition,
} from '@domain'
import { formIssues } from '../forms/issues'

// A leave after it exists (D-117, D-119, D-120), between the stored rows and the details drawer and the inbox.
// Pure: what each step needs and leads to comes from the same state machine the command follows, so a control
// and an optimistic row never say something the command would not.

// ----------------------------------------------------------------------- steps

/** The steps a leave's status allows, each with the permission its command checks (D-063, OI-024). */
export function leaveSteps(leave: Leave, actorId: SoldierId, now: Timestamp): ReadonlyMap<LeaveTransition, Permission> {
  const steps = new Map<LeaveTransition, Permission>()
  for (const transition of LeaveTransition.options) {
    const plan = planLeaveTransition(leave, transition, actorId, now)
    const [permission] = plan.allowed ? plan.permissions : []
    if (permission !== undefined) steps.set(transition, permission)
  }
  return steps
}

/** The leave as the step will leave it, shown before the command answers. NULL when the status refuses it. */
export function leaveAfterStep(leave: Leave, transition: LeaveTransition, actorId: SoldierId, now: Timestamp): Leave | null {
  const plan = planLeaveTransition(leave, transition, actorId, now)
  if (!plan.allowed) return null
  const { status, reviewed_by, reviewed_at } = plan.next
  return { ...leave, status, reviewed_by, reviewed_at, updated_at: now, updated_by: actorId, version: leave.version + 1 }
}

/** A blank note sends no comment. A note written with a step is shared (D-119). */
export function toTransitionInput(leave: Leave, transition: LeaveTransition, note: string): TransitionLeaveInput {
  const body = optionalText(note)
  return {
    id: leave.id,
    expected_version: leave.version,
    transition,
    acknowledged_rule_ids: [],
    comment: body === null ? null : { id: LeaveCommentId.parse(crypto.randomUUID()), body, visibility: 'shared' },
  }
}

// ------------------------------------------------------------------------ edit

/** The one edit form: the type, the dates and the reason (D-119). */
export interface LeaveEditValues {
  readonly leave_type_id: LeaveTypeId
  /** '' while the field is empty; the schema then answers. */
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  readonly reason: string
}

export function leaveEditValues(leave: Leave): LeaveEditValues {
  return { leave_type_id: leave.leave_type_id, start_date: leave.start_date, end_date: leave.end_date, reason: leave.reason ?? '' }
}

interface LeaveEditChanges {
  /** NULL when the dates did not move, or a date is missing. */
  readonly dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate } | null
  /** NULL when neither the type nor the reason changed. */
  readonly details: UpdateLeaveInput['changes'] | null
}

/** What the form changed, split the way the commands take it: dates to `reschedule`, the rest to `update`. */
export function leaveEditChanges(leave: Leave, values: LeaveEditValues): LeaveEditChanges {
  const { start_date, end_date } = values
  const moved =
    start_date !== '' && end_date !== '' && isMaterialReschedule(leave, { start_date, end_date }) ? { start_date, end_date } : null
  const reason = optionalText(values.reason)
  const details = {
    ...(values.leave_type_id === leave.leave_type_id ? {} : { leave_type_id: values.leave_type_id }),
    ...(reason === leave.reason ? {} : { reason }),
  }
  return { dates: moved, details: Object.keys(details).length === 0 ? null : details }
}

/**
 * The codes the commands answer: the schema's on the dates (D-068), and the reason the type asks for when the type
 * or the reason changes (D-117). The commands stay the authority.
 */
export function leaveEditIssues(leave: Leave, values: LeaveEditValues, type: Pick<LeaveType, 'requires_reason'> | null): Issue[] {
  const dates = formIssues(RescheduleLeaveInput, {
    id: leave.id,
    expected_version: leave.version,
    start_date: values.start_date === '' ? undefined : values.start_date,
    end_date: values.end_date === '' ? undefined : values.end_date,
    acknowledged_rule_ids: [],
  })
  const { details } = leaveEditChanges(leave, values)
  const reason = details === null || type === null ? [] : leaveReasonIssues(type, optionalText(values.reason))
  return [...dates, ...reason]
}

/**
 * Whether sending the form returns an approved leave to pending (D-064): a material edit, under a policy or an
 * actor that does not keep the approval. The form says so before it is sent.
 */
export function editReturnsToPending(
  leave: Leave,
  values: LeaveEditValues,
  policy: ReschedulePolicy,
  actorCanApprove: boolean,
  actorId: SoldierId,
  now: Timestamp,
): boolean {
  if (leave.status !== LeaveStatus.enum.approved) return false
  const { dates } = leaveEditChanges(leave, values)
  const material = dates !== null || isMaterialLeaveUpdate(leave, { leave_type_id: values.leave_type_id })
  const plan = planLeaveEdit(leave, { kind: 'update', material, policy, actor_can_approve: actorCanApprove }, actorId, now)
  return plan.allowed && plan.next.status === LeaveStatus.enum.pending
}

/** The permission both edit commands check. */
export const EDIT_PERMISSION: Permission = LEAVE_PERMISSIONS.update

// ---------------------------------------------------------------------- thread

/** One line of a leave's thread: something that happened, or something someone wrote (D-119). */
export type ThreadEntry =
  | { readonly kind: 'event'; readonly key: string; readonly at: Timestamp; readonly actorId: SoldierId; readonly event: LeaveEvent }
  | { readonly kind: 'comment'; readonly key: string; readonly at: Timestamp; readonly actorId: SoldierId; readonly comment: LeaveComment }

/** Events and comments together, oldest first. At the same instant the event comes first: a note follows its step. */
export function leaveThread(events: readonly LeaveEvent[], comments: readonly LeaveComment[]): ThreadEntry[] {
  const entries: ThreadEntry[] = [
    ...events.map((event): ThreadEntry => ({ kind: 'event', key: event.id, at: event.created_at, actorId: event.actor_id, event })),
    ...comments.map(
      (comment): ThreadEntry => ({ kind: 'comment', key: comment.id, at: comment.created_at, actorId: comment.author_id, comment }),
    ),
  ]
  const rank = (entry: ThreadEntry) => (entry.kind === 'event' ? 0 : 1)
  return entries.sort((a, b) => compareInstants(a.at, b.at) || rank(a) - rank(b) || a.key.localeCompare(b.key))
}

// ----------------------------------------------------------------------- inbox

/** Any dates (D-120). */
export const PENDING_QUERY: LeaveQuery = { window: null, soldier_ids: null, statuses: [LeaveStatus.enum.pending] }
export const CLOSED_QUERY: LeaveQuery = {
  window: null,
  soldier_ids: null,
  statuses: [LeaveStatus.enum.rejected, LeaveStatus.enum.cancelled],
}

/** The pending leaves the actor may approve, the earliest first (D-120). */
export function pendingRequests(leaves: readonly Leave[], mayApprove: (soldierId: SoldierId) => boolean): Leave[] {
  return leaves
    .filter((leave) => leave.status === LeaveStatus.enum.pending && mayApprove(leave.soldier_id))
    .toSorted((a, b) => compareDates(a.start_date, b.start_date) || a.id.localeCompare(b.id))
}

/** Rejected and cancelled leaves, the last changed first (D-120). */
export function closedLeaves(leaves: readonly Leave[]): Leave[] {
  return leaves
    .filter((leave) => leave.status === LeaveStatus.enum.rejected || leave.status === LeaveStatus.enum.cancelled)
    .toSorted((a, b) => compareInstants(b.updated_at, a.updated_at) || a.id.localeCompare(b.id))
}

/** How many days a leave covers, both ends included (D-012). */
export function leaveDayCount(leave: Pick<Leave, 'start_date' | 'end_date'>): number {
  return daysBetween(leave.start_date, leave.end_date) + 1
}
