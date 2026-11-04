import { z } from 'zod'
import { AccessGrantId, RankRoleBindingId, RoleId } from '../common/ids'
import { checkScope } from '../common/refinements'
import {
  AccessGrantColumns,
  RankRoleBindingColumns,
  Role,
  scopeColumns,
} from '../entities/permissions'
import { Permission } from '../permissions'
import { archiveInput, checkDistinct, updateInput } from './common'

// ------------------------------------------------------------------------ roles

/** The full permission set of a role. Each pair appears once and is valid (D-040). */
export const PermissionSet = z.array(Permission).superRefine((permissions, ctx) => {
  checkDistinct(ctx, permissions, (permission) => `${permission.resource}:${permission.action}`)
})
export type PermissionSet = z.infer<typeof PermissionSet>

const roleContent = {
  ...Role.pick({ name: true, description: true, color_key: true }).shape,
  /** Replaces `role_permissions` of the role; the role's version covers the set. */
  permissions: PermissionSet,
}

export const CreateRoleInput = z.strictObject({ id: RoleId, ...roleContent })
export type CreateRoleInput = z.infer<typeof CreateRoleInput>

export const UpdateRoleInput = updateInput(RoleId, roleContent)
export type UpdateRoleInput = z.infer<typeof UpdateRoleInput>

export const ArchiveRoleInput = archiveInput(RoleId)
export type ArchiveRoleInput = z.infer<typeof ArchiveRoleInput>

// ---------------------------------------------------------------- rank bindings

const bindingContent = { role_id: RankRoleBindingColumns.shape.role_id, ...scopeColumns }

export const CreateRankRoleBindingInput = z
  .strictObject({
    id: RankRoleBindingId,
    command_rank_id: RankRoleBindingColumns.shape.command_rank_id,
    ...bindingContent,
  })
  .superRefine((input, ctx) => {
    checkScope(ctx, input)
  })
export type CreateRankRoleBindingInput = z.infer<typeof CreateRankRoleBindingInput>

/** Scope changes are checked on the merged row (D-045). The rank is fixed. */
export const UpdateRankRoleBindingInput = updateInput(RankRoleBindingId, bindingContent)
export type UpdateRankRoleBindingInput = z.infer<typeof UpdateRankRoleBindingInput>

export const ArchiveRankRoleBindingInput = archiveInput(RankRoleBindingId)
export type ArchiveRankRoleBindingInput = z.infer<typeof ArchiveRankRoleBindingInput>

// ---------------------------------------------------------------- access grants

/**
 * `grantAccess`. `valid_from` NULL = the server's current time. Domain checks
 * `valid_to > valid_from` (OI-009). Grants are never edited: revoke and grant again.
 */
export const GrantAccessInput = z
  .strictObject({
    id: AccessGrantId,
    ...AccessGrantColumns.pick({ grantee_soldier_id: true, role_id: true, valid_to: true, reason: true })
      .shape,
    ...scopeColumns,
    valid_from: AccessGrantColumns.shape.valid_from.nullable(),
  })
  .superRefine((input, ctx) => {
    checkScope(ctx, input)
  })
export type GrantAccessInput = z.infer<typeof GrantAccessInput>

/** Revocation is final; the row has no version. Domain keeps one access manager (D-004). */
export const RevokeAccessInput = z.strictObject({ id: AccessGrantId })
export type RevokeAccessInput = z.infer<typeof RevokeAccessInput>
