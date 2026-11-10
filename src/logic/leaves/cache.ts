import { LeaveQuery, type Leave, type LeaveId } from '@contracts'
import { compareDates } from '@domain'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { QUERY_KEYS } from '../queries/client'

// The cached answers that hold leaves, for optimistic updates (D-115, D-119). A list is keyed by its query and
// one leave by its id, both under the table's key, so the change feed refreshes them together.

export function leaveListKey(query: LeaveQuery): QueryKey {
  return [...QUERY_KEYS.leaves, query]
}

export function leaveKey(id: LeaveId): QueryKey {
  return [...QUERY_KEYS.leaves, { id }]
}

/** The query a cached list of leaves asked for, read back from its key. NULL for the key of one leave. */
function queryOfKey(key: QueryKey): LeaveQuery | null {
  const parsed = LeaveQuery.safeParse(key[QUERY_KEYS.leaves.length])
  return parsed.success ? parsed.data : null
}

/** Whether the list a query asked for holds this leave: its dates, its soldier and its status. */
function listHolds(query: LeaveQuery, leave: Leave): boolean {
  const { window } = query
  const inWindow =
    window === null ||
    (compareDates(leave.start_date, window.end_date) <= 0 && compareDates(window.start_date, leave.end_date) <= 0)
  return (
    inWindow &&
    (query.soldier_ids === null || query.soldier_ids.includes(leave.soldier_id)) &&
    (query.statuses === null || query.statuses.includes(leave.status))
  )
}

/** Everything cached about leaves, to put back when a command refuses. */
export type CachedLeaves = readonly (readonly [QueryKey, unknown])[]

export function cachedLeaves(client: QueryClient): CachedLeaves {
  return client.getQueriesData({ queryKey: QUERY_KEYS.leaves })
}

export function restoreLeaves(client: QueryClient, previous: CachedLeaves): void {
  for (const [key, data] of previous) client.setQueryData(key, data)
}

/**
 * Shows a leave as a command will write it, before the command answers: in every cached list that would hold it,
 * out of every list that no longer does, and as the cached leave of its id.
 */
export function showLeave(client: QueryClient, leave: Leave): void {
  for (const [key, data] of cachedLeaves(client)) {
    const query = queryOfKey(key)
    if (query === null || !Array.isArray(data)) continue
    const rows: readonly Leave[] = data
    const others = rows.filter((row) => row.id !== leave.id)
    client.setQueryData<readonly Leave[]>(key, listHolds(query, leave) ? [...others, leave] : others)
  }
  if (client.getQueryData(leaveKey(leave.id)) !== undefined) client.setQueryData(leaveKey(leave.id), leave)
}
