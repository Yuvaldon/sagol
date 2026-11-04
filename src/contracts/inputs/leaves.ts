import { z } from 'zod'
import { LeaveCommentId, LeaveId, LeaveTypeGroupId, LeaveTypeId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import {
  LeaveBatch,
  LeaveColumns,
  LeaveComment,
  LeaveType,
  LeaveTypeGroup,
} from '../entities/leaves'
import {
  AcknowledgedRuleIds,
  ExpectedVersion,
  archiveInput,
  changesOf,
  checkDistinct,
  reorderInput,
  updateInput,
} from './common'

// ----------------------------------------------------------- leave type groups

export const CreateLeaveTypeGroupInput = z.strictObject(
  LeaveTypeGroup.pick({ id: true, name: true, sort_order: true }).shape,
)
export type CreateLeaveTypeGroupInput = z.infer<typeof CreateLeaveTypeGroupInput>

export const UpdateLeaveTypeGroupInput = updateInput(
  LeaveTypeGroupId,
  LeaveTypeGroup.pick({ name: true }).shape,
)
export type UpdateLeaveTypeGroupInput = z.infer<typeof UpdateLeaveTypeGroupInput>

export const ArchiveLeaveTypeGroupInput = archiveInput(LeaveTypeGroupId)
export type ArchiveLeaveTypeGroupInput = z.infer<typeof ArchiveLeaveTypeGroupInput>

export const ReorderLeaveTypeGroupsInput = reorderInput(LeaveTypeGroupId)
export type ReorderLeaveTypeGroupsInput = z.infer<typeof ReorderLeaveTypeGroupsInput>

// ----------------------------------------------------------------- leave types

const leaveTypeContent = LeaveType.pick({
  group_id: true,
  name: true,
  color_key: true,
  icon_key: true,
  availability_effect: true,
  requires_reason: true,
}).shape

export const CreateLeaveTypeInput = z.strictObject({
  id: LeaveTypeId,
  ...leaveTypeContent,
  sort_order: LeaveType.shape.sort_order,
})
export type CreateLeaveTypeInput = z.infer<typeof CreateLeaveTypeInput>

export const UpdateLeaveTypeInput = updateInput(LeaveTypeId, leaveTypeContent)
export type UpdateLeaveTypeInput = z.infer<typeof UpdateLeaveTypeInput>

export const ArchiveLeaveTypeInput = archiveInput(LeaveTypeId)
export type ArchiveLeaveTypeInput = z.infer<typeof ArchiveLeaveTypeInput>

export const ReorderLeaveTypesInput = reorderInput(LeaveTypeId)
export type ReorderLeaveTypesInput = z.infer<typeof ReorderLeaveTypesInput>

// ---------------------------------------------------------------------- leaves

/** A comment written together with a leave command (approve with a note, ...). */
export const CommentDraft = z.strictObject({
  id: LeaveCommentId,
  ...LeaveComment.pick({ body: true, visibility: true }).shape,
})
export type CommentDraft = z.infer<typeof CommentDraft>

/** Fields of a leave its author sets; `status` and review columns belong to commands. */
const leaveDetails = LeaveColumns.pick({
  leave_type_id: true,
  availability_effect_override: true,
  reason: true,
  properties: true,
}).shape

const leaveDates = LeaveColumns.pick({ start_date: true, end_date: true }).shape

/** One new leave inside a create, batch or duplicate command. */
const NewLeave = z
  .strictObject({
    id: LeaveId,
    soldier_id: LeaveColumns.shape.soldier_id,
    ...leaveDates,
    ...leaveDetails,
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })

/**
 * Fields every leave-creating command shares. `as_approved` creates the leave approved in
 * one step; the server re-checks `leaves:approve` over each soldier (D-013).
 */
const creationFlags = {
  as_approved: z.boolean(),
  acknowledged_rule_ids: AcknowledgedRuleIds,
}

/** `createLeave`. New leaves are `pending` unless created as approved (D-013). */
export const CreateLeaveInput = z
  .strictObject({
    id: LeaveId,
    soldier_id: LeaveColumns.shape.soldier_id,
    ...leaveDates,
    ...leaveDetails,
    ...creationFlags,
    comment: CommentDraft.nullable(),
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })
export type CreateLeaveInput = z.infer<typeof CreateLeaveInput>

/** `createLeaveBatch`: leaves created together (collective leave, D-012), atomically (D-049). */
export const CreateLeaveBatchInput = z.strictObject({
  batch: z.strictObject(LeaveBatch.pick({ id: true, name: true, description: true }).shape),
  leaves: z
    .array(NewLeave)
    .min(1)
    .superRefine((leaves, ctx) => {
      checkDistinct(ctx, leaves, (leave) => leave.id)
    }),
  ...creationFlags,
})
export type CreateLeaveBatchInput = z.infer<typeof CreateLeaveBatchInput>

/** One copy of `duplicateLeave`: another soldier and/or other dates. */
const LeaveCopy = z
  .strictObject({ id: LeaveId, soldier_id: LeaveColumns.shape.soldier_id, ...leaveDates })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })

