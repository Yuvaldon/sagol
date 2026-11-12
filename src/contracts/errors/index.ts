import { z } from 'zod'
import { AvailabilityRuleId, CommandRankId, SoldierId, TagId, UnitId } from '../common/ids'
import { SchemaIssue } from '../common/issues'
import { CalendarDate, label } from '../common/scalars'
import { RuleEnforcement } from '../enums'

// Error model of every command and query (D-046). Errors are values with stable codes;
// the UI maps codes to i18n. Contracts never carry user-facing text.

/** Field-level codes that do not depend on stored data. The adapter maps Zod issues to them. */
const FIELD_ISSUE_CODES = [
  'required',
  'invalid_type',
  'invalid_format',
  'invalid_value',
  'too_short',
  'too_long',
  'too_small',
  'too_big',
  'not_integer',
  'unknown_field',
  /** An update whose `changes` sets no field. */
  'no_changes',
  /** The same id appears twice in a list (reorder, tag set, permission set, members). */
  'duplicate_item',
] as const

/** Codes raised against stored data: integrity, invariants and domain rules (D-046). */
const STATE_ISSUE_CODES = [
  /** Unique key taken: id, unit code, tag name, personal id, open link request. */
  'already_exists',
  /** A referenced row does not exist or is not visible to the actor. */
  'reference_not_found',
  /** A new reference points to an archived row. */
  'reference_archived',
  /** The target row is archived, cancelled or revoked and cannot change. */
  'archived',
  'unit_cycle',
  'membership_overlap',
  'seniority_override_overlap',
  'tag_single_selection',
  /** The change would leave no soldier with organization-scope access management (D-004). */
  'last_access_manager',
  /** The leave or link-request state machine does not allow the transition. */
  'invalid_transition',
  /** The leave type requires a reason. */
  'reason_required',
  'property_unknown',
  'property_required',
  'property_value_invalid',
  /** Select options do not fit the property data type. */
  'property_options_invalid',
  /** A filter property operator does not fit the property data type. */
  'filter_operator_invalid',
  /** A reorder list is not exactly the set of rows it orders (e.g. units of one parent). */
  'invalid_order',
  /** The soldier or the identity is already linked to an account. */
  'already_linked',
  /** The unit has live sub-units, or soldiers placed today or later (D-088). */
  'unit_not_empty',
  /** A soldier who is not archived holds the rank (D-095). */
  'rank_in_use',
  /** A leave type group holds a type that is not archived (D-113). */
  'group_in_use',
  /** A leave's soldier is not a member of the rotation it belongs to (D-216). */
  'not_a_member',
  /** A leave's dates fall outside the soldier's days in its rotation (D-216). */
  'outside_rotation',
  /** A change to a rotation or its members would leave live requests outside it (D-216). */
  'leaves_outside_rotation',
  /** A rotation's dates overlap another live rotation of the organization: one at a time (D-257). */
  'rotation_overlap',
  /** The rotation is closed: its dates, members, rotation tags and requests are read-only (D-258). */
  'rotation_closed',
  /** A rotation closes only once its last day is today or earlier (D-258). */
  'rotation_not_ended',
] as const

/** Every validation issue code: field codes, row checks (`SchemaIssue`) and state codes. */
export const IssueCode = z.enum([...FIELD_ISSUE_CODES, ...SchemaIssue.options, ...STATE_ISSUE_CODES])
export type IssueCode = z.infer<typeof IssueCode>

/** One validation issue. `path` addresses the input field (`[]` = the input as a whole). */
export const Issue = z.object({
  path: z.array(z.union([z.string(), z.int()])),
  code: IssueCode,
})
export type Issue = z.infer<typeof Issue>

/** Which threshold of an availability rule is broken. */
export const RuleBound = z.enum(['min', 'max'])
export type RuleBound = z.infer<typeof RuleBound>

/** The group a rule target is evaluated for (`group_by`, D-031). NULL = no grouping. */
export const RuleGroupValue = z.discriminatedUnion('group_by', [
  z.object({ group_by: z.literal('tag'), tag_id: TagId }),
  z.object({ group_by: z.literal('command_rank'), command_rank_id: CommandRankId }),
])
export type RuleGroupValue = z.infer<typeof RuleGroupValue>

/** A soldier a violation names: unavailable on a day of a broken target (D-138). */
export const ViolationSoldier = z.object({ id: SoldierId, first_name: label(50), last_name: label(50) })
export type ViolationSoldier = z.infer<typeof ViolationSoldier>

/**
 * A rule broken on one target, with the days it fails (D-014, D-031). Each day names the target's unavailable soldiers,
 * also those the actor cannot see (D-138).
 */
export const RuleViolation = z.object({
  rule_id: AvailabilityRuleId,
  enforcement: RuleEnforcement,
  /** NULL = the whole organization. */
  scope_unit_id: UnitId.nullable(),
  group: RuleGroupValue.nullable(),
  bound: RuleBound,
  days: z
    .array(
      z.object({
        date: CalendarDate,
        required: z.number(),
        actual: z.number(),
        unavailable: z.array(ViolationSoldier),
      }),
    )
    .min(1),
})
export type RuleViolation = z.infer<typeof RuleViolation>

/** Error codes that carry no payload. */
const PLAIN_ERROR_CODES = [
  /** No signed-in identity. */
  'unauthenticated',
  /** Signed in, but the identity is not linked to a soldier (D-005). */
  'account_not_linked',
  /** The actor sees the target but may not perform the action. */
  'forbidden',
  /** Missing, or not visible to the actor: invisible rows never answer `forbidden` (D-046). */
  'not_found',
  /** `expected_version` differs from the stored version (D-012). Refetch and retry. */
  'stale_version',
  /** Bootstrap refused: the organization is not empty or the email does not match (D-005). */
  'bootstrap_not_allowed',
  /** The storage or the backend could not be reached. Safe to retry. */
  'unavailable',
  /** Unexpected failure. Nothing was written. */
  'internal',
] as const

export const ErrorCode = z.enum([
  'validation_failed',
  'rule_violation',
  'rule_acknowledgment_required',
  ...PLAIN_ERROR_CODES,
])
export type ErrorCode = z.infer<typeof ErrorCode>

/** The error of a failed command or query. */
export const AppError = z.discriminatedUnion('code', [
  /** Schema, integrity or invariant failure; nothing was written. */
  z.object({ code: z.literal('validation_failed'), issues: z.array(Issue).min(1) }),
  /** Hard rules would be broken; the change is rejected (D-014). */
  z.object({ code: z.literal('rule_violation'), violations: z.array(RuleViolation).min(1) }),
  /**
   * Soft rules would be broken and are not in `acknowledged_rule_ids`. Retry with their
   * ids to proceed; the acknowledgment is stored in `leave_events` (D-047).
   */
  z.object({
    code: z.literal('rule_acknowledgment_required'),
    violations: z.array(RuleViolation).min(1),
  }),
  z.object({ code: z.enum(PLAIN_ERROR_CODES) }),
])
export type AppError = z.infer<typeof AppError>
