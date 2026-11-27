import type { CalendarDate } from '@contracts'
import { formatDate } from '../patterns/dates'

/** The board's title (the handoff's board spec, §2): the month's name; another year's month names its year too. */
export function monthTitle(month: CalendarDate, today: CalendarDate | null): string {
  return today !== null && today.slice(0, 4) === month.slice(0, 4) ? formatDate(month, 'month') : formatDate(month, 'monthYear')
}
