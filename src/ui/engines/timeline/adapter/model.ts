import type { BarColorMode } from '@config'
import { RuleEnforcement, type CalendarDate, type SoldierId } from '@contracts'
import { t } from '@i18n'
import { dayRangeOf, fullName, type HeatDay, type BoardItem, type BoardLeave } from '@logic'
import { formatDate } from '../../../patterns/dates'
import { ICON_GLYPHS, iconOf } from '../../../theme/icons'
import { toneOf } from '../../../theme/palette'
import { TEXT_SEPARATOR, groupLabel, leaveText, leaveTone, rangeText, typeName } from '../../../board/labels'
import { assignLanes } from '../core/lanes'
import { spansOf } from '../core/layout'
import type { TimelineDayCell, TimelineHeatCell, TimelineMark, TimelineRowModel } from '../view/model'

// The translation from the domain to the neutral model of the view: soldiers become rows, units become
// group headers, days become header cells, and leaves become bars and badges (ARCHITECTURE "View engines").
// Pure.

export function dayCells(days: readonly CalendarDate[], today: CalendarDate): TimelineDayCell[] {
  return days.map((day) => ({
    key: day,
    weekday: formatDate(day, 'weekdayNarrow'),
    dayNumber: formatDate(day, 'day'),
    isToday: day === today,
  }))
}

/** Days flagged true, as ranges of dates read aloud after their meaning. NULL when none is. */
function rangesText(days: readonly CalendarDate[], flags: readonly boolean[], meaning: string): string | null {
  const ranges = spansOf(flags, true).map((span) => {
    const first = days[span.start]
    const last = days[span.start + span.length - 1]
    if (first === undefined || last === undefined) return ''
    return rangeText(first, last)
  })
  return ranges.length === 0 ? null : `${meaning}: ${ranges.join(', ')}`
}

/** The muted days of a row: out of the selected unit, and present under "only who is missing" (D-133). */
function offTextOf(days: readonly CalendarDate[], outOfScope: readonly boolean[], present: readonly boolean[]): string | null {
  const parts = [rangesText(days, outOfScope, t('timeline.outOfScope')), rangesText(days, present, t('timeline.present'))].filter(
    (part) => part !== null,
  )
  return parts.length === 0 ? null : parts.join(TEXT_SEPARATOR)
}

/** What the view needs to know about the leaves (D-111, D-112). */
export interface TimelineMarkOptions {
  readonly leaves: ReadonlyMap<SoldierId, readonly BoardLeave[]>
  readonly colors: BarColorMode
  /** Opens a leave's details: every mark is a control (D-119). */
  readonly openLeave: (leaveId: string) => void
  /** Whether a drag may move the leave (D-143). */
  readonly movable: (leaveId: string) => boolean
  /** Whether a drag on the soldier's row may mark a new leave (D-143). */
  readonly creatable: (soldierId: SoldierId) => boolean
}

interface Placed {
  readonly leave: BoardLeave
  readonly start: number
  readonly length: number
  readonly cut: { readonly start: boolean; readonly end: boolean }
}

/** Where a leave falls in the window. Stored days compare as text (`YYYY-MM-DD`). NULL outside it. */
function placeInWindow(leave: BoardLeave, days: readonly CalendarDate[]): Placed | null {
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

function markOf(
  { leave, start, length, cut }: Placed,
  lane: number,
  first: CalendarDate,
  { colors, openLeave, movable }: TimelineMarkOptions,
): TimelineMark {
  const badge = leave.effect === 'available'
  const uniform = colors === 'uniform'
  const typeTone = toneOf(leave.type?.color_key ?? null)
  return {
    key: leave.id,
    kind: badge ? 'badge' : 'bar',
    start,
    length,
    cut,
    range: dayRangeOf(first, leave),
    drag: movable(leave.id) ? { resize: !badge } : null,
    lane,
    dashed: leave.status === 'pending',
    tone: leaveTone(leave, colors),
    Icon: badge ? (iconOf(leave.type?.icon_key ?? null) ?? ICON_GLYPHS.other.Icon) : null,
    dot: uniform && !badge && leave.type !== null ? typeTone.fill : null,
    caption: uniform && !badge ? typeName(leave) : null,
    label: leaveText(leave),
    onOpen: () => {
      openLeave(leave.id)
    },
  }
}

/** Bars and badges take lanes apart: a badge sits over a bar, as in Stone 3 (D-111). */
function marksOf(leaves: readonly BoardLeave[], days: readonly CalendarDate[], options: TimelineMarkOptions) {
  const placed = leaves.flatMap((leave) => {
    const at = placeInWindow(leave, days)
    return at === null ? [] : [at]
  })
  const bars = placed.filter((item) => item.leave.effect !== 'available')
  const badges = placed.filter((item) => item.leave.effect === 'available')
  const barLanes = assignLanes(bars)
  const badgeLanes = assignLanes(badges)
  const [first] = days
  if (first === undefined) return { marks: [], lanes: 1 }
  const marks = [
    ...bars.map((item, index) => markOf(item, barLanes.lanes[index] ?? 0, first, options)),
    ...badges.map((item, index) => markOf(item, badgeLanes.lanes[index] ?? 0, first, options)),
  ]
  return { marks, lanes: Math.max(barLanes.count, badgeLanes.count) }
}

export function timelineRows(
  items: readonly BoardItem[],
  days: readonly CalendarDate[],
  open: ((soldierId: string) => void) | null,
  options: TimelineMarkOptions,
): TimelineRowModel[] {
  return items.map((item): TimelineRowModel => {
    if (item.kind === 'group') return { kind: 'group', key: item.key, label: groupLabel(item.label), count: item.size }
    const outOfScope = item.inScope.map((inScope) => !inScope)
    const present = item.inScope.map((_, index) => item.present?.[index] === true)
    const offDays = outOfScope.map((off, index) => off || present[index] === true)
    return {
      kind: 'resource',
      key: item.key,
      name: fullName(item.soldier),
      detail: item.rank?.short_title ?? item.rank?.title ?? null,
      offDays,
      offText: offTextOf(days, outOfScope, present),
      creatable: options.creatable(item.soldier.id),
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

/** The heat row's cells (D-141). A day with nothing broken is empty; any other opens the rules of its day. */
export function heatCells(
  heat: readonly HeatDay[],
  openDay: (day: CalendarDate) => void,
): TimelineHeatCell[] {
  return heat.map((day) => {
    const tone = day.worst ?? 'none'
    const worstKey = day.worst === RuleEnforcement.enum.hard ? 'rules.heatHard' : 'rules.heatSoft'
    return {
      key: day.date,
      tone,
      count: day.broken === 0 ? null : String(day.broken),
      label: [formatDate(day.date, 'dayMonth'), `${String(day.broken)} ${t('rules.heatBroken')}`, t(worstKey)].join(TEXT_SEPARATOR),
      onOpen:
        day.broken === 0
          ? null
          : () => {
              openDay(day.date)
            },
    }
  })
}
