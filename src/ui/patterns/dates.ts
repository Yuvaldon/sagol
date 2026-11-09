import { DATE_FORMATS, DATE_LOCALE, type DateFormat } from '@config'
import type { CalendarDate } from '@contracts'
import { DateFormatter, parseDate } from '@internationalized/date'

// A stored day as text (D-042, D-074). A calendar day has no time zone, so it is read and written in
// the same one, and the day never shifts.

const NEUTRAL_ZONE = 'UTC'

function formatterOf(format: DateFormat): DateFormatter {
  return new DateFormatter(DATE_LOCALE, { ...DATE_FORMATS[format], timeZone: NEUTRAL_ZONE })
}

export function formatDate(date: CalendarDate, format: DateFormat = 'numeric'): string {
  return formatterOf(format).format(parseDate(date).toDate(NEUTRAL_ZONE))
}

/** Two stored days as one range, the way the locale writes it (`8–14 בנוב׳`). */
export function formatDateRange(from: CalendarDate, to: CalendarDate, format: DateFormat = 'dayMonth'): string {
  return formatterOf(format).formatRange(parseDate(from).toDate(NEUTRAL_ZONE), parseDate(to).toDate(NEUTRAL_ZONE))
}
