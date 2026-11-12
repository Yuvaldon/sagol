import { INBOX, MINE } from '@config'
import {
  IssueCode,
  LeaveCommentId,
  LeaveStatus,
  LeaveTransition,
  UpdateLeaveInput,
  type AvailabilityRuleId,
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
} from '@contracts'
import { sameProperties, type WithProperties } from '../properties/properties'
import {
  EDITABLE_LEAVE_STATUSES,
  LEAVE_PERMISSIONS,
  addDays,
  archivedSoldierIssues,
  compareDates,
  compareInstants,
  daysBetween,
  isMaterialLeaveUpdate,
  leaveReasonIssues,
  optionalText,
  planLeaveEdit,
  planLeaveTransition,
  APPROVED_ONLY,
  createAvailabilityContext,
  type AvailabilityLeave,
  type SoldierDay,
} from '@domain'
import { formIssues } from '../forms/issues'

// A leave after it exists (D-117, D-119, D-120), between the stored rows and the details drawer and the inbox.
// Pure: what each step needs and leads to comes from the same state machine the command follows, so a control
// and an optimistic row never say something the command would not.

// ----------------------------------------------------------------------- steps

/** Whether the leave's soldier is archived. Unknown counts as not: the command decides (D-124). */
export interface LeaveSoldierState {
  readonly archived_at: Timestamp | null
}

const SERVING: LeaveSoldierState = { archived_at: null }

/**
 * The steps a leave's status allows, each with the permission its command checks (D-063, OI-024). A leave of an
 * archived soldier takes only `cancel` (D-124).
 */
export function leaveSteps(
  leave: Leave,
  actorId: SoldierId,
  now: Timestamp,
  soldier: LeaveSoldierState = SERVING,
): ReadonlyMap<LeaveTransition, Permission> {
  const steps = new Map<LeaveTransition, Permission>()
  for (const transition of LeaveTransition.options) {
    if (archivedSoldierIssues(soldier, transition, []).length > 0) continue
    const plan = planLeaveTransition(leave, transition, actorId, now)
    const [permission] = plan.allowed ? plan.permissions : []
    if (permission !== undefined) steps.set(transition, permission)
  }
  return steps
}

/** Whether the leave takes an edit: an editable status (D-064, OI-083), and a soldier who is not archived (D-124). */
export function isEditable(leave: Leave, soldier: LeaveSoldierState = SERVING): boolean {
  return EDITABLE_LEAVE_STATUSES.includes(leave.status) && archivedSoldierIssues(soldier, 'update', []).length === 0
}

/** The leave as the step will leave it, shown before the command answers. NULL when the status refuses it. */
export function leaveAfterStep(leave: Leave, transition: LeaveTransition, actorId: SoldierId, now: Timestamp): Leave | null {
  const plan = planLeaveTransition(leave, transition, actorId, now)
  if (!plan.allowed) return null
  const { status, reviewed_by, reviewed_at } = plan.next
  return { ...leave, status, reviewed_by, reviewed_at, updated_at: now, updated_by: actorId, version: leave.version + 1 }
}

