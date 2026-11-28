import { z } from 'zod'
import { BoardGrouping } from './grouping'

// The options of the list of "חיילים" in the URL (D-482). Apart from their hook, so the search schema reads them alone.

/** The list's two orders (the handoff's Soldiers): by command rank then name, the default; or by name alone. */
export const PEOPLE_SORTS = ['rank', 'name'] as const
export type PeopleSort = (typeof PEOPLE_SORTS)[number]

export const PeopleOptions = z
  .object({
    sort: z.literal('name').optional(),
    group: BoardGrouping.optional(),
    inactive: z.literal(true).optional(),
    days: z.literal(false).optional(),
  })
  .strict()
export type PeopleOptions = z.infer<typeof PeopleOptions>

