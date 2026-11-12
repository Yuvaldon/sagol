import {
  CreateLeaveInput,
  LeaveId,
  LeaveStatus,
  type AvailabilityRuleId,
  type CalendarDate,
  type Issue,
  type Leave,
  type LeaveType,
  type LeaveTypeId,
  type OrganizationId,
  type SoldierId,
  type Timestamp,
} from '@contracts'
import { compareDates, leaveReasonIssues, optionalText, planLeaveCreation, type AvailabilityLeave } from '@domain'
import { formIssues } from '../forms/issues'
import type { WithProperties } from '../properties/properties'
import type { NewLeaveDraft } from '../view-state/draft'

// The new-leave form (D-115), between its fields and `leaves.create`. Ids are generated here (D-044), and a
// blank reason is NULL, as the command stores it (D-101).

export interface NewLeaveValues {
  readonly soldier_id: SoldierId | null
  readonly leave_type_id: LeaveTypeId | null
  /** '' while the field is empty; the schema then answers. */
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  readonly reason: string
  /** Shown only to who may approve the soldier (D-013). */
  readonly as_approved: boolean
}

/**
 * "Approve now" starts from the actor's own default (D-121). A drag's draft fills the soldier and the days (D-143); the
 * form offers only soldiers the actor may create a leave for, so it passes NULL for anyone else. `onlySoldier` is the one
 * soldier the form offers, prefilled (D-167).
 */
export function newLeaveValues(
  today: CalendarDate,
  approveNow = false,
  draft: NewLeaveDraft | null = null,
  onlySoldier: SoldierId | null = null,
): NewLeaveValues {
  return {
    soldier_id: draft?.soldier_id ?? onlySoldier,
    leave_type_id: null,
    start_date: draft?.start_date ?? today,
    end_date: draft?.end_date ?? today,
    reason: '',
    as_approved: approveNow,
  }
}

function createInput(values: NewLeaveValues & WithProperties, acknowledged: readonly AvailabilityRuleId[] = []) {
  return {
    id: LeaveId.parse(crypto.randomUUID()),
    soldier_id: values.soldier_id,
    leave_type_id: values.leave_type_id,
    // An empty field is an absent value, so the schema answers `required`.
    start_date: values.start_date === '' ? undefined : values.start_date,
    end_date: values.end_date === '' ? undefined : values.end_date,
    availability_effect_override: null,
    reason: optionalText(values.reason),
    properties: values.properties ?? {},
    as_approved: values.as_approved,
    acknowledged_rule_ids: [...acknowledged],
    comment: null,
  }
}

/**
 * The same codes the adapter answers: the schema's (D-068), and a reason the chosen type requires (D-064). The
 * command stays the authority.
 */
export function newLeaveIssues(values: NewLeaveValues, type: Pick<LeaveType, 'requires_reason'> | null): Issue[] {
  return [
    ...formIssues(CreateLeaveInput, createInput(values)),
    ...(type === null ? [] : leaveReasonIssues(type, optionalText(values.reason))),
  ]
}

export function toCreateLeaveInput(values: NewLeaveValues & WithProperties, acknowledged: readonly AvailabilityRuleId[] = []): CreateLeaveInput {
  return CreateLeaveInput.parse(createInput(values, acknowledged))
}

/** A leave as rules see it, before the command writes it (D-142). */
export type LeaveCandidate = AvailabilityLeave

/** A leave id no row has: the leave a form would create, before it has one, for its live warning (D-142). */
const CANDIDATE_ID = LeaveId.parse('00000000-0000-4000-8000-000000000000')

/**
 * The leave the form would create, as rules see it (D-142): pending, or approved when "approve now" is on. NULL until
 * the soldier, the type and valid dates are chosen.
 */
export function newLeaveCandidate(values: NewLeaveValues): LeaveCandidate | null {
  const { soldier_id, leave_type_id, start_date, end_date } = values
  if (soldier_id === null || leave_type_id === null || start_date === '' || end_date === '') return null
  if (compareDates(start_date, end_date) > 0) return null
  return {
    id: CANDIDATE_ID,
    soldier_id,
    leave_type_id,
    start_date,
    end_date,
    status: values.as_approved ? LeaveStatus.enum.approved : LeaveStatus.enum.pending,
    availability_effect_override: null,
  }
}

/**
 * The leave as the command will write it, shown before it answers (optimistic update). Its status and review
 * come from the same plan the command follows, so the bar does not change when the answer lands.
 */
export function optimisticLeave(
  input: CreateLeaveInput,
  actor: { readonly soldier_id: SoldierId; readonly organization_id: OrganizationId },
  now: Timestamp,
): Leave {
  const plan = planLeaveCreation('create', input.as_approved, actor.soldier_id, now)
  return {
    id: input.id,
    organization_id: actor.organization_id,
    soldier_id: input.soldier_id,
    leave_type_id: input.leave_type_id,
    batch_id: null,
    start_date: input.start_date,
    end_date: input.end_date,
    ...plan.next,
    availability_effect_override: input.availability_effect_override,
    reason: optionalText(input.reason),
    properties: input.properties,
    created_at: now,
    created_by: actor.soldier_id,
    updated_at: now,
    updated_by: actor.soldier_id,
    version: 1,
  }
}
