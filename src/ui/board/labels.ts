import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { dayRangeOf, leaveDayCount, type BoardGroupLabel, type BoardHeading, type BoardLeave } from '@logic'
import { formatDate, formatDateRange } from '../patterns/dates'
import { UNIT_STATE_KEYS } from '../patterns/units'

// How every engine names what the board model holds (D-174): a group, a leave, its days and its color, so the timeline,
// the list, the table and the calendar read the same words. Pure.

/** How a path below the selected unit is written: `מחלקה א · כיתה 1` (D-105). */
const PATH_SEPARATOR = ' · '
export const TEXT_SEPARATOR = ', '

export function groupLabel(label: BoardGroupLabel): string {
  return label.kind === 'unit' ? label.path.join(PATH_SEPARATOR) : t(UNIT_STATE_KEYS[label.kind])
}

/** A group header of the board, whatever groups it (D-452): a unit, a rank or a tag, or what holds none. */
export function headingLabel(label: BoardHeading): string {
  switch (label.kind) {
    case 'rank':
      return label.title
    case 'noRank':
      return t('workspace.groupNoRank')
    case 'tag':
      return label.name
    case 'noTag':
      return `${t('workspace.groupWithout')} ${label.category}`
    default:
      return groupLabel(label)
  }
}

/** One day, or a range of days, the way the locale writes it. */
export function rangeText(first: CalendarDate, last: CalendarDate): string {
  return first === last ? formatDate(first, 'dayMonth') : formatDateRange(first, last)
}

export function typeName(leave: BoardLeave): string {
  return leave.type?.name ?? t('leaves.unknownType')
}

export function statusText(leave: BoardLeave): string {
  return t(leave.status === 'approved' ? 'leaves.statusApproved' : 'leaves.statusPending')
}

/** A leave's name: the type, marker or absence, the status, and the days of the leave itself. */
export function leaveText(leave: BoardLeave): string {
  return [typeName(leave), ...leaveDetails(leave), rangeText(leave.start_date, leave.end_date)].join(TEXT_SEPARATOR)
}

/** What a leave's name says between its type and its days: marker or absence, and the status. */
export function leaveDetails(leave: BoardLeave): readonly string[] {
  return [...(leave.effect === 'available' ? [t('leaves.marker')] : []), statusText(leave)]
}

/** How many days a leave holds, both ends counted. */
export function leaveDays(leave: BoardLeave): number {
  return dayRangeOf(leave.start_date, leave).end + 1
}

/** How many days, in words: "יום אחד", "3 ימים". */
export function daysText(dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate }): string {
  const count = leaveDayCount(dates)
  return count === 1 ? t('leaves.oneDay') : [String(count), t('leaves.days')].join(' ')
}
