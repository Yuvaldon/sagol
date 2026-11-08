import { z } from 'zod'

// Drawer and sheet modules of the workspace (D-023, D-092). A panel id and the entity open inside it
// live in the URL. Each slice adds its own panels.

export const PANEL_IDS = {
  units: 'units',
  unitLevels: 'unit_levels',
} as const

export const PanelId = z.enum([PANEL_IDS.units, PANEL_IDS.unitLevels])
export type PanelId = z.infer<typeof PanelId>

/** The `entity` value of a form for a row that does not exist yet. */
export const NEW_ENTITY = 'new'

/** A sheet closes when its grip is dragged this far down, or released this fast. */
export const SHEET_DISMISS = { offsetPx: 96, velocityPxPerSecond: 500 } as const

/** Share of a row's height that counts as its top or bottom edge when dropping on it (D-092). */
export const DROP_EDGE_FRACTION = 0.25

/** How far a pointer travels before a press on a handle becomes a drag. */
export const DRAG_ACTIVATION_PX = 4
