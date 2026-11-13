import type { CalendarDate } from '@contracts'
import { startOfWeek } from '../time'

// Counting a soldier's days over a span (D-349): served, base, home and outside days. Derived, never stored (D-019).

/** One soldier's days over a span: every day is outside, or served, and a served day is a base or a home day. */
export interface DaysTally {
  /** Days the soldier serves in the span. */
  readonly served: number
  /** Served days that are not home days: on base, or on a leave of an available type. */
  readonly base: number
  /** Served days at home: covered by a counted leave (D-012, D-032). One day counts once. */
  readonly home: number
  /** Span days the soldier does not serve: shown, never counted. */
  readonly outside: number
}

/** The tally of `days`: `serves` says whether the soldier serves on a day, `home` whether they are away on it. */
export function daysTally(
  days: readonly CalendarDate[],
  serves: (day: CalendarDate) => boolean,
  home: (day: CalendarDate) => boolean,
): DaysTally {
  let served = 0
  let away = 0
  for (const day of days) {
    if (!serves(day)) continue
    served += 1
    if (home(day)) away += 1
  }
  return { served, base: served - away, home: away, outside: days.length - served }
}

/** The fewest, the median and the most of a set of figures. */
export interface Spread {
  readonly min: number
  readonly median: number
  readonly max: number
}

/** The spread of `values`; null when there is none. An even count takes the mean of the two middle figures. */
export function spreadOf(values: readonly number[]): Spread | null {
  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted.at(0)
  const max = sorted.at(-1)
  if (min === undefined || max === undefined) return null
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? max
  const median = sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? min) + upper) / 2
  return { min, median, max }
}

/** `days` split into calendar weeks starting on `firstDayOfWeek` (0 = Sunday); the first and last may be partial. */
export function weeksOf(days: readonly CalendarDate[], firstDayOfWeek: number): CalendarDate[][] {
  const weeks: CalendarDate[][] = []
  let current: CalendarDate | null = null
  let week: CalendarDate[] = []
  for (const day of days) {
    const start = startOfWeek(day, firstDayOfWeek)
    if (start !== current) {
      week = []
      weeks.push(week)
      current = start
    }
    week.push(day)
  }
  return weeks
}