/** A blank note sends no comment. A note written with a step is shared (D-119). `acknowledged` follow D-047. */
export function toTransitionInput(
  leave: Leave,
  transition: LeaveTransition,
  note: string,
  acknowledged: readonly AvailabilityRuleId[] = [],
): TransitionLeaveInput {
  const body = optionalText(note)
  return {
    id: leave.id,
    expected_version: leave.version,
    transition,
    acknowledged_rule_ids: [...acknowledged],
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

/**
 * What the form changed, as `leaves.update` takes it (D-123): the dates and the details together. NULL when nothing
 * differs from the leave, or the form does not parse (its issues say why).
 */
export function leaveEditChanges(leave: Leave, values: LeaveEditValues & WithProperties): UpdateLeaveInput['changes'] | null {
  const reason = optionalText(values.reason)
  const changes = {
    ...(values.start_date === leave.start_date ? {} : { start_date: values.start_date }),
    ...(values.end_date === leave.end_date ? {} : { end_date: values.end_date }),
    ...(values.leave_type_id === leave.leave_type_id ? {} : { leave_type_id: values.leave_type_id }),
    ...(reason === leave.reason ? {} : { reason }),
    ...(values.properties === undefined || sameProperties(values.properties, leave.properties) ? {} : { properties: values.properties }),
  }
  if (Object.keys(changes).length === 0) return null
  const parsed = UpdateLeaveInput.shape.changes.safeParse(changes)
  return parsed.success ? parsed.data : null
}

/**
 * The codes the command answers: the schema's on the dates (D-068), and the reason the type asks for when the type
 * or the reason changes (D-117), under `changes` as the command answers them. The command stays the authority.
 */
export function leaveEditIssues(leave: Leave, values: LeaveEditValues, type: Pick<LeaveType, 'requires_reason'> | null): Issue[] {
  const dates = formIssues(UpdateLeaveInput, {
    id: leave.id,
    expected_version: leave.version,
    changes: {
      start_date: values.start_date === '' ? undefined : values.start_date,
      end_date: values.end_date === '' ? undefined : values.end_date,
      leave_type_id: values.leave_type_id,
    },
    acknowledged_rule_ids: [],
  })
  // An update may leave a date out, while the form always holds both: an empty one is missing.
  const missing: Issue[] = (["start_date", "end_date"] as const)
    .filter((column) => values[column] === "")
    .map((column) => ({ path: ["changes", column], code: IssueCode.enum.required }))
  const reason = optionalText(values.reason)
  const asked = values.leave_type_id !== leave.leave_type_id || reason !== leave.reason
  const reasonIssues = !asked || type === null ? [] : leaveReasonIssues(type, reason)
  return [...missing, ...dates, ...reasonIssues.map((issue) => ({ ...issue, path: ['changes', ...issue.path] }))]
}

/** `leaves.update` of the form's changes, or NULL when nothing changed (D-123). */
export function toUpdateLeaveInput(
  leave: Leave,
  values: LeaveEditValues & WithProperties,
  acknowledged: readonly AvailabilityRuleId[] = [],
): UpdateLeaveInput | null {
  const changes = leaveEditChanges(leave, values)
  if (changes === null) return null
  return { id: leave.id, expected_version: leave.version, changes, acknowledged_rule_ids: [...acknowledged] }
}

/**
 * The leave as the edit would leave it, as rules see it, for the live warning (D-142): with its new dates and type, and
 * pending when the edit returns it there (`editReturnsToPending`, D-064). NULL while a date is wrong.
 */
export function editedLeaveCandidate(leave: Leave, values: LeaveEditValues, returnsToPending: boolean): AvailabilityLeave | null {
  const { start_date, end_date } = values
  if (start_date === '' || end_date === '' || compareDates(start_date, end_date) > 0) return null
  const status = returnsToPending ? LeaveStatus.enum.pending : leave.status
  return { ...leave, start_date, end_date, leave_type_id: values.leave_type_id, status }
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
  const material = isMaterialLeaveUpdate(leave, {
    leave_type_id: values.leave_type_id,
    ...(values.start_date === '' ? {} : { start_date: values.start_date }),
    ...(values.end_date === '' ? {} : { end_date: values.end_date }),
  })
  const plan = planLeaveEdit(leave, { kind: 'update', material, policy, actor_can_approve: actorCanApprove }, actorId, now)
  return plan.allowed && plan.next.status === LeaveStatus.enum.pending
}

/** The permission the edit command checks. */
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

/** Any dates (D-120): a pending leave leaves the list once it is answered. */
export const PENDING_QUERY: LeaveQuery = { window: null, soldier_ids: null, statuses: [LeaveStatus.enum.pending] }

/** The closed leaves near today (D-205): the list only grows, so it reads a bounded span of dates. */
export function closedQuery(today: CalendarDate): LeaveQuery {
  return {
    window: { start_date: addDays(today, -INBOX.closedPastDays), end_date: addDays(today, INBOX.closedFutureDays) },
    soldier_ids: null,
    statuses: [LeaveStatus.enum.rejected, LeaveStatus.enum.cancelled],
  }
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

// ----------------------------------------------------------------- my requests

/** Every leave of one soldier, any dates and any status (D-167). */
export function myLeavesQuery(soldierId: SoldierId): LeaveQuery {
  return { window: null, soldier_ids: [soldierId], statuses: null }
}

export interface MyLeaves {
  /** Pending, and approved ones that have not ended, the earliest first. */
  readonly open: readonly Leave[]
  /** The rest, the last changed first. */
  readonly history: readonly Leave[]
}

function isOpen(leave: Leave, today: CalendarDate): boolean {
  if (leave.status === LeaveStatus.enum.pending) return true
  return leave.status === LeaveStatus.enum.approved && compareDates(leave.end_date, today) >= 0
}

/** The actor's own leaves in the two parts of "my requests" (D-167). */
export function myLeaveGroups(leaves: readonly Leave[], today: CalendarDate): MyLeaves {
  return {
    open: leaves
      .filter((leave) => isOpen(leave, today))
      .toSorted((a, b) => compareDates(a.start_date, b.start_date) || a.id.localeCompare(b.id)),
    history: leaves
      .filter((leave) => !isOpen(leave, today))
      .toSorted((a, b) => compareInstants(b.updated_at, a.updated_at) || a.id.localeCompare(b.id)),
  }
}

/** The soldier's next days from today, in or out by their approved leaves: "my next days" in "mine" (D-265). */
export function myNextDays(
  soldierId: SoldierId,
  leaves: readonly Leave[],
  leaveTypes: readonly LeaveType[],
  today: CalendarDate,
): readonly SoldierDay[] {
  const availability = createAvailabilityContext({ leaves, leave_types: leaveTypes })
  return Array.from({ length: MINE.nextDays }, (_, index) =>
    availability.on(soldierId, addDays(today, index), APPROVED_ONLY),
  )
}

/** How many days a leave covers, both ends included (D-012). */
export function leaveDayCount(leave: Pick<Leave, 'start_date' | 'end_date'>): number {
  return daysBetween(leave.start_date, leave.end_date) + 1
}
