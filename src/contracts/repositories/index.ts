import { z } from 'zod'
import {
  AccessGrantId,
  AccountLinkRequestId,
  AvailabilityRuleId,
  CommandRankId,
  DeploymentId,
  LeaveBatchId,
  LeaveCommentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  PropertyDefinitionId,
  RankRoleBindingId,
  RoleId,
  SeniorityOverrideId,
  SoldierAccountId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitLevelId,
  UnitMembershipId,
} from '../common/ids'
import { checkDateRange } from '../common/refinements'
import type { AsyncResult, Unsubscribe } from '../common/result'
import { CalendarDate } from '../common/scalars'
import type {
  AccountLinkRequest,
  SoldierAccount,
  SoldierPreferencesRecord,
} from '../entities/accounts'
import type { Deployment, DeploymentMember } from '../entities/deployments'
import type { Unit, UnitLevel } from '../entities/hierarchy'
import type {
  Leave,
  LeaveBatch,
  LeaveComment,
  LeaveEvent,
  LeaveType,
  LeaveTypeGroup,
} from '../entities/leaves'
import type { Organization } from '../entities/organization'
import type { AccessGrant, RankRoleBinding, Role, RolePermission } from '../entities/permissions'
import type { PropertyDefinition } from '../entities/properties'
import type { ReportConfirmation } from '../entities/reports'
import type { AvailabilityRule } from '../entities/rules'
import type {
  CommandRank,
  SeniorityOverride,
  Soldier,
  SoldierPrivate,
  UnitMembership,
} from '../entities/soldiers'
import type { SoldierTag, Tag, TagCategory } from '../entities/tags'
import { AccountLinkRequestStatus, LeaveStatus } from '../enums'
import type { TableName } from '../tables'

// Read side of the data layer (ARCHITECTURE "Server-authoritative data layer").
// Every read is filtered by the domain policy inside the adapter: a row the actor may not
// view is absent from lists and answers `not_found` on `get` (D-046).
// In queries, a NULL list means "no restriction on this field".

// ------------------------------------------------------------------- queries

/** Reference data: unit levels, units, ranks, soldiers, roles, tags, leave types, ... */
export const ReferenceQuery = z.strictObject({ include_archived: z.boolean() })
export type ReferenceQuery = z.infer<typeof ReferenceQuery>

/** No filter (tables read in full, e.g. leave batches). */
export const EmptyQuery = z.strictObject({})
export type EmptyQuery = z.infer<typeof EmptyQuery>

/** Inclusive calendar window. */
export const DateWindow = z
  .strictObject({ start_date: CalendarDate, end_date: CalendarDate })
  .superRefine((window, ctx) => {
    checkDateRange(ctx, window.start_date, window.end_date, 'end_date')
  })
export type DateWindow = z.infer<typeof DateWindow>

/** Leaves overlapping the window; a NULL window means any dates (D-120). */
export const LeaveQuery = z.strictObject({
  window: DateWindow.nullable(),
  soldier_ids: z.array(SoldierId).nullable(),
  statuses: z.array(LeaveStatus).nullable(),
})
export type LeaveQuery = z.infer<typeof LeaveQuery>

/** Memberships; with a window, those overlapping it. */
export const MembershipQuery = z.strictObject({
  soldier_ids: z.array(SoldierId).nullable(),
  unit_ids: z.array(UnitId).nullable(),
  window: DateWindow.nullable(),
})
export type MembershipQuery = z.infer<typeof MembershipQuery>

/** Rows keyed by soldier: private fields, tags, accounts. */
export const SoldierScopedQuery = z.strictObject({ soldier_ids: z.array(SoldierId).nullable() })
export type SoldierScopedQuery = z.infer<typeof SoldierScopedQuery>

export const SeniorityOverrideQuery = z.strictObject({
  soldier_ids: z.array(SoldierId).nullable(),
  include_revoked: z.boolean(),
})
export type SeniorityOverrideQuery = z.infer<typeof SeniorityOverrideQuery>

/** `include_inactive` adds revoked and expired grants. */
export const AccessGrantQuery = z.strictObject({
  grantee_soldier_ids: z.array(SoldierId).nullable(),
  include_inactive: z.boolean(),
})
export type AccessGrantQuery = z.infer<typeof AccessGrantQuery>