/**
 * `duplicateLeave` (`leaves:duplicate`, D-049): copies type, effect override, reason and
 * properties of `leave_id` into new leaves. Comments and history are not copied.
 */
export const DuplicateLeaveInput = z.strictObject({
  leave_id: LeaveId,
  copies: z
    .array(LeaveCopy)
    .min(1)
    .superRefine((copies, ctx) => {
      checkDistinct(ctx, copies, (copy) => copy.id)
    }),
  ...creationFlags,
})
export type DuplicateLeaveInput = z.infer<typeof DuplicateLeaveInput>

/** `updateLeave`: details other than dates and status (event `updated`). */
export const UpdateLeaveInput = z.strictObject({
  id: LeaveId,
  expected_version: ExpectedVersion,
  changes: changesOf(leaveDetails),
  acknowledged_rule_ids: AcknowledgedRuleIds,
})
export type UpdateLeaveInput = z.infer<typeof UpdateLeaveInput>

/**
 * `rescheduleLeave` (event `rescheduled`). An approved leave stays approved or returns to
 * pending according to `reschedule_policy` (D-013, D-041).
 */
export const RescheduleLeaveInput = z
  .strictObject({
    id: LeaveId,
    expected_version: ExpectedVersion,
    ...leaveDates,
    acknowledged_rule_ids: AcknowledgedRuleIds,
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })
export type RescheduleLeaveInput = z.infer<typeof RescheduleLeaveInput>

/** Status transitions. Which ones are allowed from which status is domain's state machine. */
export const LeaveTransition = z.enum(['approve', 'reject', 'cancel', 'reopen'])
export type LeaveTransition = z.infer<typeof LeaveTransition>

export const TransitionLeaveInput = z.strictObject({
  id: LeaveId,
  expected_version: ExpectedVersion,
  transition: LeaveTransition,
  acknowledged_rule_ids: AcknowledgedRuleIds,
  comment: CommentDraft.nullable(),
})
export type TransitionLeaveInput = z.infer<typeof TransitionLeaveInput>

// ---------------------------------------------------------------- comments

export const AddLeaveCommentInput = z.strictObject({
  ...CommentDraft.shape,
  leave_id: LeaveComment.shape.leave_id,
})
export type AddLeaveCommentInput = z.infer<typeof AddLeaveCommentInput>

/** Comments have no version; only the author edits or archives (domain). */
export const EditLeaveCommentInput = z.strictObject({
  id: LeaveCommentId,
  body: LeaveComment.shape.body,
})
export type EditLeaveCommentInput = z.infer<typeof EditLeaveCommentInput>

export const ArchiveLeaveCommentInput = z.strictObject({ id: LeaveCommentId })
export type ArchiveLeaveCommentInput = z.infer<typeof ArchiveLeaveCommentInput>
