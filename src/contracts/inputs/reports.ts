import { z } from 'zod'
import { ReportConfirmationId } from '../common/ids'
import { Timestamp } from '../common/scalars'
import { ReportConfirmation } from '../entities/reports'

/**
 * Confirms a unit's daily report for a date (D-293). `id` names a new row; a unit and date already confirmed keep
 * their row, which moves to the actor. `seen_at` is when the client last read what it shows: the confirmation holds
 * from then, or from now if that is earlier, so a change the confirmer never saw still shows as one.
 */
export const ConfirmDayReportInput = z.strictObject({
  id: ReportConfirmationId,
  ...ReportConfirmation.pick({ unit_id: true, report_date: true }).shape,
  seen_at: Timestamp,
})
export type ConfirmDayReportInput = z.infer<typeof ConfirmDayReportInput>
