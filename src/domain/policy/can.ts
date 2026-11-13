import {
  SubjectRankConstraint,
  type Permission,
  type PermissionAction,
  type PermissionResource,
  type PolicyTarget,
  type SoldierId,
  type Timestamp,
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
  if (constraint === SubjectRankConstraint.enum.any) return true
  // Every soldier includes seniors and soldiers without a rank (D-162).
  if (target.kind === 'every_soldier') return false
  if (target.kind !== 'soldier') return true
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
 * `can` through a source without a rank constraint only. A holder changes their own rank this way alone: `junior_or_equal`
 * covers their own record, and a higher rank would widen what their constrained sources reach (D-157).
 */
export function canUnconstrained(
  context: PolicyContext,
  actorId: SoldierId,
  permission: Permission,
  target: PolicyTarget,
): boolean {
  if (!acceptsTarget(permission.resource, target.kind)) return false
  return context
    .permissionsOf(actorId)
    .some(
      (held) =>
        held.subject_rank_constraint === SubjectRankConstraint.enum.any &&
        grants(context, actorId, held, permission.resource, permission.action, target),
    )
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

/** How narrow each constraint is: a grant may narrow the granter's constraint, never widen it. */
const RANK_NARROWNESS: Record<SubjectRankConstraint, number> = { any: 0, junior_or_equal: 1, junior: 2 }

/** What a grant gives beyond its scope: its rank constraint and its end (NULL: open). */
export interface GrantLimits {
  readonly constraint: SubjectRankConstraint
  readonly until: Timestamp | null
}

/**
 * True when the actor holds `permission` at a scope that contains `scope` (D-156), with a rank constraint no wider than
 * the grant's and a source that lasts at least as long as the grant: a grant may give only what lies within the
 * granter's own `access_grants:create`. An empty scope is within nothing.
 */
export function withinReach(
  context: PolicyContext,
  actorId: SoldierId,
  permission: Permission,
  scope: ResolvedScope,
  limits: GrantLimits,
): boolean {
  return context
    .permissionsOf(actorId)
    .some(
      (held) =>
        held.resource === permission.resource &&
        held.action === permission.action &&
        RANK_NARROWNESS[held.subject_rank_constraint] <= RANK_NARROWNESS[limits.constraint] &&
        (held.expires_at === null || (limits.until !== null && limits.until <= held.expires_at)) &&
        scopeWithin(scope, held.scope, context),
    )
}

/** Every soldier of the snapshot who may perform `permission` on `target` now: who approves a soldier, say (D-353). */
export function holdersOf(context: PolicyContext, permission: Permission, target: PolicyTarget): SoldierId[] {
  return context.soldierIds.filter((soldierId) => can(context, soldierId, permission, target))
}
