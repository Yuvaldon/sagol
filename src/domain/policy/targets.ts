import type { PermissionResource, SoldierId, UnitId } from '@contracts'

// What a permission is checked against (D-053).

export type PolicyTarget =
  /** Organization-wide data with no unit or soldier subject. */
  | { kind: 'organization' }
  | { kind: 'unit'; unit_id: UnitId }
  | { kind: 'soldier'; soldier_id: SoldierId }

export type PolicyTargetKind = PolicyTarget['kind']

const ORGANIZATION = ['organization'] as const satisfies readonly PolicyTargetKind[]
const SOLDIER = ['soldier'] as const satisfies readonly PolicyTargetKind[]

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
  soldiers: ['soldier', 'unit', 'organization'],
  soldier_private: SOLDIER,
  /** The soldier, and the unit a placement points to. */
  memberships: ['soldier', 'unit'],
  tags: ORGANIZATION,
  leave_types: ORGANIZATION,
  leaves: SOLDIER,
  leave_comments: SOLDIER,
  internal_comments: SOLDIER,
  deployments: ['unit'],
  /** The scope unit; `organization` for a global rule (D-031). */
  availability_rules: ['unit', 'organization'],
  properties: ORGANIZATION,
  roles: ORGANIZATION,
  /** The grantee. */
  access_grants: SOLDIER,
  /** A candidate soldier; the placement unit or `organization` without a candidate (D-030). */
  accounts: ['soldier', 'unit', 'organization'],
  data_transfer: ORGANIZATION,
} as const satisfies Record<PermissionResource, readonly PolicyTargetKind[]>

/** True when `resource` accepts targets of `kind`. */
export function acceptsTarget(resource: PermissionResource, kind: PolicyTargetKind): boolean {
  const kinds: readonly PolicyTargetKind[] = TARGET_KINDS_BY_RESOURCE[resource]
  return kinds.includes(kind)
}
