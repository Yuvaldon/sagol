import { z } from 'zod'
import type { PropertyDataType } from '@contracts'

// Ids of the view engines that can fill the central viewport (D-023). The registry in `ui`
// maps each id to an engine; the active id lives in the URL. The order is the view switcher's (the handoff's board
// spec, §2): the calendar, the timeline, the movements (`list`, a row per day), and the table.

export const VIEW_IDS = ['calendar', 'timeline', 'list', 'table'] as const

export const ViewId = z.enum(VIEW_IDS)
export type ViewId = z.infer<typeof ViewId>

/**
 * The view shown when the URL names none, by the device (D-074, D-290, D-463): the timeline from `md` for planning, the
 * calendar on a phone, where the gaps show first.
 */
export const DEFAULT_VIEW_BY_DEVICE = { desktop: 'timeline', phone: 'calendar' } as const satisfies Readonly<Record<'desktop' | 'phone', ViewId>>

/** The views a phone does not offer: the table is for a wide screen (D-463). */
export const DESKTOP_ONLY_VIEWS = ['table'] as const satisfies readonly ViewId[]

/**
 * The board of the new interface (the handoff's board spec, D-480), in days, pixels and milliseconds.
 */
export const BOARD = {
  /** The requests a month cell names before "+N" (§1.10). */
  cellBars: 3,
  /** The movements: the days read before and after the anchor, and how many more a scroll to either end adds, up to
   *  `DATE_WINDOW.maxDays` in all. */
  movements: { before: 14, after: 42, step: 28 },
  /** How long a finger holds a day before it starts a range, and how far it may wander meanwhile (§3). */
  holdMs: 450,
  holdTolerancePx: 8,
  /** How far a finger travels before a move is a swipe: between months, between stops, or to reveal a row's actions. */
  swipePx: 40,
  /** How far two fingers move apart or together, as a share of where they started, before a pinch changes the range. */
  pinchRatio: 1.35,
  /**
   * The timeline (D-480, D-491): the name column, the narrowest day before the days scroll sideways, and the ranges a
   * pinch steps through, narrowest first (OI-399). A wide screen's name column is wider, for a name and its rank.
   */
  timeline: { nameColumnPx: 124, wideNameColumnPx: 176, minDayPx: 24, pinchRanges: ['week', 'month', 'rotation'] },
} as const

/**
 * The date window (D-103, D-211): a week by default, and at most this many days, from a link or a rotation. A rotation
 * that is longer, or has no end yet, shows its first `maxDays` days.
 */
export const DATE_WINDOW = { days: 7, maxDays: 186 } as const

/** The kinds of date window the range picker offers (D-211, D-383); the navigator steps by the chosen one. */
export const RANGE_KINDS = ['day', 'week', 'two_weeks', 'four_weeks', 'month', 'rotation'] as const
export const RangeKind = z.enum(RANGE_KINDS)
export type RangeKind = z.infer<typeof RangeKind>

/** How many weeks a span of weeks holds, from the week's first day (D-383). */
export const WEEK_SPANS = { week: 1, two_weeks: 2, four_weeks: 4 } as const satisfies Partial<Record<RangeKind, number>>
export type WeekSpanKind = keyof typeof WEEK_SPANS

/** The kind when the URL names none and holds no free window. */
export const DEFAULT_RANGE_KIND = 'week' satisfies RangeKind

/**
 * What the board's rows can be sorted by (D-214): the name, the command rank, the seniority on the window's first day,
 * the unit, and the approved days away in the window. The grouping is its own option (D-452).
 */
export const BOARD_SORT_KEYS = ['name', 'rank', 'seniority', 'unit', 'absent'] as const
export const BoardSortKey = z.enum(BOARD_SORT_KEYS)
export type BoardSortKey = z.infer<typeof BoardSortKey>

/** The board's order when the URL names none: seniority, then name, as before D-214. */
export const DEFAULT_BOARD_SORT_KEY: BoardSortKey = 'seniority'

/**
 * What the board can group its rows by besides a tag category (D-452): nothing, the unit (D-105), or the command rank.
 */
export const BOARD_GROUP_KEYS = ['none', 'unit', 'rank'] as const
export const BoardGroupKey = z.enum(BOARD_GROUP_KEYS)
export type BoardGroupKey = z.infer<typeof BoardGroupKey>

/**
 * The table's own columns (D-214): its rows are leaves, so it can also sort by them, in the URL's `sort` and `order`.
 * The board ignores them; the table's soldier and unit columns write the board's sort rules (D-313).
 */
export const TABLE_SORT_KEYS = ['type', 'from', 'to', 'days', 'status'] as const
export const TableSortKey = z.enum(TABLE_SORT_KEYS)
export type TableSortKey = z.infer<typeof TableSortKey>

export const SORT_ORDERS = ['asc', 'desc'] as const
export const SortOrder = z.enum(SORT_ORDERS)
export type SortOrder = z.infer<typeof SortOrder>

/** The direction a key sorts in when the URL names none (D-214): the most senior first, the most days away first. */
export const DEFAULT_SORT_ORDER: Readonly<Record<BoardSortKey, SortOrder>> = {
  name: 'asc',
  rank: 'desc',
  seniority: 'desc',
  unit: 'asc',
  absent: 'desc',
}

/** The direction a table column sorts in when the URL names none (D-214). */
export const DEFAULT_TABLE_SORT_ORDER: SortOrder = 'asc'

/**
 * The soldier properties the board can sort by (D-313): the types with an order. A select sorts by its options' order;
 * a multi-select and a reference have none.
 */
export const SORTABLE_PROPERTY_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const satisfies readonly PropertyDataType[]

/** Dragging on the timeline (D-143, D-144), in CSS pixels and milliseconds. */
export const TIMELINE_DRAG = {
  /** How far a pointer travels before a press becomes a drag; anything shorter opens the leave. */
  thresholdPx: 4,
  /** The inner end of a bar that moves its first or last day. */
  handlePx: 8,
  /** How long a finger holds still on the board before it picks a mark or a day up. */
  holdMs: 450,
  /** How far a finger may wander while it holds. */
  holdTolerancePx: 8,
  /** Near the edge of the board, the grid scrolls sideways by up to this much per frame. */
  edgeZonePx: 40,
  edgeStepPx: 12,
} as const
