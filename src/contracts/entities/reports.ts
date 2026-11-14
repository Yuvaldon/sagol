import { z } from 'zod'
import { OrganizationId, ReportConfirmationId, SoldierId, UnitId } from '../common/ids'
import { CalendarDate, ChangeSeq, Timestamp } from '../common/scalars'

/**
 * `report_confirmations`: a unit's daily report confirmed for one date (D-269, D-293). One row per
 * unit and date; confirming again moves it to the new time and confirmer. Never deleted. Whether the
 * report changed since is derived from the leave events and memberships written after `seen_seq`,
 * never stored (D-373).
 */
export const ReportConfirmation = z.object({
  id: ReportConfirmationId,
  organization_id: OrganizationId,
  unit_id: UnitId,
  report_date: CalendarDate,
  confirmed_by: SoldierId,
  confirmed_at: Timestamp,
  /** The organization's change number the confirmer's report was read at (D-373). */
  seen_seq: ChangeSeq,
})
export type ReportConfirmation = z.infer<typeof ReportConfirmation>

/**
 * `change_counters`: the organization's last change number (D-373). Every leave or membership write
 * reads and writes this row, so serializable writers take numbers in commit order. Never exported.
 */
export const ChangeCounter = z.object({ organization_id: OrganizationId, last_seq: ChangeSeq })
export type ChangeCounter = z.infer<typeof ChangeCounter>
