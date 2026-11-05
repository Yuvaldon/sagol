import { z } from 'zod'

// Ids of the view engines that can fill the central viewport (D-023). The registry in `ui`
// maps each id to an engine; the active id lives in the URL.

export const VIEW_IDS = ['timeline', 'calendar', 'list', 'table'] as const

export const ViewId = z.enum(VIEW_IDS)
export type ViewId = z.infer<typeof ViewId>

/** The view shown when the URL names none (D-074). */
export const DEFAULT_VIEW_ID: ViewId = 'timeline'
