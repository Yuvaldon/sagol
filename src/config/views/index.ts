import { z } from 'zod'

// Ids of the view engines that can fill the central viewport (D-023). The registry in `ui`
// maps each id to an engine; the active id lives in the URL.

export const VIEW_IDS = ['timeline', 'calendar', 'list', 'table'] as const

export const ViewId = z.enum(VIEW_IDS)
export type ViewId = z.infer<typeof ViewId>

/** The view shown when the URL names none (D-074). */
export const DEFAULT_VIEW_ID: ViewId = 'timeline'

/** The date window (D-103): a week by default, and at most this many days from a link. */
export const DATE_WINDOW = { days: 7, maxDays: 62 } as const

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
  minDayPx: 64,
  overscanRows: 10,
} as const
