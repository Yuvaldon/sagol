import type { Leave, LeaveComment, LeaveEvent, LeaveFeedQuery, Result, SoldierPreferencesRecord, Timestamp } from '@contracts'
import { NOTIFICATIONS } from '@config'
import { addDays, compareInstants, isUnread, startOfDay, unreadCount, updatesFor, type LeaveUpdate } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { QUERY_KEYS } from '../queries/client'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { useMyPreferences, useUpdateMyPreferences } from '../session/preferences'
import { useTimezone, useToday } from '../session/today'
import { useActor, useMyLeaveRows } from './workflowHooks'

// "עדכונים" on שלי (D-352, D-356): what others did on the soldier's own leaves in the window, and what is unread.

export interface MyUpdateLine {
  readonly update: LeaveUpdate
  readonly leave: Leave
  readonly unread: boolean
}

export interface MyUpdates {
  /** Newest first. */
  readonly lines: readonly MyUpdateLine[]
  readonly unread: number
  /** The newest update's time: opening the section marks up to it seen. NULL when there are none. */
  readonly newest: Timestamp | null
}

const NO_LINES: MyUpdates = { lines: [], unread: 0, newest: null }

/** The start of the window: the organization's day `updatesDays` before today. */
function useWindowStart(): Timestamp | null {
  const today = useToday()
  const timezone = useTimezone()
  return today === null || timezone === null ? null : startOfDay(addDays(today, -NOTIFICATIONS.updatesDays), timezone)
}

function useFeed(query: LeaveFeedQuery | null) {
  const { data } = usePorts()
  const events: Loaded<readonly LeaveEvent[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveEvents, { feed: query }],
      queryFn: (): Promise<readonly LeaveEvent[]> => (query === null ? Promise.resolve([]) : unwrap(data.repositories.leave_events.feed(query))),
      enabled: query !== null,
    }),
  )
  const comments: Loaded<readonly LeaveComment[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveComments, { feed: query }],
      queryFn: (): Promise<readonly LeaveComment[]> =>
        query === null ? Promise.resolve([]) : unwrap(data.repositories.leave_comments.feed(query)),
      enabled: query !== null,
    }),
  )
  return { events, comments }
}

/** The actor's updates; NULL when the actor is not linked. */
export function useMyUpdates(): Loaded<MyUpdates> | null {
  const actor = useActor()
  const since = useWindowStart()
  const soldierId = actor?.soldier_id ?? null
  const query = useMemo(() => (soldierId === null || since === null ? null : { soldier_id: soldierId, since }), [soldierId, since])
  const leaves = useMyLeaveRows()
  const { events, comments } = useFeed(query)
  const preferences = useMyPreferences()
  return useMemo((): Loaded<MyUpdates> | null => {
    if (soldierId === null) return null
    if (query === null) return { status: 'loading' }
    if (leaves.status !== 'ready') return leaves
    if (events.status !== 'ready') return events
    if (comments.status !== 'ready') return comments
    if (preferences.status !== 'ready') return preferences
    const byId = new Map(leaves.value.map((leave) => [leave.id, leave]))
    const updates = updatesFor(soldierId, { leaves: leaves.value, events: events.value, comments: comments.value }, query.since)
    if (updates.length === 0) return { status: 'ready', value: NO_LINES }
    const seenAt = preferences.value.updates_seen_at
    const lines = updates.flatMap((update): MyUpdateLine[] => {
      const leave = byId.get(update.leave_id)
      return leave === undefined ? [] : [{ update, leave, unread: isUnread(update, seenAt) }]
    })
    return {
      status: 'ready',
      value: { lines, unread: unreadCount(lines.map((line) => line.update), seenAt), newest: updates[0]?.created_at ?? null },
    }
  }, [soldierId, query, leaves, events, comments, preferences])
}

/**
 * Marks the updates up to `newest` seen (D-352). A save that met another device's save is tried once more over the
 * row as stored; a time that is not newer than the stored one saves nothing.
 */
export function useMarkUpdatesSeen(): (newest: Timestamp) => Promise<Result<SoldierPreferencesRecord> | null> {
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const seenAt = preferences.status === 'ready' ? preferences.value.updates_seen_at : null
  const ready = preferences.status === 'ready'
  const { run } = save
  return useCallback(
    async (newest) => {
      if (!ready || (seenAt !== null && compareInstants(newest, seenAt) <= 0)) return null
      const first = await run({ updates_seen_at: newest })
      if (first.ok || first.error.code !== 'stale_version') return first
      return run({ updates_seen_at: newest })
    },
    [ready, seenAt, run],
  )
}
