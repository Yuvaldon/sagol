import { z } from 'zod'
import { auditColumns, createdColumns, updatedColumns } from '../common/audit'
import {
  CommandRankId,
  OrganizationId,
  SeniorityOverrideId,
  SoldierId,
  UnitId,
  UnitMembershipId,
} from '../common/ids'
import { checkDateRange } from '../common/refinements'
import {
  CalendarDate,
  ColorKey,
  Email,
  Integer,
  Text,
  Timestamp,
  label,
  varchar,
} from '../common/scalars'
import { MembershipType, SoldierStatus } from '../enums'
import { PropertyValues } from './hierarchy'

/** `command_ranks`: the single user-defined level of a soldier (D-002). */
export const CommandRank = z.object({
  id: CommandRankId,
  organization_id: OrganizationId,
  title: label(100),
  short_title: varchar(20).nullable(),
  /** Higher = more senior. */
  seniority: Integer,
  color_key: ColorKey.nullable(),
  ...auditColumns,
})
export type CommandRank = z.infer<typeof CommandRank>

/** `soldiers`: every user is a soldier (D-001). */
export const Soldier = z.object({
  id: SoldierId,
  organization_id: OrganizationId,
  first_name: label(50),
  last_name: label(50),
  nickname: varchar(50).nullable(),
  /** NULL only before ranks exist (bootstrap). */
  command_rank_id: CommandRankId.nullable(),
  status: SoldierStatus,
  properties: PropertyValues,
  ...auditColumns,
})
export type Soldier = z.infer<typeof Soldier>

/** `soldier_private`: sensitive fields with their own permission resource (D-018). */
export const SoldierPrivate = z.object({
  soldier_id: SoldierId,
  organization_id: OrganizationId,
  personal_id: varchar(50).min(1).nullable(),
  invite_email: Email.nullable(),
  phone: varchar(30).nullable(),
  ...updatedColumns,
})
export type SoldierPrivate = z.infer<typeof SoldierPrivate>

/** Columns of `seniority_overrides`, without row checks. */
export const SeniorityOverrideColumns = z.object({
  id: SeniorityOverrideId,
  organization_id: OrganizationId,
  soldier_id: SoldierId,
  seniority: Integer,
  valid_from: CalendarDate,
  valid_to: CalendarDate.nullable(),
  reason: Text.nullable(),
  ...createdColumns,
  revoked_at: Timestamp.nullable(),
  revoked_by: SoldierId.nullable(),
})

/** `seniority_overrides`: personal seniority, temporary or permanent (D-029). */
export const SeniorityOverride = SeniorityOverrideColumns.superRefine((row, ctx) => {
  checkDateRange(ctx, row.valid_from, row.valid_to, 'valid_to')
})
export type SeniorityOverride = z.infer<typeof SeniorityOverride>

/** Columns of `unit_memberships`, without row checks. */
export const UnitMembershipColumns = z.object({
  id: UnitMembershipId,
  organization_id: OrganizationId,
  soldier_id: SoldierId,
  unit_id: UnitId,
  membership_type: MembershipType,
  valid_from: CalendarDate,
  /** NULL = open. */
  valid_to: CalendarDate.nullable(),
  ...createdColumns,
  ...updatedColumns,
})

/** `unit_memberships`: time-bounded unit membership (D-010). */
export const UnitMembership = UnitMembershipColumns.superRefine((row, ctx) => {
  checkDateRange(ctx, row.valid_from, row.valid_to, 'valid_to')
})
export type UnitMembership = z.infer<typeof UnitMembership>
