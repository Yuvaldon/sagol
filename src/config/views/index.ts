import { z } from 'zod'

// Ids of the view engines that can fill the central viewport (D-023). The registry in `ui`
// maps each id to an engine; the active id lives in the URL.

export const VIEW_IDS = ['timeline', 'calendar', 'list', 'table'] as const

export const ViewId = z.enum(VIEW_IDS)
export type ViewId = z.infer<typeof ViewId>

/** The view shown when the URL names none (D-074). */
export const DEFAULT_VIEW_ID: ViewId = 'timeline'

/**
 * The date window (D-103, D-211): a week by default, and at most this many days, from a link or a rotation. A rotation
 * that is longer, or has no end yet, shows its first `maxDays` days.
 */
export const DATE_WINDOW = { days: 7, maxDays: 186 } as const

/** The kinds of date window the range picker offers (D-211); the navigator steps by the chosen one. */
export const RANGE_KINDS = ['day', 'week', 'month', 'rotation'] as const
export const RangeKind = z.enum(RANGE_KINDS)
export type RangeKind = z.infer<typeof RangeKind>

/** The kind when the URL names none and holds no free window. */
export const DEFAULT_RANGE_KIND = 'week' satisfies RangeKind

/**
 * What the board's rows can be sorted by (D-214): the name, the command rank, the seniority on the window's first day,
 * the unit, and the approved days away in the window. The rows stay grouped by unit (D-105).
 */
export const BOARD_SORT_KEYS = ['name', 'rank', 'seniority', 'unit', 'absent'] as const
export const BoardSortKey = z.enum(BOARD_SORT_KEYS)
export type BoardSortKey = z.infer<typeof BoardSortKey>

/** The board's order when the URL names none: seniority, then name, as before D-214. */
export const DEFAULT_BOARD_SORT_KEY: BoardSortKey = 'seniority'

/**
 * The table's own columns (D-214): its rows are leaves, so it can also sort by them. The board ignores these keys and
 * keeps its default order; the table's soldier and unit columns sort by the board's `name` and `unit` keys.
 */
export const TABLE_SORT_KEYS = ['type', 'from', 'to', 'days', 'status'] as const
export type TableSortKey = (typeof TABLE_SORT_KEYS)[number]

/** Every key the URL's sort can hold. */
export const SortKey = z.enum([...BOARD_SORT_KEYS, ...TABLE_SORT_KEYS])
export type SortKey = z.infer<typeof SortKey>

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

/**
 * The timeline's density, in CSS pixels (Stone 3, D-077, D-108). Layout math and the row virtualizer read the
 * same numbers that place the cells, so they live here rather than in the theme.
 */
export const TIMELINE_LAYOUT = {
  rowPx: 36,
  /** A row on mobile, where its name is a 44 px touch target (OI-033). */
  rowTouchPx: 44,
  groupRowPx: 32,
  headerPx: 28,
  nameColumnPx: 124,
  overscanRows: 10,
} as const

/**
 * A day's narrowest column by the length of the window (D-211): a week reads its weekdays, a month fits a laptop, a
 * rotation scrolls sideways. The first band whose `upToDays` holds the window wins. Below `weekdayMinPx` a day's
 * header shows its number only.
 */
export const TIMELINE_DENSITY = {
  bands: [
    { upToDays: 7, minDayPx: 64 },
    { upToDays: 31, minDayPx: 32 },
    { upToDays: DATE_WINDOW.maxDays, minDayPx: 24 },
  ],
  weekdayMinPx: 44,
} as const

/** Lanes of overlapping leaves in a timeline row (D-111), in CSS pixels, from Stone 3. */
export const TIMELINE_LANES = {
  /** The height of a bar, and the size of a marker's round badge. */
  barPx: 20,
  /** Each lane beyond the first adds this much to its row: a bar and the gap above it. */
  laneStepPx: 24,
  /** The space between a bar and the edge of its first or last day. */
  barInsetPx: 3,
} as const

/**
 * Lanes on a phone (D-144, OI-067): a bar's hit area fills the gap to the next lane, so a step of 44 makes every bar a
 * 44 px touch target, and the one lane of a row fills its 44 px.
 */
export const TIMELINE_LANES_TOUCH = {
  barPx: 28,
  laneStepPx: 44,
  barInsetPx: 3,
} as const

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

/** What a bar's color means (D-111, D-112): its leave type, or one color for every absence. */
export const BAR_COLOR_MODES = ['type', 'uniform'] as const
export const BarColorMode = z.enum(BAR_COLOR_MODES)
export type BarColorMode = z.infer<typeof BarColorMode>

/** The mode when the URL names none. */
export const DEFAULT_BAR_COLOR_MODE: BarColorMode = 'type'
