import type { CalendarDate, LeaveId } from '@contracts'
import type { BoardLeave, RoundMove } from '@logic'
import { assignLanes } from '../core/lanes'

// The person bar (the handoff's board spec, §1.10; D-480): a row's days as runs, one per leave and one per stretch on
// base or out of the unit, and the leaves the bar has no room for, in lanes below it (D-111). Pure.

export type DayState = 'off' | 'base' | 'round' | 'approved' | 'pending'

export interface Run {
  readonly key: string
  readonly state: DayState
  readonly start: number
  readonly length: number
  readonly leave: BoardLeave | null
}

export interface Placed {
  readonly leave: BoardLeave
  readonly start: number
  readonly length: number
}

/** What is drawn on a day: a request over the round, the round over the base; a marker leaves the day on base. */
function topOf(leaves: readonly BoardLeave[], day: CalendarDate): BoardLeave | null {
  const on = leaves.filter((leave) => leave.start_date <= day && leave.end_date >= day && leave.effect === 'unavailable')
  return on.find((leave) => leave.layer === 'request') ?? on.find((leave) => leave.layer === 'round') ?? null
}

/** Some days in the window, as a run of day indexes; NULL outside it. */
export function placeOf(dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate }, days: readonly CalendarDate[]): { readonly start: number; readonly length: number } | null {
  const start = days.findIndex((day) => day >= dates.start_date)
  const last = days.findLastIndex((day) => day <= dates.end_date)
  return start < 0 || last < start ? null : { start, length: last - start + 1 }
}

/**
 * The leaves the bar itself draws (D-111): of the requests, and apart of the rounds, those of the first lane, so two that
 * overlap never hide one under the other; the rest take lanes below the bar.
 */
export function barLeaves(leaves: readonly BoardLeave[], days: readonly CalendarDate[]): readonly BoardLeave[] {
  const firstLane = (layer: BoardLeave['layer']) => {
    const placed = leaves.flatMap((leave) => {
      const at = leave.effect === 'unavailable' && leave.layer === layer ? placeOf(leave, days) : null
      return at === null ? [] : [{ leave, ...at }]
    })
    const { lanes } = assignLanes(placed)
    return placed.filter((_, index) => lanes[index] === 0).map((item) => item.leave)
  }
  return [...firstLane('request'), ...firstLane('round')]
}

/**
 * How a leave is drawn: the round quiet, an approved request light, a pending one amber. A leave of the round that waits
 * because it was moved is drawn as the request it now is (OI-398).
 */
export function stateOf(leave: BoardLeave | null, moves: ReadonlyMap<LeaveId, RoundMove>): Exclude<DayState, 'off'> {
  if (leave === null) return 'base'
  if (leave.layer === 'round' && !moves.has(leave.id)) return 'round'
  return leave.status === 'pending' ? 'pending' : 'approved'
}

/** A row's days as runs: one per leave, and one per stretch on base or out of the unit. */
export function runsOf(
  days: readonly CalendarDate[],
  inScope: readonly boolean[],
  leaves: readonly BoardLeave[],
  moves: ReadonlyMap<LeaveId, RoundMove>,
): Run[] {
  const runs: Run[] = []
  days.forEach((day, index) => {
    const leave = inScope[index] === true ? topOf(leaves, day) : null
    const state: DayState = inScope[index] === true ? stateOf(leave, moves) : 'off'
    const key = leave?.id ?? state
    const last = runs.at(-1)
    if (last !== undefined && last.key === key && last.start + last.length === index) runs[runs.length - 1] = { ...last, length: last.length + 1 }
    else runs.push({ key, state, start: index, length: 1, leave })
  })
  return runs
}

/** The leaves the bar shows no run of, in lanes of their own (D-111). */
export function extraLanes(days: readonly CalendarDate[], runs: readonly Run[], leaves: readonly BoardLeave[]): readonly (readonly Placed[])[] {
  const shown = new Set(runs.flatMap((run) => (run.leave === null ? [] : [run.leave.id])))
  const placed = leaves.flatMap((leave): Placed[] => {
    const at = shown.has(leave.id) ? null : placeOf(leave, days)
    return at === null ? [] : [{ leave, ...at }]
  })
  if (placed.length === 0) return []
  const { lanes, count } = assignLanes(placed)
  return Array.from({ length: count }, (_, lane) => placed.filter((_, index) => lanes[index] === lane))
}

/**
 * Where a moved leave of the round was, while its move waits (OI-398): the days of its first place in the window that it
 * no longer covers, as runs. Empty for a leave that was not moved, or whose old days are all out of sight.
 */
export function originalPlaces(
  leaves: readonly BoardLeave[],
  days: readonly CalendarDate[],
  moves: ReadonlyMap<LeaveId, RoundMove>,
): readonly { readonly key: string; readonly start: number; readonly length: number }[] {
  return leaves.flatMap((leave) => {
    const move = moves.get(leave.id)
    if (move === undefined) return []
    const left = days.map((day) => day >= move.from.start_date && day <= move.from.end_date && !(day >= leave.start_date && day <= leave.end_date))
    const places: { key: string; start: number; length: number }[] = []
    left.forEach((flag, index) => {
      const last = places.at(-1)
      if (!flag) return
      if (last !== undefined && last.start + last.length === index) last.length += 1
      else places.push({ key: `${leave.id}:${String(index)}`, start: index, length: 1 })
    })
    return places
  })
}
