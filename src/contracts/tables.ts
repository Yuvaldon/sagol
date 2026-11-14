import type { z } from 'zod'
import { AccountLinkRequest, PushSubscriptionRecord, SoldierAccount, SoldierPreferencesRecord } from './entities/accounts'
import { Deployment, DeploymentMember } from './entities/deployments'
import { Unit, UnitLevel } from './entities/hierarchy'
import { Leave, LeaveBatch, LeaveComment, LeaveEvent, LeaveType, LeaveTypeGroup } from './entities/leaves'
import { Organization } from './entities/organization'
import { AccessGrant, RankRoleBinding, Role, RolePermission } from './entities/permissions'
import { PropertyDefinition } from './entities/properties'
import { ChangeCounter, ReportConfirmation } from './entities/reports'
import { AvailabilityRule } from './entities/rules'
import {
  CommandRank,
  SeniorityOverride,
  Soldier,
  SoldierPrivate,
  UnitMembership,
} from './entities/soldiers'
import { SoldierTag, Tag, TagCategory } from './entities/tags'

/**
 * Row schema of every table in docs/schema.sql, keyed by table name (D-038).
 * `unit_closure` is excluded: it is a Postgres-only derived index (D-039).
 * The drift test keeps this map identical to the schema.
 */
export const TABLE_SCHEMAS = {
  organizations: Organization,
  unit_levels: UnitLevel,
  units: Unit,
  command_ranks: CommandRank,
  soldiers: Soldier,
  soldier_private: SoldierPrivate,
  seniority_overrides: SeniorityOverride,
  unit_memberships: UnitMembership,
  soldier_accounts: SoldierAccount,
  account_link_requests: AccountLinkRequest,
  soldier_preferences: SoldierPreferencesRecord,
  roles: Role,
  role_permissions: RolePermission,
  rank_role_bindings: RankRoleBinding,
  access_grants: AccessGrant,
  tag_categories: TagCategory,
  tags: Tag,
  soldier_tags: SoldierTag,
  leave_type_groups: LeaveTypeGroup,
  leave_types: LeaveType,
  leave_batches: LeaveBatch,
  leaves: Leave,
  leave_events: LeaveEvent,
  leave_comments: LeaveComment,
  deployments: Deployment,
  deployment_members: DeploymentMember,
  availability_rules: AvailabilityRule,
  property_definitions: PropertyDefinition,
  report_confirmations: ReportConfirmation,
  change_counters: ChangeCounter,
  push_subscriptions: PushSubscriptionRecord,
} as const satisfies Record<string, z.ZodObject>

export type TableName = keyof typeof TABLE_SCHEMAS

/** The stored row type of a table. */
export type TableRow<T extends TableName> = z.infer<(typeof TABLE_SCHEMAS)[T]>
