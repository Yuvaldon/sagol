import { z } from 'zod'
import { OrganizationId, ReportConfirmationId, SoldierId, UnitId } from '../common/ids'
import { CalendarDate, Timestamp } from '../common/scalars'

/**
 * `report_confirmations`: a unit's daily report confirmed for one date (D-269, D-293). One row per
 * unit and date; confirming again moves it to the new time and confirmer. Never deleted. Whether the
 * report changed since is derived from the leaves, never stored.
 */
export const ReportConfirmation = z.object({
  id: ReportConfirmationId,
  organization_id: OrganizationId,
  unit_id: UnitId,
  report_date: CalendarDate,
  confirmed_by: SoldierId,
  confirmed_at: Timestamp,
})
export type ReportConfirmation = z.infer<typeof ReportConfirmation>
