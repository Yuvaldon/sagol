import { CalendarDate, type Leave, type LeaveEvent } from '@contracts'
import { useMemo } from 'react'
import type { Loaded } from '../queries/loaded'
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
