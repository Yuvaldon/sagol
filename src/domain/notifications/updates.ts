import {
  CommentVisibility,
  type Leave,
  type LeaveComment,
  type LeaveCommentId,
  type LeaveEvent,
  type LeaveEventId,
  type LeaveEventType,
  type LeaveId,
  type SoldierId,
  type Timestamp,
} from '@contracts'
import { compareInstants } from '../time'

// What is news to a soldier (D-350): what others did on their own leaves, derived from the events and the shared
// comments, never stored. Only the time the soldier last looked is stored, in their preferences.

/** What happened in one update: an event of the leave's history, or a shared comment. */
export type UpdateKind = LeaveEventType | 'comment'

export interface LeaveUpdate {
  /** The event's or the comment's id. */
  readonly id: LeaveEventId | LeaveCommentId
  readonly leave_id: LeaveId
  /** Who did it: the event's actor or the comment's author, never the soldier. */
  readonly actor_id: SoldierId
  readonly kind: UpdateKind
  readonly created_at: Timestamp
}

export interface UpdateSources {
  readonly leaves: Iterable<Pick<Leave, 'id' | 'soldier_id'>>
  readonly events: Iterable<LeaveEvent>
  readonly comments: Iterable<LeaveComment>
}

/** The soldier's updates since `since`, newest first (D-350). Internal comments never are news. */
export function updatesFor(soldierId: SoldierId, sources: UpdateSources, since: Timestamp): LeaveUpdate[] {
  const mine = new Set<LeaveId>()
  for (const leave of sources.leaves) if (leave.soldier_id === soldierId) mine.add(leave.id)
  const recent = (createdAt: Timestamp) => compareInstants(createdAt, since) >= 0
  const updates: LeaveUpdate[] = []
  for (const event of sources.events) {
    if (!mine.has(event.leave_id) || event.actor_id === soldierId || !recent(event.created_at)) continue
    updates.push({
      id: event.id,
      leave_id: event.leave_id,
      actor_id: event.actor_id,
      kind: event.event_type,
      created_at: event.created_at,
    })
  }
  for (const comment of sources.comments) {
    if (!mine.has(comment.leave_id) || comment.author_id === soldierId || !recent(comment.created_at)) continue
    if (comment.visibility !== CommentVisibility.enum.shared || comment.archived_at !== null) continue
    updates.push({
      id: comment.id,
      leave_id: comment.leave_id,
      actor_id: comment.author_id,
      kind: 'comment',
      created_at: comment.created_at,
    })
  }
  return updates.sort((a, b) => compareInstants(b.created_at, a.created_at) || (a.id < b.id ? -1 : 1))
}

/** Unread: newer than the time the soldier last looked; NULL, they never looked, so everything is (D-350). */
export function isUnread(update: Pick<LeaveUpdate, 'created_at'>, seenAt: Timestamp | null): boolean {
  return seenAt === null || compareInstants(update.created_at, seenAt) > 0
}

export function unreadCount(updates: readonly Pick<LeaveUpdate, 'created_at'>[], seenAt: Timestamp | null): number {
  return updates.filter((update) => isUnread(update, seenAt)).length
}
