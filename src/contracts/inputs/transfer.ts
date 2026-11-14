import { z } from 'zod'
import { Integer, Timestamp } from '../common/scalars'
import { AccountLinkRequest, SoldierAccount, SoldierPreferencesRecord } from '../entities/accounts'
import { Deployment, DeploymentMember } from '../entities/deployments'
import { Unit, UnitLevel } from '../entities/hierarchy'
import {
  Leave,
  LeaveBatch,
  LeaveComment,
  LeaveEvent,
  LeaveType,
  LeaveTypeGroup,
} from '../entities/leaves'
import { Organization } from '../entities/organization'
import { AccessGrant, RankRoleBinding, Role, RolePermission } from '../entities/permissions'
import { PropertyDefinition } from '../entities/properties'
import { ReportConfirmation } from '../entities/reports'
import { AvailabilityRule } from '../entities/rules'
import {
  CommandRank,
  SeniorityOverride,
  Soldier,
  SoldierPrivate,
  UnitMembership,
} from '../entities/soldiers'
import { SoldierTag, Tag, TagCategory } from '../entities/tags'
import { AppError } from '../errors'
import { CreateUnitInput, CreateUnitLevelInput } from './hierarchy'
import { CreateLeaveInput, CreateLeaveTypeGroupInput, CreateLeaveTypeInput } from './leaves'
import { CreateRankRoleBindingInput, CreateRoleInput, GrantAccessInput } from './permissions'
import { CreateAvailabilityRuleInput } from './rules'
import { CreateCommandRankInput, CreateSoldierInput, SetSoldierTagsInput } from './soldiers'
import { CreateTagCategoryInput, CreateTagInput } from './tags'

// Import and export (D-022, D-050). Import runs the same commands as the UI, so it has no
// path of its own around validation or permissions.

function operation<C extends string, I extends z.ZodType>(command: C, input: I) {
  return z.strictObject({ command: z.literal(command), input })
}

/**
 * One step of an import: a command name and its input. Ids are caller-generated (D-044). Only commands that are built
 * are here; a slice that builds a create command adds its operation (D-171).
 */
export const ImportOperation = z.discriminatedUnion('command', [
  operation('create_unit_level', CreateUnitLevelInput),
  operation('create_unit', CreateUnitInput),
  operation('create_command_rank', CreateCommandRankInput),
  operation('create_soldier', CreateSoldierInput),
  operation('set_soldier_tags', SetSoldierTagsInput),
  operation('create_role', CreateRoleInput),
  operation('create_rank_role_binding', CreateRankRoleBindingInput),
  operation('grant_access', GrantAccessInput),
  operation('create_tag_category', CreateTagCategoryInput),
  operation('create_tag', CreateTagInput),
  operation('create_leave_type_group', CreateLeaveTypeGroupInput),
  operation('create_leave_type', CreateLeaveTypeInput),
  operation('create_leave', CreateLeaveInput),
  operation('create_availability_rule', CreateAvailabilityRuleInput),
])
export type ImportOperation = z.infer<typeof ImportOperation>

export const ImportCommand = z.enum(ImportOperation.options.map((option) => option.shape.command.value))
export type ImportCommand = ImportOperation['command']

/**
 * `importBatch`: operations run in order inside one transaction, all or nothing.
 * `dry_run` validates and reports without writing (the import preview). The run stops at the first operation that is
 * refused (D-171).
 */
export const ImportBatchInput = z.strictObject({
  dry_run: z.boolean(),
  operations: z.array(ImportOperation).min(1),
})
export type ImportBatchInput = z.infer<typeof ImportBatchInput>

/**
 * Outcome per operation, by position. `error` NULL = the operation is valid. When every operation is well formed, the
 * results end at the first refused one: the ones after it were not run. When some are malformed, nothing runs and every
 * operation is reported on its form alone (D-171).
 */
export const ImportReport = z.object({
  committed: z.boolean(),
  results: z.array(z.object({ index: Integer.min(0), error: AppError.nullable() })),
})
export type ImportReport = z.infer<typeof ImportReport>

/**
 * The columns of a soldiers CSV file, the import's spreadsheet form (D-171). The header row names them; each row becomes
 * one `create_soldier`. Every column but the names may be left out or empty.
 */
export const SOLDIER_CSV_COLUMNS = ['first_name', 'last_name', 'nickname', 'personal_id', 'phone', 'invite_email'] as const
export type SoldierCsvColumn = (typeof SOLDIER_CSV_COLUMNS)[number]

/** Version of the export file format. Bumped on any incompatible change. */
export const EXPORT_FORMAT_VERSION = 6

/**
 * Full organization export (`data_transfer:export`): every table's rows, as stored.
 * `unit_closure` is derived and never exported (D-039).
 */
export const OrganizationExport = z.object({
  format_version: z.literal(EXPORT_FORMAT_VERSION),
  exported_at: Timestamp,
  tables: z.object({
    organizations: z.array(Organization),
    unit_levels: z.array(UnitLevel),
    units: z.array(Unit),
    command_ranks: z.array(CommandRank),
    soldiers: z.array(Soldier),
    soldier_private: z.array(SoldierPrivate),
    seniority_overrides: z.array(SeniorityOverride),
    unit_memberships: z.array(UnitMembership),
    soldier_accounts: z.array(SoldierAccount),
    account_link_requests: z.array(AccountLinkRequest),
    soldier_preferences: z.array(SoldierPreferencesRecord),
    roles: z.array(Role),
    role_permissions: z.array(RolePermission),
    rank_role_bindings: z.array(RankRoleBinding),
    access_grants: z.array(AccessGrant),
    tag_categories: z.array(TagCategory),
    tags: z.array(Tag),
    soldier_tags: z.array(SoldierTag),
    leave_type_groups: z.array(LeaveTypeGroup),
    leave_types: z.array(LeaveType),
    leave_batches: z.array(LeaveBatch),
    leaves: z.array(Leave),
    leave_events: z.array(LeaveEvent),
    leave_comments: z.array(LeaveComment),
    deployments: z.array(Deployment),
    deployment_members: z.array(DeploymentMember),
    availability_rules: z.array(AvailabilityRule),
    property_definitions: z.array(PropertyDefinition),
    report_confirmations: z.array(ReportConfirmation),
  }),
})
export type OrganizationExport = z.infer<typeof OrganizationExport>
