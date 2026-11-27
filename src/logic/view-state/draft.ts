import { CalendarDate, SoldierId } from '@contracts'
import { compareDates } from '@domain'
import { z } from 'zod'

// What a drag on the timeline, or days picked on the board, marked for a new leave (D-143, D-480): the days, and the
// soldier when one row was picked; days picked on the calendar name none, and the form asks. It lives in the URL beside
// the open panel, so a link reopens the form with them; the new-leave form starts from it.

/** The search param `draft`. Days in the wrong order count as absent, as any invalid value does (D-103). */
export const NewLeaveDraft = z
  .object({ soldier_id: SoldierId.optional(), start_date: CalendarDate, end_date: CalendarDate })
  .refine((draft) => compareDates(draft.start_date, draft.end_date) <= 0)
export type NewLeaveDraft = z.infer<typeof NewLeaveDraft>
