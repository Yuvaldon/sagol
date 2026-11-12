import type { Store } from './store'
import {
  IssueCode,
  type CalendarDate,
  type Deployment,
  type DeploymentId,
  type DeploymentMember,
  type Issue,
  type Leave,
  type SoldierId,
} from '@contracts'
import { EDITABLE_LEAVE_STATUSES, leaveRotationIssues, withinMemberSpan } from '@domain'
import type { ActorScope } from './actor'
import { parsedRow } from './failure'
import { tableOf } from './store'

// Every request belongs to a rotation (D-216): its soldier is a member and its dates fall within the member's days.
// The leave commands check a request against its rotation; the deployment commands refuse a change that would strand
// a live request. The database triggers hold the same rule at commit.

interface LeaveInRotation {
  readonly deployment_id: DeploymentId
  readonly soldier_id: SoldierId
  readonly start_date: CalendarDate
  readonly end_date: CalendarDate
}

/** A request that holds its rotation in place: pending or approved (D-216). */
export function isLiveLeave(leave: Pick<Leave, 'status'>): boolean {
  return EDITABLE_LEAVE_STATUSES.includes(leave.status)
}

/**
 * A request against its rotation. Paths are relative to the leave. A rotation of another organization, or none, is
 * `reference_not_found`; an archived one takes no new request (`reference_archived`) but holds the ones it has.
 * `isNew` says whether the request is being created.
 */
export async function leaveRotationCheck(
  database: Store,
  scope: ActorScope,
  leave: LeaveInRotation,
  isNew: boolean,
): Promise<Issue[]> {
  const stored = await tableOf(database, 'deployments').get(leave.deployment_id)
  if (stored === undefined || stored.organization_id !== scope.organization_id) {
    return [{ path: ['deployment_id'], code: IssueCode.enum.reference_not_found }]
  }
  if (isNew && stored.archived_at !== null) return [{ path: ['deployment_id'], code: IssueCode.enum.reference_archived }]
  const member = await tableOf(database, 'deployment_members').get([leave.deployment_id, leave.soldier_id])
  return leaveRotationIssues(stored, member ?? null, leave)
}

/** The live requests of a rotation (D-216). */
export async function liveLeavesOf(database: Store, deployment: Pick<Deployment, 'id' | 'organization_id'>): Promise<Leave[]> {
  const rows = await tableOf(database, 'leaves').where('organization_id').equals(deployment.organization_id).toArray()
  return rows
    .filter((row) => row.deployment_id === deployment.id && isLiveLeave(row))
    .map((row) => parsedRow('leaves', row))
}

/** Whether the soldier's live requests in the rotation still fit `member`'s days, or there are none when it is NULL. */
export function holdsLeaves(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: Pick<DeploymentMember, 'start_date' | 'end_date'> | null,
  leaves: readonly Leave[],
): boolean {
  return leaves.every((leave) => member !== null && withinMemberSpan(deployment, member, leave))
}
