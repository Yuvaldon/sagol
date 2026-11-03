import { z } from 'zod'
import { auditColumns } from '../common/audit'
import {
  AccessGrantId,
  CommandRankId,
  OrganizationId,
  RankRoleBindingId,
  RoleId,
  SoldierId,
  UnitId,
  UnitLevelId,
} from '../common/ids'
import { SchemaIssue } from '../common/issues'
import { checkScope } from '../common/refinements'
import { ColorKey, Integer, Text, Timestamp, label } from '../common/scalars'
import { ScopeAnchorType, SubjectRankConstraint } from '../enums'
import { Permission, PermissionAction, PermissionResource } from '../permissions'

/** `roles`: user-defined permission sets (D-003). */
export const Role = z.object({
  id: RoleId,
  organization_id: OrganizationId,
  name: label(100),
  description: Text.nullable(),
  color_key: ColorKey.nullable(),
  ...auditColumns,
})
export type Role = z.infer<typeof Role>

/** `role_permissions`. Only the pairs of D-040 are valid. */
export const RolePermission = z
  .object({
    role_id: RoleId,
    organization_id: OrganizationId,
    resource: PermissionResource,
    action: PermissionAction,
  })
  .superRefine((row, ctx) => {
    if (Permission.safeParse(row).success) return
    ctx.addIssue({
      code: 'custom',
      message: SchemaIssue.enum.invalid_permission_pair,
      path: ['action'],
    })
  })
export type RolePermission = z.infer<typeof RolePermission>

/** Scope columns shared by rank bindings and access grants (D-028). */
const scopeColumns = {
  anchor_type: ScopeAnchorType,
  anchor_unit_id: UnitId.nullable(),
  anchor_soldier_id: SoldierId.nullable(),
  anchor_level_id: UnitLevelId.nullable(),
  anchor_steps: Integer.min(1).nullable(),
  include_descendants: z.boolean(),
  subject_rank_constraint: SubjectRankConstraint,
}

/** `rank_role_bindings`: default roles of a command rank, general per rank. */
export const RankRoleBinding = z
  .object({
    id: RankRoleBindingId,
    organization_id: OrganizationId,
    command_rank_id: CommandRankId,
    role_id: RoleId,
    ...scopeColumns,
    ...auditColumns,
  })
  .superRefine((row, ctx) => {
    checkScope(ctx, row)
  })
export type RankRoleBinding = z.infer<typeof RankRoleBinding>

/**
 * `access_grants`: explicit, time-bounded, revocable grants to one soldier.
 * `valid_to > valid_from` compares instants, so domain checks it (D-042).
 */
export const AccessGrant = z
  .object({
    id: AccessGrantId,
    organization_id: OrganizationId,
    grantee_soldier_id: SoldierId,
    role_id: RoleId,
    ...scopeColumns,
    valid_from: Timestamp,
    /** NULL = until revoked. */
    valid_to: Timestamp.nullable(),
    reason: Text.nullable(),
    /** NULL only for bootstrap. */
    granted_by: SoldierId.nullable(),
    granted_at: Timestamp,
    revoked_at: Timestamp.nullable(),
    revoked_by: SoldierId.nullable(),
  })
  .superRefine((row, ctx) => {
    checkScope(ctx, row)
  })
export type AccessGrant = z.infer<typeof AccessGrant>
