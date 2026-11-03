import { z } from 'zod'

/**
 * Stable codes used as the `message` of row-level validation issues raised by contract
 * schemas. They mirror the cross-column CHECK constraints of `schema.sql`. The UI maps
 * codes to i18n; contracts never carry user-facing text.
 */
export const SchemaIssue = z.enum([
  'range_inverted',
  'bound_missing',
  'scope_anchor_arguments',
  'include_descendants_not_allowed',
  'invalid_permission_pair',
  'rule_scope_level_mismatch',
  'rule_group_category_mismatch',
  'rule_threshold_missing',
  'rule_threshold_inverted',
  'rule_percent_out_of_range',
])
export type SchemaIssue = z.infer<typeof SchemaIssue>
