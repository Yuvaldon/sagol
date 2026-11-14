import { z } from 'zod'
import { ReportConfirmationId } from '../common/ids'
import { ReportConfirmation } from '../entities/reports'

/**
 * Confirms a unit's daily report for a date (D-293). `id` names a new row; a unit and date already confirmed keep
 * their row, which moves to the actor. `seen_seq` is the organization's change number the client read before what it
 * shows (D-373): a change numbered after it shows as one, so a change the confirmer never saw is never hidden.
 */
export const ConfirmDayReportInput = z.strictObject({
  id: ReportConfirmationId,
  ...ReportConfirmation.pick({ unit_id: true, report_date: true, seen_seq: true }).shape,
})
export type ConfirmDayReportInput = z.infer<typeof ConfirmDayReportInput>
