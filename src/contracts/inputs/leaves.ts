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
  restoreInput,
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
export const RestoreLeaveTypeGroupInput = restoreInput(LeaveTypeGroupId)
export type RestoreLeaveTypeGroupInput = z.infer<typeof RestoreLeaveTypeGroupInput>

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
export const RestoreLeaveTypeInput = restoreInput(LeaveTypeId)
export type RestoreLeaveTypeInput = z.infer<typeof RestoreLeaveTypeInput>

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

/** `createLeave`. New leaves are `pending` unless created as approved (D-013); each belongs to a rotation (D-216). */
export const CreateLeaveInput = z
  .strictObject({
    id: LeaveId,
    soldier_id: LeaveColumns.shape.soldier_id,
    deployment_id: LeaveColumns.shape.deployment_id,
    ...leaveDates,
    ...leaveDetails,
    ...creationFlags,
    comment: CommentDraft.nullable(),
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })
export type CreateLeaveInput = z.infer<typeof CreateLeaveInput>

/**
 * `createLeaveBatch`: leaves created together (collective leave, D-012), atomically (D-049), all in one rotation (D-216).
 */
export const CreateLeaveBatchInput = z.strictObject({
  batch: z.strictObject(LeaveBatch.pick({ id: true, name: true, description: true }).shape),
  deployment_id: LeaveColumns.shape.deployment_id,
  leaves: z
    .array(NewLeave)
    .min(1)
    .superRefine((leaves, ctx) => {
      checkDistinct(ctx, leaves, (leave) => leave.id)
    }),
  ...creationFlags,
})
export type CreateLeaveBatchInput = z.infer<typeof CreateLeaveBatchInput>

/** One leave of `createLeaves`: the soldier is the command's, the rotation each leave's own (D-216, D-275). */
const SoldierLeave = z
  .strictObject({
    id: LeaveId,
    deployment_id: LeaveColumns.shape.deployment_id,
    ...leaveDates,
    ...leaveDetails,
  })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })

/**
 * `createLeaves` (`leaves.createMany`, D-267, D-275): several leaves of one soldier, atomically (D-049), each its own
 * leave with no batch row. Each leave keeps its own rotation, since a sheet may reach past one.
 */
export const CreateLeavesInput = z.strictObject({
  soldier_id: LeaveColumns.shape.soldier_id,
  leaves: z
    .array(SoldierLeave)
    .min(1)
    .superRefine((leaves, ctx) => {
      checkDistinct(ctx, leaves, (leave) => leave.id)
    }),
  ...creationFlags,
})
export type CreateLeavesInput = z.infer<typeof CreateLeavesInput>

/** One copy of `duplicateLeave`: another soldier and/or other dates. */
const LeaveCopy = z
  .strictObject({ id: LeaveId, soldier_id: LeaveColumns.shape.soldier_id, ...leaveDates })
  .superRefine((input, ctx) => {
    checkDateRange(ctx, input.start_date, input.end_date, 'end_date')
  })

/**
 * `duplicateLeave` (`leaves:duplicate`, D-049): copies type, effect override, reason and
 * properties of `leave_id` into new leaves. Comments and history are not copied. Every copy stays in the source's
 * rotation, so each copy's soldier and dates must fit it (D-216).
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

/**
 * `updateLeave`: the dates and the details, never the status, in one command and one event (D-123). An approved leave
 * whose dates, type or effect change stays approved or returns to pending by `reschedule_policy` (D-064). Inverted
 * dates are refused here when both are sent, and on the merged row otherwise.
 */
export const UpdateLeaveInput = z.strictObject({
  id: LeaveId,
  expected_version: ExpectedVersion,
  changes: changesOf({ ...leaveDates, ...leaveDetails }).superRefine((changes, ctx) => {
    if (changes.start_date !== undefined && changes.end_date !== undefined) {
      checkDateRange(ctx, changes.start_date, changes.end_date, "end_date")
    }
  }),
  acknowledged_rule_ids: AcknowledgedRuleIds,
})
export type UpdateLeaveInput = z.infer<typeof UpdateLeaveInput>

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
