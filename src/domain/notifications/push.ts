import {
  CommentVisibility,
  LeaveStatus,
  NotificationKind,
  PushOutcome,
  type Leave,
  type LeaveComment,
  type LeaveEvent,
  type LeaveEventType,
  type LeaveId,
  type PushPayload,
  type SoldierId,
} from '@contracts'
import { holdersOf, soldierTarget, type PolicyContext } from '../policy'

// Who gets a push for one committed command (D-355): pure, over what the command wrote and the committed snapshot's
// policy. One push per recipient and kind, however many leaves the command touched.

/** What one command wrote that may be news: its new events and comments, and the leaves they are on. */
export interface PushCommandEffect {
  readonly actorId: SoldierId
  readonly leaves: ReadonlyMap<LeaveId, Pick<Leave, 'id' | 'soldier_id' | 'start_date' | 'end_date'>>
  readonly events: readonly LeaveEvent[]
  readonly comments: readonly LeaveComment[]
}

export interface PushAudience {
  readonly policy: PolicyContext
  /** The soldier's own choice for the kind (D-358). */
  readonly wants: (soldierId: SoldierId, kind: NotificationKind) => boolean
  /** Soldiers with at least one subscription. */
  readonly subscribed: ReadonlySet<SoldierId>
}

export type PushRecipient =
  | {
      readonly soldier_id: SoldierId
      readonly kind: typeof NotificationKind.enum.my_request
      /** What happened to the first leave. */
      readonly outcome: PushOutcome
      /** The leaves of the command for this recipient, in the order written; the push describes the first. */
      readonly leave_ids: readonly LeaveId[]
    }
  | {
      readonly soldier_id: SoldierId
      readonly kind: typeof NotificationKind.enum.awaiting_me
      readonly leave_ids: readonly LeaveId[]
    }

/** The events that tell the leave's soldier something; a details-only `updated` does not (D-355). */
const OUTCOME_OF_EVENT: Readonly<Partial<Record<LeaveEventType, PushOutcome>>> = {
  approved: PushOutcome.enum.approved,
  rejected: PushOutcome.enum.rejected,
  cancelled: PushOutcome.enum.cancelled,
  reopened: PushOutcome.enum.reopened,
  rescheduled: PushOutcome.enum.rescheduled,
}

const APPROVE = { resource: 'leaves', action: 'approve' } as const

export function pushRecipients(effect: PushCommandEffect, audience: PushAudience): PushRecipient[] {
  const mine = new Map<SoldierId, { outcome: PushOutcome; leave_ids: LeaveId[] }>()
  const awaiting = new Map<SoldierId, LeaveId[]>()
  const approversOf = new Map<SoldierId, SoldierId[]>()

  const tell = (soldierId: SoldierId, leaveId: LeaveId, outcome: PushOutcome) => {
    if (soldierId === effect.actorId) return
    const entry = mine.get(soldierId)
    if (entry === undefined) mine.set(soldierId, { outcome, leave_ids: [leaveId] })
    else if (!entry.leave_ids.includes(leaveId)) entry.leave_ids.push(leaveId)
  }
  const ask = (leave: Pick<Leave, 'id' | 'soldier_id'>) => {
    let approvers = approversOf.get(leave.soldier_id)
    if (approvers === undefined) {
      approvers = holdersOf(audience.policy, APPROVE, soldierTarget(leave.soldier_id))
      approversOf.set(leave.soldier_id, approvers)
    }
    for (const approver of approvers) {
      if (approver === effect.actorId || approver === leave.soldier_id) continue
      const leaveIds = awaiting.get(approver)
      if (leaveIds === undefined) awaiting.set(approver, [leave.id])
      else if (!leaveIds.includes(leave.id)) leaveIds.push(leave.id)
    }
  }

  for (const event of effect.events) {
    const leave = effect.leaves.get(event.leave_id)
    if (leave === undefined || event.actor_id !== effect.actorId) continue
    if (event.event_type === 'created') {
      if (event.to_status === LeaveStatus.enum.pending) ask(leave)
      else if (event.to_status === LeaveStatus.enum.approved) tell(leave.soldier_id, leave.id, PushOutcome.enum.created)
      continue
    }
    const outcome = OUTCOME_OF_EVENT[event.event_type]
    if (outcome !== undefined) tell(leave.soldier_id, leave.id, outcome)
  }
  // A new comment only: an edit or an archive of one is not news (D-355).
  for (const comment of effect.comments) {
    const leave = effect.leaves.get(comment.leave_id)
    if (leave === undefined || comment.author_id !== effect.actorId) continue
    if (comment.visibility !== CommentVisibility.enum.shared || comment.edited_at !== null || comment.archived_at !== null) continue
    tell(leave.soldier_id, leave.id, PushOutcome.enum.comment)
  }

  const reaches = (soldierId: SoldierId, kind: NotificationKind) =>
    audience.subscribed.has(soldierId) && audience.wants(soldierId, kind)
  const recipients: PushRecipient[] = []
  for (const [soldierId, entry] of mine) {
    if (reaches(soldierId, NotificationKind.enum.my_request))
      recipients.push({ soldier_id: soldierId, kind: NotificationKind.enum.my_request, ...entry })
  }
  for (const [soldierId, leaveIds] of awaiting) {
    if (reaches(soldierId, NotificationKind.enum.awaiting_me))
      recipients.push({ soldier_id: soldierId, kind: NotificationKind.enum.awaiting_me, leave_ids: leaveIds })
  }
  return recipients
}

/** The push for one recipient, about the first of its leaves (D-357). `soldierName` is that leave's soldier's. */
export function pushPayloadOf(
  recipient: PushRecipient,
  leave: Pick<Leave, 'id' | 'start_date' | 'end_date'>,
  soldierName: string,
): PushPayload {
  const common = {
    leave_id: leave.id,
    count: recipient.leave_ids.length,
    start_date: leave.start_date,
    end_date: leave.end_date,
  }
  return recipient.kind === NotificationKind.enum.my_request
    ? { kind: recipient.kind, outcome: recipient.outcome, ...common }
    : { kind: recipient.kind, soldier_name: soldierName, ...common }
}
