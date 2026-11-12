import {
  IssueCode,
  type CalendarDate,
  type Deployment,
  type Issue,
  type Permission,
  type PolicyTarget,
  type ReportConfirmation,
  type Timestamp,
  type UnitId,
} from '@contracts'
import { isAncestorOrSelf, type UnitTree } from '../hierarchy'
import { compareDates, compareInstants } from '../time'
import { isClosedRotation } from '../availability/deployments'

// The daily report workflow (D-269, D-293): each unit's report is confirmed per date, and whether it changed since is
// derived from the leaves, never stored. Pure.

/** Confirming a unit's report for a date. */
export const CONFIRM_DAY_REPORT: Permission = { resource: 'day_reports', action: 'confirm' }

/** What confirming a unit's report is checked against: the unit, as a rotation's own unit is (D-293). */
export function dayReportTarget(unitId: UnitId): PolicyTarget {
  return { kind: 'unit', unit_id: unitId }
}

/** Where a unit's report of a date stands: confirmed, not yet, or confirmed and changed since (D-269). */
export type ConfirmationStatus = 'confirmed' | 'not_yet' | 'changed_since'

/**
 * A unit's report status: `not_yet` without a confirmation, `changed_since` when one of the section's leaves was written
 * after it, else `confirmed`. `changedAt` holds when each leaf of the section was last written.
 */
export function confirmationStatus(
  confirmation: Pick<ReportConfirmation, 'confirmed_at'> | null,
  changedAt: readonly Timestamp[],
): ConfirmationStatus {
  if (confirmation === null) return 'not_yet'
  return changedAt.some((at) => compareInstants(at, confirmation.confirmed_at) > 0) ? 'changed_since' : 'confirmed'
}

/** When a confirmation holds from: when the confirmer last read the section, never later than now (D-293). */
export function confirmedAtOf(now: Timestamp, seenAt: Timestamp): Timestamp {
  return compareInstants(seenAt, now) < 0 ? seenAt : now
}

type ReportRotation = Pick<Deployment, 'unit_id' | 'start_date' | 'end_date' | 'archived_at' | 'closed_at'>

/** The live rotation over the unit (its own unit or one above it) that runs on the date, if any (D-222, D-257). */
export function reportRotationOf<R extends ReportRotation>(
  rotations: readonly R[],
  tree: UnitTree,
  unitId: UnitId,
  date: CalendarDate,
): R | null {
  return (
    rotations.find(
      (rotation) =>
        rotation.archived_at === null &&
        compareDates(rotation.start_date, date) <= 0 &&
        (rotation.end_date === null || compareDates(date, rotation.end_date) <= 0) &&
        isAncestorOrSelf(tree, rotation.unit_id, unitId),
    ) ?? null
  )
}

/**
 * Whether a unit's report of a date may be confirmed: a live rotation over it runs on the date (`not_reportable`, D-222)
 * and is open (`rotation_closed`, D-258). Paths are the command's.
 */
export function confirmReportIssues(rotation: ReportRotation | null): Issue[] {
  if (rotation === null) return [{ path: ['report_date'], code: IssueCode.enum.not_reportable }]
  return isClosedRotation(rotation) ? [{ path: ['report_date'], code: IssueCode.enum.rotation_closed }] : []
}
