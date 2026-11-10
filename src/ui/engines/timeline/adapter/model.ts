import type { BarColorMode } from '@config'
import type { CalendarDate, SoldierId } from '@contracts'
import { t } from '@i18n'
import { fullName, type TimelineGroupLabel, type TimelineItem, type TimelineLeave } from '@logic'
import { formatDate, formatDateRange } from '../../../patterns/dates'
import { UNIT_STATE_KEYS } from '../../../patterns/units'
import { ICON_GLYPHS, iconOf } from '../../../theme/icons'
import { MARKER_TONE, UNIFORM_TONE, toneOf } from '../../../theme/palette'
import { assignLanes } from '../core/lanes'
import { spansOf } from '../core/layout'
import type { TimelineDayCell, TimelineMark, TimelineRowModel } from '../view/model'

// The translation from the domain to the neutral model of the view: soldiers become rows, units become
// group headers, days become header cells, and leaves become bars and badges (ARCHITECTURE "View engines").
// Pure.

/** How a path below the selected unit is written: `מחלקה א · כיתה 1` (D-105). */
const PATH_SEPARATOR = ' · '
const TEXT_SEPARATOR = ', '

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

function rangeText(first: CalendarDate, last: CalendarDate): string {
  return first === last ? formatDate(first, 'dayMonth') : formatDateRange(first, last)
}

/** The muted days of a row, read aloud as ranges of dates. */
function offTextOf(days: readonly CalendarDate[], offDays: readonly boolean[]): string | null {
  const ranges = spansOf(offDays, true).map((span) => {
    const first = days[span.start]
    const last = days[span.start + span.length - 1]
    if (first === undefined || last === undefined) return ''
    return rangeText(first, last)
  })
  return ranges.length === 0 ? null : `${t('timeline.outOfScope')}: ${ranges.join(', ')}`
}

/** What the view needs to know about the leaves (D-111, D-112). */
export interface TimelineMarkOptions {
  readonly leaves: ReadonlyMap<SoldierId, readonly TimelineLeave[]>
  readonly colors: BarColorMode
  /** Opens a leave's details: every mark is a control (D-119). */
  readonly openLeave: (leaveId: string) => void
}

interface Placed {
  readonly leave: TimelineLeave
  readonly start: number
  readonly length: number
  readonly cut: { readonly start: boolean; readonly end: boolean }
}

/** Where a leave falls in the window. Stored days compare as text (`YYYY-MM-DD`). NULL outside it. */
function placeInWindow(leave: TimelineLeave, days: readonly CalendarDate[]): Placed | null {
  const first = days.findIndex((day) => day >= leave.start_date)
  const last = days.findLastIndex((day) => day <= leave.end_date)
  if (first < 0 || last < first) return null
  const firstDay = days[0]
  const lastDay = days[days.length - 1]
  return {
    leave,
    start: first,
    length: last - first + 1,
    cut: {
      start: firstDay !== undefined && leave.start_date < firstDay,
      end: lastDay !== undefined && leave.end_date > lastDay,
    },
  }
}

function typeName(leave: TimelineLeave): string {
  return leave.type?.name ?? t('leaves.unknownType')
}

function markOf({ leave, start, length, cut }: Placed, lane: number, { colors, openLeave }: TimelineMarkOptions): TimelineMark {
  const badge = leave.effect === 'available'
  const uniform = colors === 'uniform'
  const typeTone = toneOf(leave.type?.color_key ?? null)
  return {
    key: leave.id,
    kind: badge ? 'badge' : 'bar',
    start,
    length,
    cut,
    lane,
    dashed: leave.status === 'pending',
    tone: uniform ? (badge ? MARKER_TONE : UNIFORM_TONE) : typeTone,
    Icon: badge ? (iconOf(leave.type?.icon_key ?? null) ?? ICON_GLYPHS.other.Icon) : null,
    dot: uniform && !badge && leave.type !== null ? typeTone.fill : null,
    caption: uniform && !badge ? typeName(leave) : null,
    label: markText(leave),
    onOpen: () => {
      openLeave(leave.id)
    },
  }
}

/** A mark's name: the type, marker or absence, the status, and the days of the leave itself. */
function markText(leave: TimelineLeave): string {
  const parts = [
    typeName(leave),
    ...(leave.effect === 'available' ? [t('leaves.marker')] : []),
    t(leave.status === 'approved' ? 'leaves.statusApproved' : 'leaves.statusPending'),
    rangeText(leave.start_date, leave.end_date),
  ]
  return parts.join(TEXT_SEPARATOR)
}

/** Bars and badges take lanes apart: a badge sits over a bar, as in Stone 3 (D-111). */
function marksOf(leaves: readonly TimelineLeave[], days: readonly CalendarDate[], options: TimelineMarkOptions) {
  const placed = leaves.flatMap((leave) => {
    const at = placeInWindow(leave, days)
    return at === null ? [] : [at]
  })
  const bars = placed.filter((item) => item.leave.effect !== 'available')
  const badges = placed.filter((item) => item.leave.effect === 'available')
  const barLanes = assignLanes(bars)
  const badgeLanes = assignLanes(badges)
  const marks = [
    ...bars.map((item, index) => markOf(item, barLanes.lanes[index] ?? 0, options)),
    ...badges.map((item, index) => markOf(item, badgeLanes.lanes[index] ?? 0, options)),
  ]
  return { marks, lanes: Math.max(barLanes.count, badgeLanes.count) }
}

export function timelineRows(
  items: readonly TimelineItem[],
  days: readonly CalendarDate[],
  open: ((soldierId: string) => void) | null,
  options: TimelineMarkOptions,
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
      ...marksOf(options.leaves.get(item.soldier.id) ?? [], days, options),
    }
  })
}