export const RolePermissionQuery = z.strictObject({ role_ids: z.array(RoleId).nullable() })
export type RolePermissionQuery = z.infer<typeof RolePermissionQuery>

export const AccountLinkRequestQuery = z.strictObject({
  statuses: z.array(AccountLinkRequestStatus).nullable(),
})
export type AccountLinkRequestQuery = z.infer<typeof AccountLinkRequestQuery>

/** Events or comments of one leave, oldest first. */
export const LeaveThreadQuery = z.strictObject({ leave_id: LeaveId })
export type LeaveThreadQuery = z.infer<typeof LeaveThreadQuery>

/**
 * The events of one rotation's leaves of these soldiers (D-349, D-361), oldest first: what the plan modules replay.
 * An event is read when its leave is read, as in the thread.
 */
export const LeaveEventSpanQuery = z.strictObject({
  deployment_id: DeploymentId,
  soldier_ids: z.array(SoldierId),
})
export type LeaveEventSpanQuery = z.infer<typeof LeaveEventSpanQuery>

/** A leave's thread, or a rotation's span. */
export const LeaveEventQuery = z.union([LeaveThreadQuery, LeaveEventSpanQuery])
export type LeaveEventQuery = z.infer<typeof LeaveEventQuery>

export const DeploymentMemberQuery = z.strictObject({
  deployment_ids: z.array(DeploymentId).nullable(),
})
export type DeploymentMemberQuery = z.infer<typeof DeploymentMemberQuery>

/** The daily report confirmations of the window's dates; NULL units means every unit (D-293). */
export const ReportConfirmationQuery = z.strictObject({
  window: DateWindow,
  unit_ids: z.array(UnitId).nullable(),
})
export type ReportConfirmationQuery = z.infer<typeof ReportConfirmationQuery>

/** Which of the units' reports the actor may confirm on the window's dates (D-293). */
export const ConfirmableReportQuery = z.strictObject({
  window: DateWindow,
  unit_ids: z.array(UnitId),
})
export type ConfirmableReportQuery = z.infer<typeof ConfirmableReportQuery>

/**
 * A unit's report of a date the actor may confirm now: the permission on the unit, and an open live rotation over it
 * on the date, read on the whole unit tree, which the actor may not see (D-293).
 */
export const ConfirmableReport = z.object({ unit_id: UnitId, report_date: CalendarDate })
export type ConfirmableReport = z.infer<typeof ConfirmableReport>

/** The sections of the rotations' reports on the window's dates, as the summary's reader counts them (D-303). */
export const ReportSectionQuery = z.strictObject({
  window: DateWindow,
  deployment_ids: z.array(DeploymentId),
})
export type ReportSectionQuery = z.infer<typeof ReportSectionQuery>

/**
 * How many unit sections the rotations' report holds on a date, read on the whole unit tree, which the actor may not
 * see: the units under a rotation that runs on the date and whose summary the actor reads, each holding an active
 * soldier on the date (D-303). `unseen` counts those of them the actor's own report does not head: no soldier of it is
 * one the actor views with their unit. Counts, so no unit outside the actor's view is named.
 */
export const ReportSectionCount = z.object({
  report_date: CalendarDate,
  sections: z.number().int().nonnegative(),
  unseen: z.number().int().nonnegative(),
})
export type ReportSectionCount = z.infer<typeof ReportSectionCount>

/** Why a soldier is proposed for a link request (D-030). Shown to the reviewer only. */
export const LinkCandidateMatch = z.enum(['personal_id', 'name'])
export type LinkCandidateMatch = z.infer<typeof LinkCandidateMatch>

export const LinkCandidate = z.object({ soldier_id: SoldierId, match: LinkCandidateMatch })
export type LinkCandidate = z.infer<typeof LinkCandidate>

// -------------------------------------------------------------- repositories

/** A table whose rows have a single id. */
export interface EntityRepository<Row, Id, Query> {
  get(id: Id): AsyncResult<Row>
  list(query: Query): AsyncResult<Row[]>
}

/** A table keyed by a composite key: read as lists only. */
export interface ListRepository<Row, Query> {
  list(query: Query): AsyncResult<Row[]>
}

