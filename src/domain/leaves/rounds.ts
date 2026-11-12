import type { CalendarDate } from '@contracts'
import { addDays, compareDates } from '../time'

// The leave-round planner's rhythm (D-270, D-286): days in, then days home, over and over. Pure.

/** Whole days, both at least one: a rhythm with no day in or no day home is no rhythm. */
export interface RoundRhythm {
  readonly days_in: number
  readonly days_home: number
}

/** Inclusive days, as a leave's. */
export interface LeaveDays {
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
}

/**
 * The stretches home of a rhythm: `days_home` days from `firstHome`, then again every `days_in + days_home` days, each
 * cut to `within` and dropped when nothing of it is left. Nothing is planned before `firstHome`; a rhythm that is not
 * whole positive days plans nothing.
 */
export function roundDays(rhythm: RoundRhythm, firstHome: CalendarDate, within: LeaveDays): LeaveDays[] {
  const { days_in, days_home } = rhythm
  if (!Number.isInteger(days_in) || !Number.isInteger(days_home) || days_in < 1 || days_home < 1) return []
  const days: LeaveDays[] = []
  for (let start = firstHome; compareDates(start, within.end_date) <= 0; start = addDays(start, days_in + days_home)) {
    const end = addDays(start, days_home - 1)
    if (compareDates(end, within.start_date) < 0) continue
    days.push({
      start_date: compareDates(start, within.start_date) < 0 ? within.start_date : start,
      end_date: compareDates(end, within.end_date) > 0 ? within.end_date : end,
    })
  }
  return days
}
