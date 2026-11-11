import { IssueCode, SubjectRankConstraint, type AccessGrant, type Issue, type Permission, type SoldierId } from '@contracts'
import { compareInstants } from '../time'
import type { PolicyContext } from './context'

// Invariants of the permission data (D-004, D-059) and of access grants (OI-009).

/** What makes a soldier an access manager, at organization scope with `any`, without expiry (D-059, D-158). */
export const ACCESS_MANAGEMENT_PERMISSIONS = [
  { resource: 'access_grants', action: 'create' },
  { resource: 'access_grants', action: 'delete' },
  { resource: 'roles', action: 'update' },
] as const satisfies readonly Permission[]

function isAccessManager(context: PolicyContext, soldierId: SoldierId): boolean {
  const lasting = context
    .permissionsOf(soldierId)
    .filter(
      (permission) =>
        permission.scope.kind === 'organization' &&
        permission.expires_at === null &&
        permission.subject_rank_constraint === SubjectRankConstraint.enum.any,
    )
  return ACCESS_MANAGEMENT_PERMISSIONS.every((required) =>
    lasting.some(
      (permission) => permission.resource === required.resource && permission.action === required.action,
    ),
  )
}

/** Access managers of the snapshot (D-059). Only active, linked soldiers qualify (D-056). */
export function accessManagers(context: PolicyContext): SoldierId[] {
  return context.soldierIds.filter((soldierId) => isAccessManager(context, soldierId))
}

/**
 * Checked on the state AFTER a write that can change permissions: reject the write when no
 * access manager would remain (D-004, D-059).
 */
export function accessManagerIssues(context: PolicyContext): Issue[] {
  if (context.soldierIds.some((soldierId) => isAccessManager(context, soldierId))) return []
  return [{ path: [], code: IssueCode.enum.last_access_manager }]
}

/** `access_grants.valid_to > valid_from`, compared as instants (OI-009, D-058). */
export function accessGrantIssues(grant: Pick<AccessGrant, 'valid_from' | 'valid_to'>): Issue[] {
  if (grant.valid_to === null) return []
  if (compareInstants(grant.valid_to, grant.valid_from) > 0) return []
  return [{ path: ['valid_to'], code: IssueCode.enum.range_inverted }]
}
