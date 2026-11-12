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
import {
  EDITABLE_LEAVE_STATUSES,
  buildUnitTree,
  descendantsOf,
  leaveRotationIssues,
  rotationClosedIssues,
  wholeUnitRotationIssues,
  withinMemberSpan,
  type DateSpan,
} from '@domain'
import type { ActorScope } from './actor'
import { parsedRow } from './failure'
import { tableOf } from './store'

// Every request belongs to a rotation (D-216): its soldier is a member and its dates fall within the member's days.
// The leave commands check a request against its rotation; the deployment commands refuse a change that would strand
// a live request. The database triggers hold the same rule at commit. A rotation with no member rows holds the whole
// unit: a soldier on the days of their memberships in its unit or below it (D-259, D-221).

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
 * `reference_not_found`; an archived one takes no new request (`reference_archived`) but holds the ones it has; a
 * closed one takes no change to its requests (`rotation_closed`, D-221). `isNew` says whether the request is being
 * created.
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
  const closed = rotationClosedIssues(stored)
  if (closed.length > 0) return closed
  const member = await tableOf(database, 'deployment_members').get([leave.deployment_id, leave.soldier_id])
  if (member !== undefined) return leaveRotationIssues(stored, member, leave)
  if (await hasMemberRows(database, stored)) return leaveRotationIssues(stored, null, leave)
  return wholeUnitRotationIssues(stored, await wholeUnitSpans(database, stored, leave.soldier_id), leave)
}

/** Whether the rotation lists its members; one with no rows holds the whole unit (D-259). */
export async function hasMemberRows(database: Store, deployment: Pick<Deployment, 'id' | 'organization_id'>): Promise<boolean> {
  const rows = await tableOf(database, 'deployment_members').where('organization_id').equals(deployment.organization_id).toArray()
  return rows.some((row) => row.deployment_id === deployment.id)
}

/** The days the whole unit of `deployment` holds the soldier: their memberships, of any type, in its subtree (D-221). */
export async function wholeUnitSpans(
  database: Store,
  deployment: Pick<Deployment, 'organization_id' | 'unit_id'>,
  soldierId: SoldierId,
): Promise<DateSpan[]> {
  const units = await tableOf(database, 'units').where('organization_id').equals(deployment.organization_id).toArray()
  const subtree = new Set<string>([deployment.unit_id, ...descendantsOf(buildUnitTree(units), deployment.unit_id)])
  const rows = await tableOf(database, 'unit_memberships').where('soldier_id').equals(soldierId).toArray()
  return rows.filter((row) => row.organization_id === deployment.organization_id && subtree.has(row.unit_id))
}

/** The live requests of a rotation (D-216). */
export async function liveLeavesOf(database: Store, deployment: Pick<Deployment, 'id' | 'organization_id'>): Promise<Leave[]> {
  const rows = await tableOf(database, 'leaves').where('organization_id').equals(deployment.organization_id).toArray()
  return rows
    .filter((row) => row.deployment_id === deployment.id && isLiveLeave(row))
    .map((row) => parsedRow('leaves', row))
}

/** Whether the soldier's live requests in a listed rotation still fit `member`'s days, or there are none when it is NULL. */
export function holdsLeaves(
  deployment: Pick<Deployment, 'start_date' | 'end_date'>,
  member: Pick<DeploymentMember, 'start_date' | 'end_date'> | null,
  leaves: readonly Leave[],
): boolean {
  return leaves.every((leave) => member !== null && withinMemberSpan(deployment, member, leave))
}

/** Whether the soldier's live requests still fit the whole unit of `deployment` (D-221). */
export async function wholeUnitHoldsLeaves(
  database: Store,
  deployment: Pick<Deployment, 'organization_id' | 'unit_id' | 'start_date' | 'end_date'>,
  soldierId: SoldierId,
  leaves: readonly Leave[],
): Promise<boolean> {
  if (leaves.length === 0) return true
  const spans = await wholeUnitSpans(database, deployment, soldierId)
  return leaves.every((leave) => wholeUnitRotationIssues(deployment, spans, leave).length === 0)
}

/** A request of a closed rotation takes no edit and no transition (`rotation_closed`, D-221). */
export async function closedRotationOf(database: Store, leave: Pick<Leave, 'deployment_id'>): Promise<Issue[]> {
  const stored = await tableOf(database, 'deployments').get(leave.deployment_id)
  return stored === undefined ? [] : rotationClosedIssues(stored)
}
