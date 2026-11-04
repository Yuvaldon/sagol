import { parseAbsolute, toCalendarDate } from '@internationalized/date'
import type { CalendarDate, Timestamp } from '@contracts'

// Calendar and instant arithmetic shared by every domain module (D-035, D-042).
// Domain never reads a clock: callers pass `today` and `now` (D-053).

/** Zone used only to compare instants; the result does not depend on it. */
const INSTANT_COMPARISON_ZONE = 'UTC'

/** The moment a domain evaluation runs at, as the caller observed it. */
export interface Clock {
  /** Today in the organization time zone. */
  readonly today: CalendarDate
  readonly now: Timestamp
}

/** Today's calendar date in `timezone` (IANA) at the instant `now`. */
export function todayIn(timezone: string, now: Timestamp): CalendarDate {
  return toCalendarDate(parseAbsolute(now, timezone)).toString()
}

/** A clock for an organization: `today` is derived from `now` in its time zone. */
export function clockAt(timezone: string, now: Timestamp): Clock {
  return { today: todayIn(timezone, now), now }
}

/** ISO calendar dates order lexically (D-042). Negative, zero or positive. */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Compares two ISO 8601 instants with any offsets. Negative, zero or positive. */
export function compareInstants(a: Timestamp, b: Timestamp): number {
  const difference = parseAbsolute(a, INSTANT_COMPARISON_ZONE).compare(
    parseAbsolute(b, INSTANT_COMPARISON_ZONE),
  )
  return Math.sign(difference)
}

/** Inclusive calendar range; NULL `valid_to` is open-ended. */
export interface DateSpan {
  readonly valid_from: CalendarDate
  readonly valid_to: CalendarDate | null
}

/** True when `date` lies inside the inclusive span. */
export function spanCovers(span: DateSpan, date: CalendarDate): boolean {
  if (compareDates(span.valid_from, date) > 0) return false
  return span.valid_to === null || compareDates(date, span.valid_to) <= 0
}

/** True when two inclusive spans share at least one day. */
export function spansOverlap(a: DateSpan, b: DateSpan): boolean {
  const aStartsBeforeBEnds = b.valid_to === null || compareDates(a.valid_from, b.valid_to) <= 0
  const bStartsBeforeAEnds = a.valid_to === null || compareDates(b.valid_from, a.valid_to) <= 0
  return aStartsBeforeBEnds && bStartsBeforeAEnds
}

/** Half-open instant window `[valid_from, valid_to)`; NULL `valid_to` is open-ended. */
export interface InstantWindow {
  readonly valid_from: Timestamp
  readonly valid_to: Timestamp | null
}

/** True when `now` lies inside the window. */
export function windowContains(window: InstantWindow, now: Timestamp): boolean {
  if (compareInstants(window.valid_from, now) > 0) return false
  return window.valid_to === null || compareInstants(now, window.valid_to) < 0
}