/** One entry per table of `TABLE_SCHEMAS` (checked by a type test). */
export interface DataRepositories {
  /** The session's organization (D-045). */
  organizations: { current(): AsyncResult<Organization> }
  unit_levels: EntityRepository<UnitLevel, UnitLevelId, ReferenceQuery>
  units: EntityRepository<Unit, UnitId, ReferenceQuery>
  command_ranks: EntityRepository<CommandRank, CommandRankId, ReferenceQuery>
  soldiers: EntityRepository<Soldier, SoldierId, ReferenceQuery>
  /** Keyed by soldier id. Needs `soldier_private:view` (D-018). */
  soldier_private: EntityRepository<SoldierPrivate, SoldierId, SoldierScopedQuery>
  seniority_overrides: EntityRepository<SeniorityOverride, SeniorityOverrideId, SeniorityOverrideQuery>
  unit_memberships: EntityRepository<UnitMembership, UnitMembershipId, MembershipQuery>
  soldier_accounts: EntityRepository<SoldierAccount, SoldierAccountId, SoldierScopedQuery>
  account_link_requests: EntityRepository<
    AccountLinkRequest,
    AccountLinkRequestId,
    AccountLinkRequestQuery
  > & {
    /** Candidate soldiers for a request (D-030). Reviewers only; never the requester. */
    candidates(id: AccountLinkRequestId): AsyncResult<LinkCandidate[]>
  }
  /** The signed-in soldier's own row; NULL until first saved. */
  soldier_preferences: { mine(): AsyncResult<SoldierPreferencesRecord | null> }
  roles: EntityRepository<Role, RoleId, ReferenceQuery>
  role_permissions: ListRepository<RolePermission, RolePermissionQuery>
  rank_role_bindings: EntityRepository<RankRoleBinding, RankRoleBindingId, ReferenceQuery>
  access_grants: EntityRepository<AccessGrant, AccessGrantId, AccessGrantQuery>
  tag_categories: EntityRepository<TagCategory, TagCategoryId, ReferenceQuery>
  tags: EntityRepository<Tag, TagId, ReferenceQuery>
  soldier_tags: ListRepository<SoldierTag, SoldierScopedQuery>
  leave_type_groups: EntityRepository<LeaveTypeGroup, LeaveTypeGroupId, ReferenceQuery>
  leave_types: EntityRepository<LeaveType, LeaveTypeId, ReferenceQuery>
  leave_batches: EntityRepository<LeaveBatch, LeaveBatchId, EmptyQuery>
  leaves: EntityRepository<Leave, LeaveId, LeaveQuery>
  leave_events: ListRepository<LeaveEvent, LeaveEventQuery>
  /** Internal comments only with `internal_comments:view`. */
  leave_comments: EntityRepository<LeaveComment, LeaveCommentId, LeaveThreadQuery>
  deployments: EntityRepository<Deployment, DeploymentId, ReferenceQuery>
  deployment_members: ListRepository<DeploymentMember, DeploymentMemberQuery>
  availability_rules: EntityRepository<AvailabilityRule, AvailabilityRuleId, ReferenceQuery>
  property_definitions: EntityRepository<PropertyDefinition, PropertyDefinitionId, ReferenceQuery>
  /** Readable by who views the unit, may confirm it, or owns the report of a rotation over it (D-293). */
  report_confirmations: ListRepository<ReportConfirmation, ReportConfirmationQuery> & {
    confirmable(query: ConfirmableReportQuery): AsyncResult<ConfirmableReport[]>
    sections(query: ReportSectionQuery): AsyncResult<ReportSectionCount[]>
  }
}

// ------------------------------------------------------------------- changes

/**
 * Rows changed by one committed write. `ids` are the row ids; for composite-key tables
 * (role_permissions, soldier_tags, deployment_members, soldier_private) they are the
 * owning row's id (role, soldier, deployment, soldier).
 */
export type DataChange = { table: TableName; ids: readonly string[] }

/** One live source of truth across views and tabs (ARCHITECTURE). */
export interface ChangeFeed {
  subscribe(listener: (changes: readonly DataChange[]) => void): Unsubscribe
}
