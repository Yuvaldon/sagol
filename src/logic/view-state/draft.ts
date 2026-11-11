import { CalendarDate, SoldierId } from '@contracts'
import { compareDates } from '@domain'
import { z } from 'zod'

// What a drag on the timeline marked for a new leave (D-143): the soldier and the days. It lives in the URL beside the
// open panel, so a link reopens the form with them; the new-leave form starts from it.

/** The search param `draft`. Days in the wrong order count as absent, as any invalid value does (D-103). */
export const NewLeaveDraft = z
  .object({ soldier_id: SoldierId, start_date: CalendarDate, end_date: CalendarDate })
  .refine((draft) => compareDates(draft.start_date, draft.end_date) <= 0)
export type NewLeaveDraft = z.infer<typeof NewLeaveDraft>
