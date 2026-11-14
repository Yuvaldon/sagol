import { z } from 'zod'
import { SoldierId, UnitId } from '../common/ids'

// Permission vocabulary (D-003), its valid combinations (D-040) and what a pair is checked
// against (D-053).

export const PermissionResource = z.enum([
  'organization',
  'unit_levels',
  'units',
  'command_ranks',
  'seniority_overrides',
  'soldiers',
  'soldier_private',
  'memberships',
  'tags',
  'leave_types',
  'leaves',
  'leave_comments',
  'internal_comments',
  'deployments',
  'availability_rules',
  'properties',
  'roles',
  'access_grants',
  'accounts',
  'data_transfer',
  'day_reports',
])
export type PermissionResource = z.infer<typeof PermissionResource>

export const PermissionAction = z.enum([
  'view',
  'create',
  'update',
  'delete',
  'duplicate',
  'approve',
  'export',
  'import',
  'confirm',
])
export type PermissionAction = z.infer<typeof PermissionAction>

const MANAGE = ['view', 'create', 'update', 'delete'] as const

/**
 * The only valid `(resource, action)` pairs (D-040). "delete" archives, cancels or revokes;
 * nothing is hard-deleted (D-017).
 */
export const PERMISSION_ACTIONS_BY_RESOURCE = {
  organization: ['view', 'update'],
  unit_levels: MANAGE,
  units: MANAGE,
  command_ranks: MANAGE,
  seniority_overrides: ['view', 'create', 'delete'],
  soldiers: MANAGE,
  soldier_private: ['view', 'update'],
  memberships: ['view', 'update'],
  tags: MANAGE,
  leave_types: MANAGE,
  leaves: ['view', 'create', 'update', 'delete', 'duplicate', 'approve', 'export'],
  leave_comments: ['view', 'create'],
  internal_comments: ['view', 'create'],
  deployments: MANAGE,
  availability_rules: MANAGE,
  properties: MANAGE,
  roles: MANAGE,
  access_grants: ['view', 'create', 'delete'],
  accounts: ['view', 'approve'],
  data_transfer: ['export', 'import'],
  /** A unit's daily report, confirmed per date (D-293). */
  day_reports: ['confirm'],
} as const satisfies Record<PermissionResource, readonly PermissionAction[]>

function pairOf<R extends PermissionResource>(resource: R) {
  return z.object({
    resource: z.literal(resource),
    action: z.enum(PERMISSION_ACTIONS_BY_RESOURCE[resource]),
  })
}

/** A valid permission pair, e.g. `{ resource: 'leaves', action: 'approve' }`. Rejects pairs outside D-040. */
export const Permission = z.discriminatedUnion('resource', [
  pairOf('organization'),
  pairOf('unit_levels'),
  pairOf('units'),
  pairOf('command_ranks'),
  pairOf('seniority_overrides'),
  pairOf('soldiers'),
  pairOf('soldier_private'),
  pairOf('memberships'),
  pairOf('tags'),
  pairOf('leave_types'),
  pairOf('leaves'),
  pairOf('leave_comments'),
  pairOf('internal_comments'),
  pairOf('deployments'),
  pairOf('availability_rules'),
  pairOf('properties'),
  pairOf('roles'),
  pairOf('access_grants'),
  pairOf('accounts'),
  pairOf('data_transfer'),
  pairOf('day_reports'),
])
export type Permission = z.infer<typeof Permission>

/** What a permission is checked against (D-053). */
export const PolicyTarget = z.discriminatedUnion('kind', [
  /** Organization-wide data with no unit or soldier subject. */
  z.object({ kind: z.literal('organization') }),
  z.object({ kind: z.literal('unit'), unit_id: UnitId }),
  z.object({ kind: z.literal('soldier'), soldier_id: SoldierId }),
  /** Every soldier of the organization, whatever their unit or rank: only organization scope with `any` covers it (D-162). */
  z.object({ kind: z.literal('every_soldier') }),
  /** Some unit: the actor holds the permission over at least one unit, at unit or organization scope, to open a commander's module (D-362). */
  z.object({ kind: z.literal('some_unit') }),
])
export type PolicyTarget = z.infer<typeof PolicyTarget>

/** One "can I?" question for the signed-in soldier (D-085, D-091). */
export const PermissionCheck = z.object({ permission: Permission, target: PolicyTarget })
export type PermissionCheck = z.infer<typeof PermissionCheck>
