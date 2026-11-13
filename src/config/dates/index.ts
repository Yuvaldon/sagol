// Date display settings (D-074). Stored dates are ISO strings (D-042); these only shape how
// they are shown. The organization time zone comes from its settings, not from here.

export const DATE_LOCALE = 'he-IL'

/**
 * The zone a calendar date (a day with no time, D-042) is formatted in: a fixed one, so the day shown is the day
 * stored wherever the device is.
 */
export const CALENDAR_DATE_ZONE = 'UTC'

/** First day of the week in calendars and timelines: 0 = Sunday ... 6 = Saturday. */
export const FIRST_DAY_OF_WEEK = 0

/** `Intl.DateTimeFormat` options for each way a date is shown. */
export const DATE_FORMATS = {
  /** Day of month only. */
  day: { day: 'numeric' },
  /** Short weekday name. */
  weekdayShort: { weekday: 'short' },
  /** The shortest weekday name, a letter in Hebrew (א׳), for the days header of the timeline. */
  weekdayNarrow: { weekday: 'narrow' },
  /** Day and short month name. */
  dayMonth: { day: 'numeric', month: 'short' },
  /** Long month name and year. */
  monthYear: { month: 'long', year: 'numeric' },
  /** All-numeric day, month and year. */
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  /** Long weekday, day, month and year. */
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  /** Day, short month and the time of day, for a moment in a leave's history (D-119). */
  dayMonthTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateFormat = keyof typeof DATE_FORMATS

/** The longest delay `setTimeout` keeps (2^31 − 1 ms); a later boundary waits in steps of it (D-169). */
export const MAX_TIMER_DELAY_MS = 2_147_483_647
