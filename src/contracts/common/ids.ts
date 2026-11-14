import { z } from 'zod'

// Branded identifiers, one per table that owns an `id` column (D-038).
// A brand is compile-time only: a SoldierId cannot be passed where a UnitId is expected.

export const OrganizationId = z.uuid().brand<'OrganizationId'>()
export type OrganizationId = z.infer<typeof OrganizationId>

export const UnitLevelId = z.uuid().brand<'UnitLevelId'>()
export type UnitLevelId = z.infer<typeof UnitLevelId>

export const UnitId = z.uuid().brand<'UnitId'>()
export type UnitId = z.infer<typeof UnitId>

export const CommandRankId = z.uuid().brand<'CommandRankId'>()
export type CommandRankId = z.infer<typeof CommandRankId>

export const SoldierId = z.uuid().brand<'SoldierId'>()
export type SoldierId = z.infer<typeof SoldierId>

export const SeniorityOverrideId = z.uuid().brand<'SeniorityOverrideId'>()
export type SeniorityOverrideId = z.infer<typeof SeniorityOverrideId>

export const UnitMembershipId = z.uuid().brand<'UnitMembershipId'>()
export type UnitMembershipId = z.infer<typeof UnitMembershipId>

export const SoldierAccountId = z.uuid().brand<'SoldierAccountId'>()
export type SoldierAccountId = z.infer<typeof SoldierAccountId>

/** Identity issued by the auth provider (`auth_user_id`), not a row of ours. */
export const AuthUserId = z.uuid().brand<'AuthUserId'>()
export type AuthUserId = z.infer<typeof AuthUserId>

export const AccountLinkRequestId = z.uuid().brand<'AccountLinkRequestId'>()
export type AccountLinkRequestId = z.infer<typeof AccountLinkRequestId>

export const RoleId = z.uuid().brand<'RoleId'>()
export type RoleId = z.infer<typeof RoleId>

export const RankRoleBindingId = z.uuid().brand<'RankRoleBindingId'>()
export type RankRoleBindingId = z.infer<typeof RankRoleBindingId>

export const AccessGrantId = z.uuid().brand<'AccessGrantId'>()
export type AccessGrantId = z.infer<typeof AccessGrantId>

export const TagCategoryId = z.uuid().brand<'TagCategoryId'>()
export type TagCategoryId = z.infer<typeof TagCategoryId>

export const TagId = z.uuid().brand<'TagId'>()
export type TagId = z.infer<typeof TagId>

export const SoldierTagId = z.uuid().brand<'SoldierTagId'>()
export type SoldierTagId = z.infer<typeof SoldierTagId>

export const LeaveTypeGroupId = z.uuid().brand<'LeaveTypeGroupId'>()
export type LeaveTypeGroupId = z.infer<typeof LeaveTypeGroupId>

export const LeaveTypeId = z.uuid().brand<'LeaveTypeId'>()
export type LeaveTypeId = z.infer<typeof LeaveTypeId>

export const LeaveBatchId = z.uuid().brand<'LeaveBatchId'>()
export type LeaveBatchId = z.infer<typeof LeaveBatchId>

export const LeaveId = z.uuid().brand<'LeaveId'>()
export type LeaveId = z.infer<typeof LeaveId>

export const LeaveEventId = z.uuid().brand<'LeaveEventId'>()
export type LeaveEventId = z.infer<typeof LeaveEventId>

export const LeaveCommentId = z.uuid().brand<'LeaveCommentId'>()
export type LeaveCommentId = z.infer<typeof LeaveCommentId>

export const DeploymentId = z.uuid().brand<'DeploymentId'>()
export type DeploymentId = z.infer<typeof DeploymentId>

export const ReportConfirmationId = z.uuid().brand<'ReportConfirmationId'>()
export type ReportConfirmationId = z.infer<typeof ReportConfirmationId>

export const PushSubscriptionId = z.uuid().brand<'PushSubscriptionId'>()
export type PushSubscriptionId = z.infer<typeof PushSubscriptionId>

export const AvailabilityRuleId = z.uuid().brand<'AvailabilityRuleId'>()
export type AvailabilityRuleId = z.infer<typeof AvailabilityRuleId>

export const PropertyDefinitionId = z.uuid().brand<'PropertyDefinitionId'>()
export type PropertyDefinitionId = z.infer<typeof PropertyDefinitionId>

/** Id of one option inside `property_definitions.options` (select / multi_select). */
export const PropertyOptionId = z.uuid().brand<'PropertyOptionId'>()
export type PropertyOptionId = z.infer<typeof PropertyOptionId>
