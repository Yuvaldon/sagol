import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { fullName, type TimelineGroupLabel, type TimelineItem } from '@logic'
import { formatDate, formatDateRange } from '../../../patterns/dates'
import { UNIT_STATE_KEYS } from '../../../patterns/units'
import { spansOf } from '../core/layout'
import type { TimelineDayCell, TimelineRowModel } from '../view/model'

// The translation from the domain to the neutral model of the view: soldiers become rows, units become
// group headers, and days become header cells (ARCHITECTURE "View engines"). Pure.

/** How a path below the selected unit is written: `מחלקה א · כיתה 1` (D-105). */
const PATH_SEPARATOR = ' · '

function groupLabel(label: TimelineGroupLabel): string {
  return label.kind === 'unit' ? label.path.join(PATH_SEPARATOR) : t(UNIT_STATE_KEYS[label.kind])
}

export function dayCells(days: readonly CalendarDate[], today: CalendarDate): TimelineDayCell[] {
  return days.map((day) => ({
    key: day,
    weekday: formatDate(day, 'weekdayNarrow'),
    dayNumber: formatDate(day, 'day'),
    isToday: day === today,
  }))
}

/** The muted days of a row, read aloud as ranges of dates. */
function offTextOf(days: readonly CalendarDate[], offDays: readonly boolean[]): string | null {
  const ranges = spansOf(offDays, true).map((span) => {
    const first = days[span.start]
    const last = days[span.start + span.length - 1]
    if (first === undefined || last === undefined) return ''
    return first === last ? formatDate(first, 'dayMonth') : formatDateRange(first, last)
  })
  return ranges.length === 0 ? null : `${t('timeline.outOfScope')}: ${ranges.join(', ')}`
}

export function timelineRows(
  items: readonly TimelineItem[],
  days: readonly CalendarDate[],
  open: ((soldierId: string) => void) | null,
): TimelineRowModel[] {
  return items.map((item): TimelineRowModel => {
    if (item.kind === 'group') return { kind: 'group', key: item.key, label: groupLabel(item.label), count: item.size }
    const offDays = item.inScope.map((inScope) => !inScope)
    return {
      kind: 'resource',
      key: item.key,
      name: fullName(item.soldier),
      detail: item.rank?.short_title ?? item.rank?.title ?? null,
      offDays,
      offText: offTextOf(days, offDays),
      onOpen:
        open === null
          ? null
          : () => {
              open(item.soldier.id)
            },
    }
  })
}
