import { IssueCode, type CalendarDate, type Deployment, type DeploymentMember, type Issue } from '@contracts'
import { compareDates } from '../time'

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
