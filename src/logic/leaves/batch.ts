import {
  CreateLeaveBatchInput,
  DuplicateLeaveInput,
  LeaveBatchId,
  LeaveId,
  type AvailabilityRuleId,
  type CalendarDate,
  type Issue,
  type Leave,
  type LeaveType,
  type LeaveTypeId,
  type SoldierId,
} from '@contracts'
import { leaveReasonIssues, optionalText } from '@domain'
import { formIssues } from '../forms/issues'
import type { WithProperties } from '../properties/properties'

// A collective leave (D-012, D-179): one batch, the same type, dates and details for every soldier chosen, created
// together or not at all (D-049). And a leave's copies (`leaves.duplicate`): other soldiers, other dates. Pure.

/**
 * A row's issue on the form's field: every row carries the same fields, so it is reported once. An empty list is the
 * soldier choice's.
 */
function onFormFields(issues: readonly Issue[], rows: string): Issue[] {
  const seen = new Set<string>()
  return issues.flatMap((issue): Issue[] => {
    const [head, , ...field] = issue.path
    const path = head !== rows ? issue.path : field.length > 0 ? field : ['soldier_ids']
    const key = `${path.join('.')}:${issue.code}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...issue, path }]
  })
}

export interface LeaveBatchValues {
  readonly name: string
  readonly description: string
  readonly soldier_ids: readonly SoldierId[]
  readonly leave_type_id: LeaveTypeId | null
  /** '' while the field is empty; the schema then answers. */
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  readonly reason: string
  /** Shown only to who may approve every soldier chosen (D-013). */
  readonly as_approved: boolean
}

export function newLeaveBatchValues(today: CalendarDate): LeaveBatchValues {
  return { name: '', description: '', soldier_ids: [], leave_type_id: null, start_date: today, end_date: today, reason: '', as_approved: false }
}

const dateOf = (date: CalendarDate | '') => (date === '' ? undefined : date)

function batchInput(values: LeaveBatchValues & WithProperties, acknowledged: readonly AvailabilityRuleId[] = []) {
  return {
    batch: { id: LeaveBatchId.parse(crypto.randomUUID()), name: values.name.trim(), description: optionalText(values.description) },
    leaves: values.soldier_ids.map((soldierId) => ({
      id: LeaveId.parse(crypto.randomUUID()),
      soldier_id: soldierId,
      leave_type_id: values.leave_type_id,
      start_date: dateOf(values.start_date),
      end_date: dateOf(values.end_date),
      availability_effect_override: null,
      reason: optionalText(values.reason),
      properties: values.properties ?? {},
    })),
    as_approved: values.as_approved,
    acknowledged_rule_ids: [...acknowledged],
  }
}

/**
 * The codes the command answers (D-068): the schema's, and a reason the chosen type requires (D-064). Every leave
 * carries the same fields, so a leave's issue is reported once, on the batch's field.
 */
export function leaveBatchIssues(values: LeaveBatchValues, type: Pick<LeaveType, 'requires_reason'> | null): Issue[] {
  const fieldIssues = onFormFields(formIssues(CreateLeaveBatchInput, batchInput(values)), 'leaves').map((issue) =>
    issue.path[0] === 'batch' ? { ...issue, path: issue.path.slice(1) } : issue,
  )
  return [...fieldIssues, ...(type === null ? [] : leaveReasonIssues(type, optionalText(values.reason)))]
}

export function toCreateLeaveBatchInput(
  values: LeaveBatchValues & WithProperties,
  acknowledged: readonly AvailabilityRuleId[] = [],
): CreateLeaveBatchInput {
  return CreateLeaveBatchInput.parse(batchInput(values, acknowledged))
}

// ------------------------------------------------------------------ duplicate

export interface DuplicateLeaveValues {
  /** One copy for each soldier chosen, the source's own soldier too. */
  readonly soldier_ids: readonly SoldierId[]
  readonly start_date: CalendarDate | ''
  readonly end_date: CalendarDate | ''
  readonly as_approved: boolean
}

/** Starts from the source's own dates, with no soldier chosen. */
export function newDuplicateValues(source: Leave): DuplicateLeaveValues {
  return { soldier_ids: [], start_date: source.start_date, end_date: source.end_date, as_approved: false }
}

function duplicateInput(source: Leave, values: DuplicateLeaveValues, acknowledged: readonly AvailabilityRuleId[] = []) {
  return {
    leave_id: source.id,
    copies: values.soldier_ids.map((soldierId) => ({
      id: LeaveId.parse(crypto.randomUUID()),
      soldier_id: soldierId,
      start_date: dateOf(values.start_date),
      end_date: dateOf(values.end_date),
    })),
    as_approved: values.as_approved,
    acknowledged_rule_ids: [...acknowledged],
  }
}

/** The schema's codes, a copy's on the form's field (D-068). */
export function duplicateLeaveIssues(source: Leave, values: DuplicateLeaveValues): Issue[] {
  return onFormFields(formIssues(DuplicateLeaveInput, duplicateInput(source, values)), 'copies')
}

export function toDuplicateLeaveInput(
  source: Leave,
  values: DuplicateLeaveValues,
  acknowledged: readonly AvailabilityRuleId[] = [],
): DuplicateLeaveInput {
  return DuplicateLeaveInput.parse(duplicateInput(source, values, acknowledged))
}
