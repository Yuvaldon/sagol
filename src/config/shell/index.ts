import { z } from 'zod'

// The shell of the new interface (D-454, D-455): its four destinations, the pages a destination opens over itself,
// and the measures of "היום" and of the floating bar.

/** The destinations of the tab bar, in the order it shows them (D-455). */
export const TAB_IDS = ['today', 'board', 'manage', 'me'] as const
export const TabId = z.enum(TAB_IDS)
export type TabId = z.infer<typeof TabId>

/** Where a bare address lands (D-455). */
export const DEFAULT_TAB: TabId = 'today'

/** A page a destination opens over itself: "בקשות לאישור" of "היום" (D-459), "הגדרות" of "ניהול" (D-456). */
export const PAGE_IDS = ['requests', 'settings'] as const
export const PageId = z.enum(PAGE_IDS)
export type PageId = z.infer<typeof PageId>

/** The tab each page belongs to; a page shows only on its tab. */
export const PAGE_TABS = { requests: 'today', settings: 'manage' } as const satisfies Record<PageId, TabId>

export const TODAY = {
  /** The days of a soldier's strip, today first (D-454). */
  stripDays: 14,
  /** The day columns of the commander block, today first. */
  unitDays: 7,
  /** The most rows a card shows before its door to the rest (D-459). */
  cardRows: 3,
} as const

export const SHELL = {
  /** How far, in pixels, the page scrolls one way before the tab bar hides or returns. */
  barScrollPx: 12,
  /** How far, in pixels, the page is scrolled before the top blur band shows. */
  bandFromPx: 4,
  /** How long a toast stays, in milliseconds; an action in it lives as long. */
  toastMs: 6000,
  /** The side of a tab's icon, in pixels (D-454). */
  tabIconPx: 26,
  /** The stroke of a tab's icon: heavier on the tab in sight, and heaviest on the action circle's "+". */
  tabStroke: { idle: 1.8, active: 2.2, action: 2.4 },
  /** The side of the corner circle's icon, in pixels. */
  cornerIconPx: 20,
} as const

/** How far the drawer with stops gives under a drag, as a share of the drag: little upward, fully downward (D-454). */
export const STOP_DRAWER = { elasticUp: 0.2, elasticDown: 1 } as const
