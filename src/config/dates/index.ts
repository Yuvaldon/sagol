// Date display settings (D-074). Stored dates are ISO strings (D-042); these only shape how
// they are shown. The organization time zone comes from its settings, not from here.

export const DATE_LOCALE = 'he-IL'

/** First day of the week in calendars and timelines: 0 = Sunday ... 6 = Saturday. */
export const FIRST_DAY_OF_WEEK = 0

/** `Intl.DateTimeFormat` options for each way a date is shown. */
export const DATE_FORMATS = {
  /** Day of month only. */
  day: { day: 'numeric' },
  /** Short weekday name. */
  weekdayShort: { weekday: 'short' },
  /** Day and short month name. */
  dayMonth: { day: 'numeric', month: 'short' },
  /** Long month name and year. */
  monthYear: { month: 'long', year: 'numeric' },
  /** All-numeric day, month and year. */
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  /** Long weekday, day, month and year. */
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateFormat = keyof typeof DATE_FORMATS
