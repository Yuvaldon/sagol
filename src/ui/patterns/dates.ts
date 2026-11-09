import { DATE_FORMATS, DATE_LOCALE, type DateFormat } from '@config'
import type { CalendarDate } from '@contracts'
import { DateFormatter, parseDate } from '@internationalized/date'

// A stored day as text (D-042, D-074). A calendar day has no time zone, so it is read and written in
// the same one, and the day never shifts.

const NEUTRAL_ZONE = 'UTC'

export function formatDate(date: CalendarDate, format: DateFormat = 'numeric'): string {
  const formatter = new DateFormatter(DATE_LOCALE, { ...DATE_FORMATS[format], timeZone: NEUTRAL_ZONE })
  return formatter.format(parseDate(date).toDate(NEUTRAL_ZONE))
}
