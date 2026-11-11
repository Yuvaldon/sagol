import {
  SubjectRankConstraint,
  type Permission,
  type PermissionAction,
  type PermissionResource,
  type PolicyTarget,
  type SoldierId,
} from '@contracts'
import type { EffectivePermission, PolicyContext } from './context'
import { scopeCovers, scopeWithin, type ResolvedScope } from './scope'
import { acceptsTarget } from './targets'

// The one authorization check (D-007): the local adapter, logic's "can I?" hints and the
// test matrix all call it; Postgres `has_permission()` mirrors it in phase 8.

/** `subject_rank_constraint` against a soldier target (D-029, D-057). */
function rankAllows(
  context: PolicyContext,
  constraint: SubjectRankConstraint,
  holderId: SoldierId,
  target: PolicyTarget,
): boolean {
  if (constraint === SubjectRankConstraint.enum.any || target.kind !== 'soldier') return true
  // A holder without seniority gets only `any`, their own record included (D-057, D-157).
  const holder = context.seniorityOf(holderId)
  if (holder === null) return false
  if (target.soldier_id === holderId) return constraint === SubjectRankConstraint.enum.junior_or_equal
  const subject = context.seniorityOf(target.soldier_id)
  if (subject === null) return true
  return constraint === SubjectRankConstraint.enum.junior ? subject < holder : subject <= holder
}

function grants(
  context: PolicyContext,
  holderId: SoldierId,
  permission: EffectivePermission,
  resource: PermissionResource,
  action: PermissionAction,
  target: PolicyTarget,
): boolean {
  return (
    permission.resource === resource &&
    permission.action === action &&
    scopeCovers(permission.scope, action, target, context) &&
    rankAllows(context, permission.subject_rank_constraint, holderId, target)
  )
}

/** True when `actorId` may perform `permission` on `target` now (D-053 … D-058). */
export function can(
  context: PolicyContext,
  actorId: SoldierId,
  permission: Permission,
  target: PolicyTarget,
): boolean {
  if (!acceptsTarget(permission.resource, target.kind)) return false
  return context
    .permissionsOf(actorId)
    .some((held) => grants(context, actorId, held, permission.resource, permission.action, target))
}

/**
 * The pairs of `permissions` the actor does not hold at any non-empty scope. Granting a
 * role or adding pairs to a role needs this to be empty (D-060); otherwise `forbidden`.
 */
export function missingPermissions(
  context: PolicyContext,
  actorId: SoldierId,
  permissions: readonly Permission[],
): Permission[] {
  const held = context.permissionsOf(actorId).filter((permission) => permission.scope.kind !== 'empty')
  return permissions.filter(
    (wanted) =>
      !held.some(
        (permission) => permission.resource === wanted.resource && permission.action === wanted.action,
      ),
  )
}

/**
 * True when the actor holds `permission` at a scope that contains `scope` (D-156): a grant
 * may give a scope only within the granter's own `access_grants:create`. An empty scope is
 * within nothing.
 */
export function withinReach(
  context: PolicyContext,
  actorId: SoldierId,
  permission: Permission,
  scope: ResolvedScope,
): boolean {
  return context
    .permissionsOf(actorId)
    .some(
      (held) =>
        held.resource === permission.resource &&
        held.action === permission.action &&
        scopeWithin(scope, held.scope, context),
    )
}
