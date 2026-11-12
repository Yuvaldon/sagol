import { IssueCode, type CalendarDate, type Deployment, type DeploymentMember, type Issue } from '@contracts'
import { addDays, compareDates, spansOverlap, type DateSpan } from '../time'

// Deployments and their members (D-019, D-071, D-179). Pure.

/** The dates of a member as a deployment check reads them. NULL falls back to the deployment's own. */
export type DeploymentMemberDates = Pick<DeploymentMember, 'start_date' | 'end_date'>

/**
 * A member's own dates only narrow the deployment (D-179): a start before the deployment's start, or an end after its
 * end, answers `invalid_value` on that date. Paths are relative to the member.
 */
export function deploymentMemberIssues(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: DeploymentMemberDates,
): Issue[] {
  const issues: Issue[] = []
  if (member.start_date !== null) {
    const late = deployment.end_date !== null && compareDates(member.start_date, deployment.end_date) > 0
    if (compareDates(member.start_date, deployment.start_date) < 0 || late) {
      issues.push({ path: ['start_date'], code: IssueCode.enum.invalid_value })
    }
  }
  if (member.end_date !== null) {
    const early = compareDates(member.end_date, deployment.start_date) < 0
    if (early || (deployment.end_date !== null && compareDates(member.end_date, deployment.end_date) > 0)) {
      issues.push({ path: ['end_date'], code: IssueCode.enum.invalid_value })
    }
  }
  return issues
}

/** A member's days in a deployment: their own dates, else the deployment's (D-179). A NULL end runs open. */
export function memberSpan(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: DeploymentMemberDates,
): { readonly start_date: CalendarDate; readonly end_date: CalendarDate | null } {
  return { start_date: member.start_date ?? deployment.start_date, end_date: member.end_date ?? deployment.end_date }
}

/** Whether every day of `dates` falls within the member's days (D-216). */
export function withinMemberSpan(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: DeploymentMemberDates,
  dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate },
): boolean {
  const span = memberSpan(deployment, member)
  return compareDates(dates.start_date, span.start_date) >= 0 && (span.end_date === null || compareDates(dates.end_date, span.end_date) <= 0)
}

/**
 * A request against its rotation (D-216): `not_a_member` on the soldier when the soldier holds no membership, else
 * `outside_rotation` on each date that falls outside the member's days. Paths are relative to the leave.
 */
export function leaveRotationIssues(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: DeploymentMemberDates | null,
  dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate },
): Issue[] {
  if (member === null) return [{ path: ['soldier_id'], code: IssueCode.enum.not_a_member }]
  const span = memberSpan(deployment, member)
  const issues: Issue[] = []
  if (compareDates(dates.start_date, span.start_date) < 0) issues.push({ path: ['start_date'], code: IssueCode.enum.outside_rotation })
  if (span.end_date !== null && compareDates(dates.end_date, span.end_date) > 0) {
    issues.push({ path: ['end_date'], code: IssueCode.enum.outside_rotation })
  }
  return issues
}

/** The columns the one-at-a-time and close checks read (D-257, D-221). Full `Deployment` rows fit. */
export type RotationDates = Pick<Deployment, 'id' | 'start_date' | 'end_date' | 'archived_at'>

function spanOf(rotation: Pick<Deployment, 'start_date' | 'end_date'>): DateSpan {
  return { valid_from: rotation.start_date, valid_to: rotation.end_date }
}

/**
 * One rotation at a time (D-257, D-221): `rotation_overlap` on `start_date` when `candidate` shares a day with another
 * live rotation. An archived candidate, or an archived other, overlaps nothing.
 */
export function rotationOverlapIssues(candidate: RotationDates, others: Iterable<RotationDates>): Issue[] {
  if (candidate.archived_at !== null) return []
  for (const other of others) {
    if (other.id === candidate.id || other.archived_at !== null) continue
    if (spansOverlap(spanOf(candidate), spanOf(other))) return [{ path: ['start_date'], code: IssueCode.enum.rotation_overlap }]
  }
  return []
}

/** Whether the rotation is closed (D-258). A closed rotation takes no change but its archive. */
export function isClosedRotation(rotation: Pick<Deployment, 'closed_at'>): boolean {
  return rotation.closed_at !== null
}

/** `rotation_closed` on the rotation when it is closed (D-221); paths are the command's. */
export function rotationClosedIssues(rotation: Pick<Deployment, 'closed_at'>, path: readonly string[] = ['deployment_id']): Issue[] {
  return isClosedRotation(rotation) ? [{ path: [...path], code: IssueCode.enum.rotation_closed }] : []
}

/**
 * What closing the rotation on `today` writes as its end (D-258, D-221): an open end becomes today; an end after today
 * answers `rotation_not_ended`; a closed one answers `rotation_closed`.
 */
export function rotationCloseEnd(
  rotation: Pick<Deployment, 'start_date' | 'end_date' | 'closed_at'>,
  today: CalendarDate,
): { readonly end_date: CalendarDate } | { readonly issues: Issue[] } {
  if (isClosedRotation(rotation)) return { issues: rotationClosedIssues(rotation, ['id']) }
  if (rotation.end_date === null) {
    // Closing takes today as the end, so a rotation that has not started has no day to close on (D-258).
    if (compareDates(today, rotation.start_date) < 0) return { issues: [{ path: ['id'], code: IssueCode.enum.rotation_not_ended }] }
    return { end_date: today }
  }
  if (compareDates(rotation.end_date, today) > 0) return { issues: [{ path: ['id'], code: IssueCode.enum.rotation_not_ended }] }
  return { end_date: rotation.end_date }
}

/**
 * A request in a whole-unit rotation (D-221): `outside_rotation` on each date outside the rotation's own dates, else
 * `not_a_member` when some day of the request falls outside every given span (the soldier's memberships, primary or
 * attached, in the rotation's unit or below it). Paths are relative to the leave.
 */
export function wholeUnitRotationIssues(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  spans: Iterable<DateSpan>,
  dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate },
): Issue[] {
  const outside = leaveRotationIssues(deployment, { start_date: null, end_date: null }, dates)
  if (outside.length > 0) return outside
  return spansCoverRange(spans, dates) ? [] : [{ path: ['soldier_id'], code: IssueCode.enum.not_a_member }]
}

/** Whether every day of `dates` lies in at least one of `spans`. */
export function spansCoverRange(
  spans: Iterable<DateSpan>,
  dates: { readonly start_date: CalendarDate; readonly end_date: CalendarDate },
): boolean {
  const sorted = [...spans].sort((a, b) => compareDates(a.valid_from, b.valid_from))
  let next = dates.start_date
  for (const span of sorted) {
    if (compareDates(span.valid_from, next) > 0) break
    if (span.valid_to === null) return true
    if (compareDates(span.valid_to, next) >= 0) {
      if (compareDates(span.valid_to, dates.end_date) >= 0) return true
      next = addDays(span.valid_to, 1)
    }
  }
  return false
}
