import { z } from 'zod'
import { auditColumns } from '../common/audit'
import {
  AvailabilityRuleId,
  DeploymentId,
  OrganizationId,
  TagCategoryId,
  UnitId,
  UnitLevelId,
} from '../common/ids'
import { SchemaIssue } from '../common/issues'
import { checkDateRange } from '../common/refinements'
import { CalendarDate, Integer, Text, label } from '../common/scalars'
import { RuleEnforcement, RuleGroupBy, RuleMetric, RuleScopeMode } from '../enums'
import { FilterExpression } from '../filters'

const PERCENT_MIN = 0
const PERCENT_MAX = 100

/** `availability_rules` (D-014, D-031). */
export const AvailabilityRule = z
  .object({
    id: AvailabilityRuleId,
    organization_id: OrganizationId,
    name: label(255),
    description: Text.nullable(),
    is_enabled: z.boolean(),
    /** Higher wins on the same target (D-031). */
    priority: Integer,
    enforcement: RuleEnforcement,
    /** NULL = whole organization (global rule). */
    scope_unit_id: UnitId.nullable(),
    scope_mode: RuleScopeMode,
    scope_level_id: UnitLevelId.nullable(),
    population_filter: FilterExpression,
    group_by: RuleGroupBy,
    group_tag_category_id: TagCategoryId.nullable(),
    metric: RuleMetric,
    /** NUMERIC(7, 2). */
    min_value: z.number().nullable(),
    max_value: z.number().nullable(),
    effective_from: CalendarDate.nullable(),
    effective_to: CalendarDate.nullable(),
    deployment_id: DeploymentId.nullable(),
    count_pending_as_unavailable: z.boolean(),
    ...auditColumns,
  })
  .superRefine((row, ctx) => {
    const issue = (message: SchemaIssue, path: string) => {
      ctx.addIssue({ code: 'custom', message, path: [path] })
    }
    if ((row.scope_mode === 'each_descendant_at_level') !== (row.scope_level_id !== null)) {
      issue(SchemaIssue.enum.rule_scope_level_mismatch, 'scope_level_id')
    }
    if (row.group_tag_category_id !== null && row.group_by !== 'tag') {
      issue(SchemaIssue.enum.rule_group_category_mismatch, 'group_tag_category_id')
    }
    if (row.min_value === null && row.max_value === null) {
      issue(SchemaIssue.enum.rule_threshold_missing, 'min_value')
    }
    if (row.min_value !== null && row.max_value !== null && row.max_value < row.min_value) {
      issue(SchemaIssue.enum.rule_threshold_inverted, 'max_value')
    }
    if (row.metric === 'percent') {
      const outOfRange = (value: number | null) =>
        value !== null && (value < PERCENT_MIN || value > PERCENT_MAX)
      if (outOfRange(row.min_value)) issue(SchemaIssue.enum.rule_percent_out_of_range, 'min_value')
      if (outOfRange(row.max_value)) issue(SchemaIssue.enum.rule_percent_out_of_range, 'max_value')
    }
    checkDateRange(ctx, row.effective_from, row.effective_to, 'effective_to')
  })
export type AvailabilityRule = z.infer<typeof AvailabilityRule>
