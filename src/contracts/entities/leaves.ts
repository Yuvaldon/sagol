import { z } from 'zod'
import { auditColumns, createdColumns, updatedColumns } from '../common/audit'
import {
  AvailabilityRuleId,
  LeaveBatchId,
  LeaveCommentId,
  LeaveEventId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
} from '../common/ids'
import { checkDateRange } from '../common/refinements'
import {
  CalendarDate,
  ColorKey,
  IconKey,
  Integer,
  JsonValue,
  Text,
  Timestamp,
  label,
} from '../common/scalars'
import { AvailabilityEffect, CommentVisibility, LeaveEventType, LeaveStatus } from '../enums'
import { PropertyValues } from './hierarchy'

/** `leave_type_groups`: user-defined categories (vacation, course, mission, ...). */
export const LeaveTypeGroup = z.object({
  id: LeaveTypeGroupId,
  organization_id: OrganizationId,
  name: label(100),
  sort_order: Integer,
  ...auditColumns,
})
export type LeaveTypeGroup = z.infer<typeof LeaveTypeGroup>

/** `leave_types`: user-managed, nothing predefined (D-032). */
export const LeaveType = z.object({
  id: LeaveTypeId,
  organization_id: OrganizationId,
  group_id: LeaveTypeGroupId.nullable(),
  name: label(100),
  color_key: ColorKey,
  icon_key: IconKey.nullable(),
  availability_effect: AvailabilityEffect,
  requires_reason: z.boolean(),
  sort_order: Integer,
  ...auditColumns,
})
export type LeaveType = z.infer<typeof LeaveType>

/** `leave_batches`: leaves created together (collective leave, rotation round). */
export const LeaveBatch = z.object({
  id: LeaveBatchId,
  organization_id: OrganizationId,
  name: label(255),
  description: Text.nullable(),
  ...createdColumns,
})
export type LeaveBatch = z.infer<typeof LeaveBatch>

/** Columns of `leaves`, without row checks. */
export const LeaveColumns = z.object({
  id: LeaveId,
  organization_id: OrganizationId,
  soldier_id: SoldierId,
  leave_type_id: LeaveTypeId,
  batch_id: LeaveBatchId.nullable(),
  start_date: CalendarDate,
  end_date: CalendarDate,
  status: LeaveStatus,
  /** NULL = use the effect of the leave type (D-032). */
  availability_effect_override: AvailabilityEffect.nullable(),
  reason: Text.nullable(),
  reviewed_by: SoldierId.nullable(),
  reviewed_at: Timestamp.nullable(),
  properties: PropertyValues,
  ...createdColumns,
  ...updatedColumns,
})

/**
 * `leaves`: whole days, `end_date` inclusive, overlaps allowed (D-012).
 * Leaves are cancelled, never archived (D-017).
 */
export const Leave = LeaveColumns.superRefine((row, ctx) => {
  checkDateRange(ctx, row.start_date, row.end_date, 'end_date')
})
export type Leave = z.infer<typeof Leave>

/** Before/after of one changed field in a leave event. */
export const FieldChange = z.object({ before: JsonValue, after: JsonValue })
export type FieldChange = z.infer<typeof FieldChange>

/** `leave_events`: append-only audit trail. */
export const LeaveEvent = z.object({
  id: LeaveEventId,
  organization_id: OrganizationId,
  leave_id: LeaveId,
  actor_id: SoldierId,
  event_type: LeaveEventType,
  from_status: LeaveStatus.nullable(),
  to_status: LeaveStatus.nullable(),
  /** Keyed by `leaves` column name. */
  changes: z.record(z.string(), FieldChange),
  /** Soft rules knowingly overridden (D-014). */
  acknowledged_rule_ids: z.array(AvailabilityRuleId),
  created_at: Timestamp,
})
export type LeaveEvent = z.infer<typeof LeaveEvent>

/** `leave_comments`. `internal` visibility requires the internal_comments resource. */
export const LeaveComment = z.object({
  id: LeaveCommentId,
  organization_id: OrganizationId,
  leave_id: LeaveId,
  author_id: SoldierId,
  body: Text.trim().min(1),
  visibility: CommentVisibility,
  created_at: Timestamp,
  edited_at: Timestamp.nullable(),
  archived_at: Timestamp.nullable(),
})
export type LeaveComment = z.infer<typeof LeaveComment>
