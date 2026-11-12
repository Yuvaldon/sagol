import { z } from 'zod'
import { ReportConfirmationId } from '../common/ids'
import { ReportConfirmation } from '../entities/reports'

/**
 * Confirms a unit's daily report for a date (D-293). `id` names a new row; a unit and date already confirmed keep
 * their row, which moves to the actor and now.
 */
export const ConfirmDayReportInput = z.strictObject({
  id: ReportConfirmationId,
  ...ReportConfirmation.pick({ unit_id: true, report_date: true }).shape,
})
export type ConfirmDayReportInput = z.infer<typeof ConfirmDayReportInput>
