import {
  PermissionCheck,
  type Organization,
  type OrganizationId,
  type Permission,
  type PolicyTarget,
  type SoldierId,
  type Timestamp,
} from '@contracts'
import { can, type PolicyContext } from '@domain'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, parseInput } from './failure'
import { requireLinked, resolveSession } from './session'
import { POLICY_TABLES, loadPolicySnapshot } from './snapshot'
import { z } from 'zod'

// Who acts, and what the policy says about them, on one consistent state. The actor comes from the
// session, never from a caller (D-008).

export interface ActorScope {
  readonly soldier_id: SoldierId
  readonly organization_id: OrganizationId
  readonly now: Timestamp
  readonly organization: Organization
  readonly context: PolicyContext
}

export async function loadActorScope({ database, identity, time }: LocalDependencies): Promise<ActorScope> {
  const actor = requireLinked(await resolveSession(database, identity.current()))
  const now = time.now()
  const { organization, context } = await loadPolicySnapshot(database, actor.organization_id, now)
  return { soldier_id: actor.soldier_id, organization_id: actor.organization_id, now, organization, context }
}

export function holds(scope: ActorScope, permission: Permission, target: PolicyTarget): boolean {
  return can(scope.context, scope.soldier_id, permission, target)
}

/** The actor sees the target but may not act on it (D-046). */
export function requirePermission(scope: ActorScope, permission: Permission, target: PolicyTarget): void {
  if (!holds(scope, permission, target)) fail({ code: 'forbidden' })
}

const PermissionChecks = z.array(PermissionCheck)

/** The hint behind gated controls (D-091). The command decides again. */
export function createPermissionHints(dependencies: LocalDependencies) {
  return {
    can: (raw: readonly PermissionCheck[]) =>
      asResult(() => {
        const checks = parseInput(PermissionChecks, raw)
        return dependencies.database.transaction('r', POLICY_TABLES, async () => {
          const scope = await loadActorScope(dependencies)
          return checks.map((check) => holds(scope, check.permission, check.target))
        })
      }),
  }
}
