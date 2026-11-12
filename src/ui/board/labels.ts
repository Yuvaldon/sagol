import type { BarColorMode } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { dayRangeOf, type BoardGroupLabel, type BoardLeave } from '@logic'
import { formatDate, formatDateRange } from '../patterns/dates'
import { UNIT_STATE_KEYS } from '../patterns/units'
import { MARKER_TONE, UNIFORM_TONE, toneOf, type PaletteTone } from '../theme/palette'

// How every engine names what the board model holds (D-174): a group, a leave, its days and its color, so the timeline,
// the list, the table and the calendar read the same words. Pure.

/** How a path below the selected unit is written: `מחלקה א · כיתה 1` (D-105). */
const PATH_SEPARATOR = ' · '
export const TEXT_SEPARATOR = ', '

export function groupLabel(label: BoardGroupLabel): string {
  return label.kind === 'unit' ? label.path.join(PATH_SEPARATOR) : t(UNIT_STATE_KEYS[label.kind])
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
  const parts = [
    typeName(leave),
    ...(leave.effect === 'available' ? [t('leaves.marker')] : []),
    statusText(leave),
    rangeText(leave.start_date, leave.end_date),
  ]
  return parts.join(TEXT_SEPARATOR)
}

/** What a leave's color means (D-111, D-112): its type, or one color for every absence and one for every marker. */
export function leaveTone(leave: BoardLeave, mode: BarColorMode): PaletteTone {
  if (mode === 'uniform') return leave.effect === 'available' ? MARKER_TONE : UNIFORM_TONE
  return toneOf(leave.type?.color_key ?? null)
}

/** How many days a leave holds, both ends counted. */
export function leaveDays(leave: BoardLeave): number {
  return dayRangeOf(leave.start_date, leave).end + 1
}
