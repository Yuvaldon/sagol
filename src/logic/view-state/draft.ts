import { CalendarDate, SoldierId } from '@contracts'
import { compareDates } from '@domain'
import { z } from 'zod'

// What a drag on the timeline, or days picked on the board, marked for a new leave (D-143, D-480): the days, and the
// soldier when one row was picked; days picked on the calendar name none, and the form asks. Soldiers chosen together on
// "חיילים" name several, for one collective leave (D-482). It lives in the URL beside
// the open panel, so a link reopens the form with them; the new-leave form starts from it.

/** The search param `draft`. Days in the wrong order count as absent, as any invalid value does (D-103). */
export const NewLeaveDraft = z
  .object({
    soldier_id: SoldierId.optional(),
    soldier_ids: z.array(SoldierId).min(2).optional(),
    start_date: CalendarDate,
    end_date: CalendarDate,
  })
  .refine((draft) => compareDates(draft.start_date, draft.end_date) <= 0)
  .refine((draft) => draft.soldier_id === undefined || draft.soldier_ids === undefined)
export type NewLeaveDraft = z.infer<typeof NewLeaveDraft>
