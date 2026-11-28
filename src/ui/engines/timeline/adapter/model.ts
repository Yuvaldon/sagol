import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import type { BoardItem } from '@logic'
import { rangeText } from '../../../board/labels'
import { spansOf } from '../core/layout'

// What a row of the timeline says aloud beside its bar (ARCHITECTURE "View engines"). Pure.

/** The muted days of a row, out of the selected unit (D-105), as ranges read after their meaning; NULL when none is. */
export function rowOffText(item: Extract<BoardItem, { kind: 'soldier' }>, days: readonly CalendarDate[]): string | null {
  const ranges = spansOf(
    item.inScope.map((inScope) => !inScope),
    true,
  ).map((span) => {
    const first = days[span.start]
    const last = days[span.start + span.length - 1]
    if (first === undefined || last === undefined) return ''
    return rangeText(first, last)
  })
  return ranges.length === 0 ? null : `${t('timeline.outOfScope')}: ${ranges.join(', ')}`
}
