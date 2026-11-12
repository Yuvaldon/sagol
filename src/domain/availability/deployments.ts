import { IssueCode, type Deployment, type DeploymentMember, type Issue } from '@contracts'
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
