import { CalendarDate, type Leave, type LeaveEvent, type LeaveId } from '@contracts'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { QUERY_KEYS } from '../queries/client'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import type { LeaveDates } from '../timeline/editing'
import { useLeaveThread } from './workflowHooks'

// Moving a leave out of the leave round (the handoff's `02`, "Moving a leave out of the leave round"; OI-394, D-480). A
// move is an edit of the leave's dates; its thread keeps the dates the round gave it, so nothing new is stored (D-019).
// Pure first, then the hook.

/** A leave of the round whose dates were changed: where the round put it, and where it is now. */
export interface RoundMove {
  readonly from: LeaveDates
  readonly to: LeaveDates
}

const START = 'start_date'
const END = 'end_date'

function dayOf(value: unknown): CalendarDate | null {
  const parsed = CalendarDate.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Where a leave of the round was first put and where it is now; NULL for a request, or for a round leave that is where
 * the round put it. The first change of each date in the thread holds its earlier value.
 */
export function leaveMoveOf(leave: Pick<Leave, 'batch_id' | 'start_date' | 'end_date'>, events: readonly LeaveEvent[]): RoundMove | null {
  if (leave.batch_id === null) return null
  const ordered = events.toSorted((a, b) => a.change_seq - b.change_seq)
  const first = (column: string) => dayOf(ordered.find((event) => event.changes[column] !== undefined)?.changes[column]?.before)
  const from = { start_date: first(START) ?? leave.start_date, end_date: first(END) ?? leave.end_date }
  if (from.start_date === leave.start_date && from.end_date === leave.end_date) return null
  return { from, to: { start_date: leave.start_date, end_date: leave.end_date } }
}

/** The move of a leave, from its thread; NULL while there is none. */
export function useLeaveMove(leave: Leave): Loaded<RoundMove | null> {
  const thread = useLeaveThread(leave.id)
  return useMemo((): Loaded<RoundMove | null> => {
    if (leave.batch_id === null) return { status: 'ready', value: null }
    if (thread.status !== 'ready') return thread
    const events = thread.value.flatMap((entry) => (entry.kind === 'event' ? [entry.event] : []))
    return { status: 'ready', value: leaveMoveOf(leave, events) }
  }, [leave, thread])
}

const NO_MOVES: ReadonlyMap<LeaveId, RoundMove> = new Map()

/** The leaves of the round among `leaves` that wait: only a move of one of them is drawn where it came from (OI-398). */
export function waitingRoundLeaves(leaves: readonly Leave[]): readonly Leave[] {
  return leaves.filter((leave) => leave.batch_id !== null && leave.status === 'pending')
}

/** The moves of the waiting leaves of the round, each from its own thread; a leave where the round put it has none. */
export function roundMovesOf(leaves: readonly Leave[], events: readonly LeaveEvent[]): ReadonlyMap<LeaveId, RoundMove> {
  const byLeave = new Map<LeaveId, LeaveEvent[]>()
  for (const event of events) byLeave.set(event.leave_id, [...(byLeave.get(event.leave_id) ?? []), event])
  const moves = new Map<LeaveId, RoundMove>()
  for (const leave of waitingRoundLeaves(leaves)) {
    const move = leaveMoveOf(leave, byLeave.get(leave.id) ?? [])
    if (move !== null) moves.set(leave.id, move)
  }
  return moves
}

/**
 * The moves of the round's leaves that wait among `leaves` (OI-398): the board draws where each came from while its move
 * waits. One read of their events; none while there is nothing to read, and none until the answer is in.
 */
export function useRoundMoves(leaves: readonly Leave[]): ReadonlyMap<LeaveId, RoundMove> {
  const { data } = usePorts()
  const waiting = useMemo(() => waitingRoundLeaves(leaves), [leaves])
  const query = useMemo(() => (waiting.length === 0 ? null : { leave_ids: waiting.map((leave) => leave.id).toSorted(), after_seq: 0 }), [waiting])
  const events: Loaded<readonly LeaveEvent[]> = loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.leaveEvents, query],
      queryFn: () => (query === null ? Promise.resolve([]) : unwrap(data.repositories.leave_events.list(query))),
    }),
  )
  return useMemo(() => (events.status === 'ready' ? roundMovesOf(waiting, events.value) : NO_MOVES), [events, waiting])
}
