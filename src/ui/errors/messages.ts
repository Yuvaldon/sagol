import type { EnvIssueCode } from '@config'
import type { AppError, ErrorCode, IssueCode } from '@contracts'
import type { I18nKey } from '@i18n'

// Stable codes to i18n (D-046). The maps are total, so a new code fails to compile until it has a
// message. A new issue code lands in two commits, each one layer (D-075): first its message here,
// then the code in contracts. `ISSUE_KEYS` is checked by assignment, which allows that order.

const ERROR_KEYS: Record<ErrorCode, I18nKey> = {
  validation_failed: 'errors.validationFailed',
  rule_violation: 'errors.ruleViolation',
  rule_acknowledgment_required: 'errors.ruleAcknowledgmentRequired',
  unauthenticated: 'errors.unauthenticated',
  account_not_linked: 'errors.accountNotLinked',
  forbidden: 'errors.forbidden',
  not_found: 'errors.notFound',
  stale_version: 'errors.staleVersion',
  bootstrap_not_allowed: 'errors.bootstrapNotAllowed',
  unavailable: 'errors.unavailable',
  internal: 'errors.internal',
}

const ISSUE_MESSAGES = {
  required: 'issues.required',
  invalid_type: 'issues.invalidType',
  invalid_format: 'issues.invalidFormat',
  invalid_value: 'issues.invalidValue',
  too_short: 'issues.tooShort',
  too_long: 'issues.tooLong',
  too_small: 'issues.tooSmall',
  too_big: 'issues.tooBig',
  not_integer: 'issues.notInteger',
  unknown_field: 'issues.unknownField',
  no_changes: 'issues.noChanges',
  duplicate_item: 'issues.duplicateItem',
  range_inverted: 'issues.rangeInverted',
  bound_missing: 'issues.boundMissing',
  scope_anchor_arguments: 'issues.scopeAnchorArguments',
  include_descendants_not_allowed: 'issues.includeDescendantsNotAllowed',
  invalid_permission_pair: 'issues.invalidPermissionPair',
  rule_scope_level_mismatch: 'issues.ruleScopeLevelMismatch',
  rule_group_category_mismatch: 'issues.ruleGroupCategoryMismatch',
  rule_threshold_missing: 'issues.ruleThresholdMissing',
  rule_threshold_inverted: 'issues.ruleThresholdInverted',
  rule_percent_out_of_range: 'issues.rulePercentOutOfRange',
  already_exists: 'issues.alreadyExists',
  reference_not_found: 'issues.referenceNotFound',
  reference_archived: 'issues.referenceArchived',
  archived: 'issues.archived',
  unit_cycle: 'issues.unitCycle',
  membership_overlap: 'issues.membershipOverlap',
  seniority_override_overlap: 'issues.seniorityOverrideOverlap',
  tag_single_selection: 'issues.tagSingleSelection',
  last_access_manager: 'issues.lastAccessManager',
  invalid_transition: 'issues.invalidTransition',
  reason_required: 'issues.reasonRequired',
  property_unknown: 'issues.propertyUnknown',
  property_required: 'issues.propertyRequired',
  property_value_invalid: 'issues.propertyValueInvalid',
  property_options_invalid: 'issues.propertyOptionsInvalid',
  filter_operator_invalid: 'issues.filterOperatorInvalid',
  invalid_order: 'issues.invalidOrder',
  already_linked: 'issues.alreadyLinked',
  unit_not_empty: 'issues.unitNotEmpty',
  rank_in_use: 'issues.rankInUse',
  group_in_use: 'issues.groupInUse',
  not_a_member: 'issues.notAMember',
  outside_rotation: 'issues.outsideRotation',
  leaves_outside_rotation: 'issues.leavesOutsideRotation',
} as const satisfies Record<string, I18nKey>

const ISSUE_KEYS: Record<IssueCode, I18nKey> = ISSUE_MESSAGES

const ENV_ISSUE_KEYS: Record<EnvIssueCode, I18nKey> = {
  missing: 'startup.missing',
  invalid: 'startup.invalid',
  development_only: 'startup.developmentOnly',
  required_for_remote: 'startup.requiredForRemote',
  unpaired: 'startup.unpaired',
}

export function errorKey(error: AppError): I18nKey {
  return ERROR_KEYS[error.code]
}

export function issueKey(code: IssueCode): I18nKey {
  return ISSUE_KEYS[code]
}

/** The one message of a refused action with no field to show it on. */
export function failureKey(error: AppError): I18nKey {
  const [issue] = error.code === 'validation_failed' ? error.issues : []
  return issue === undefined ? errorKey(error) : issueKey(issue.code)
}

export function envIssueKey(code: EnvIssueCode): I18nKey {
  return ENV_ISSUE_KEYS[code]
}
