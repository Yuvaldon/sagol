import type { PermissionResource, PolicyTarget, SoldierId, Unit, UnitId } from '@contracts'

// Which targets a permission accepts (D-053). The target itself is a contract (D-091).

export type PolicyTargetKind = PolicyTarget['kind']

/** The target of a unit's own row: a top-level unit is organization data (D-053, D-089). */
export function unitTarget(unit: Pick<Unit, 'id' | 'parent_id'>): PolicyTarget {
  return unit.parent_id === null ? { kind: 'organization' } : { kind: 'unit', unit_id: unit.id }
}

/** The target of placing a unit under a parent: the parent, or the organization at the top (D-089). */
export function placementTarget(parentId: UnitId | null): PolicyTarget {
  return parentId === null ? { kind: 'organization' } : { kind: 'unit', unit_id: parentId }
}

/** Every soldier of the organization, for a question about all of them at once (D-162). */
export const EVERY_SOLDIER: PolicyTarget = { kind: 'every_soldier' }

/** The target of a soldier's own rows (D-053). */
export function soldierTarget(soldierId: SoldierId): PolicyTarget {
  return { kind: 'soldier', soldier_id: soldierId }
}

const ORGANIZATION = ['organization'] as const satisfies readonly PolicyTargetKind[]
const SOLDIER = ['soldier', 'every_soldier'] as const satisfies readonly PolicyTargetKind[]

/**
 * Target kinds each resource accepts. `can()` refuses any other kind, so a caller cannot
 * widen a soldier-bound permission by passing an organization target.
 */
export const TARGET_KINDS_BY_RESOURCE = {
  organization: ORGANIZATION,
  unit_levels: ORGANIZATION,
  /** A unit; `organization` for a top-level unit (no parent). */
  units: ['unit', 'organization'],
  command_ranks: ORGANIZATION,
  seniority_overrides: SOLDIER,
  /** A soldier; on creation, the unit of the first placement, or `organization` without one. */
  soldiers: ['soldier', 'every_soldier', 'unit', 'organization'],
  /** A soldier; on creation, the unit of the first placement, or `organization` without one (D-096). */
  soldier_private: ['soldier', 'unit', 'organization'],
  /** The soldier, and the unit a placement points to. */
  memberships: ['soldier', 'every_soldier', 'unit'],
  tags: ORGANIZATION,
  leave_types: ORGANIZATION,
  /**
   * A soldier; `some_unit` asks only whether the actor reads any unit's leaves, to open the dashboard (D-362), and
   * `whole_unit` whether they read all of one unit's, to count it there (D-403).
   */
  leaves: ['soldier', 'every_soldier', 'some_unit', 'whole_unit'],
  leave_comments: SOLDIER,
  internal_comments: SOLDIER,
  /** The deployment's unit; `organization` asks only whether the actor sees any deployment, to open the module (D-179). */
  deployments: ['unit', 'organization'],
  /** The scope unit; `organization` for a global rule (D-031). */
  availability_rules: ['unit', 'organization'],
  properties: ORGANIZATION,
  roles: ORGANIZATION,
  /** The grantee. */
  access_grants: SOLDIER,
  /** A candidate soldier; the placement unit or `organization` without a candidate (D-030). */
  accounts: ['soldier', 'unit', 'organization'],
  data_transfer: ORGANIZATION,
  /** The unit whose report is confirmed (D-293). */
  day_reports: ['unit'],
} as const satisfies Record<PermissionResource, readonly PolicyTargetKind[]>

/** True when `resource` accepts targets of `kind`. */
export function acceptsTarget(resource: PermissionResource, kind: PolicyTargetKind): boolean {
  const kinds: readonly PolicyTargetKind[] = TARGET_KINDS_BY_RESOURCE[resource]
  return kinds.includes(kind)
}
