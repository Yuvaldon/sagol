import {
  AvailabilityRuleId,
  CreateAvailabilityRuleInput,
  RuleEnforcement,
  RuleGroupBy,
  RuleMetric,
  RuleScopeMode,
  type AvailabilityRule,
  type CalendarDate,
  type CommandRankId,
  type FilterExpression,
  type Issue,
  type TagCategoryId,
  type TagId,
  type UnitId,
  type UnitLevelId,
  UpdateAvailabilityRuleInput,
} from '@contracts'
import { optionalText } from '@domain'
import { formIssues } from '../forms/issues'
import { NO_CONDITIONS, readFilter, writeFilter } from '../view-state/filter'

// The rules module's form (D-140), between its fields and the rule commands (D-139). Pure. The population is built
// with the filter bar's conditions (D-131): a tag chip per category and a rank chip; none selects everyone.

/** Who a rule counts, as the bar's chips hold it, or a filter the form does not read (a rule written elsewhere). */
export type RulePopulation =
  | { readonly kind: 'conditions'; readonly tagSets: readonly (readonly TagId[])[]; readonly rankIds: readonly CommandRankId[] }
  | { readonly kind: 'other'; readonly filter: FilterExpression }

export const EVERYONE: RulePopulation = { kind: 'conditions', tagSets: [], rankIds: [] }

export interface RuleFormValues {
  readonly name: string
  readonly description: string
  readonly enforcement: RuleEnforcement
  /** NULL = the whole organization. */
  readonly scope_unit_id: UnitId | null
  readonly scope_mode: RuleScopeMode
  /** Only with `each_descendant_at_level`. */
  readonly scope_level_id: UnitLevelId | null
  readonly population: RulePopulation
  readonly group_by: RuleGroupBy
  /** Only with `group_by = tag`; NULL = every category. */
  readonly group_tag_category_id: TagCategoryId | null
  readonly metric: RuleMetric
  /** '' = no bound. Text while typed; the schema answers. */
  readonly min_value: string
  readonly max_value: string
  readonly effective_from: CalendarDate | ''
  readonly effective_to: CalendarDate | ''
  readonly count_pending_as_unavailable: boolean
  readonly priority: string
  readonly is_enabled: boolean
}

export const NEW_RULE_VALUES: RuleFormValues = {
  name: '',
  description: '',
  enforcement: RuleEnforcement.enum.soft,
  scope_unit_id: null,
  scope_mode: RuleScopeMode.enum.unit_tree,
  scope_level_id: null,
  population: EVERYONE,
  group_by: RuleGroupBy.enum.none,
  group_tag_category_id: null,
  metric: RuleMetric.enum.count,
  min_value: '',
  max_value: '',
  effective_from: '',
  effective_to: '',
  count_pending_as_unavailable: false,
  priority: '0',
  is_enabled: true,
}

/** The population the form reads from a stored filter. */
export function rulePopulationOf(filter: FilterExpression): RulePopulation {
  const read = readFilter(filter)
  if (read.kind === 'other') return { kind: 'other', filter }
  const { unitId, statuses, tagSets, rankIds } = read.conditions
  // A unit or a status is no part of a population the form writes: the scope holds the unit (D-071).
  if (unitId !== null || statuses.length > 0) return { kind: 'other', filter }
  return { kind: 'conditions', tagSets, rankIds }
}

export function rulePopulationFilter(population: RulePopulation): FilterExpression {
  if (population.kind === 'other') return population.filter
  return writeFilter({ ...NO_CONDITIONS, tagSets: population.tagSets, rankIds: population.rankIds }) ?? {}
}

const textOf = (value: number | null) => (value === null ? '' : String(value))

export function ruleFormValues(rule: AvailabilityRule): RuleFormValues {
  return {
    name: rule.name,
    description: rule.description ?? '',
    enforcement: rule.enforcement,
    scope_unit_id: rule.scope_unit_id,
    scope_mode: rule.scope_mode,
    scope_level_id: rule.scope_level_id,
    population: rulePopulationOf(rule.population_filter),
    group_by: rule.group_by,
    group_tag_category_id: rule.group_tag_category_id,
    metric: rule.metric,
    min_value: textOf(rule.min_value),
    max_value: textOf(rule.max_value),
    effective_from: rule.effective_from ?? '',
    effective_to: rule.effective_to ?? '',
    count_pending_as_unavailable: rule.count_pending_as_unavailable,
    priority: String(rule.priority),
    is_enabled: rule.is_enabled,
  }
}

/** '' is no value; anything else is a number, and what is not one stays for the schema to refuse. */
function numberOf(text: string): number | null | string {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : trimmed
}

/** The columns of the form, as the commands take them. A field the mode does not use is NULL. */
function ruleContent(values: RuleFormValues) {
  const atLevel = values.scope_mode === RuleScopeMode.enum.each_descendant_at_level
  const byTag = values.group_by === RuleGroupBy.enum.tag
  const priority = numberOf(values.priority)
  return {
    name: values.name,
    description: optionalText(values.description),
    is_enabled: values.is_enabled,
    priority: priority ?? 0,
    enforcement: values.enforcement,
    scope_unit_id: values.scope_unit_id,
    scope_mode: values.scope_mode,
    scope_level_id: atLevel ? values.scope_level_id : null,
    population_filter: rulePopulationFilter(values.population),
    group_by: values.group_by,
    group_tag_category_id: byTag ? values.group_tag_category_id : null,
    metric: values.metric,
    min_value: numberOf(values.min_value),
    max_value: numberOf(values.max_value),
    effective_from: values.effective_from === '' ? null : values.effective_from,
    effective_to: values.effective_to === '' ? null : values.effective_to,
    deployment_id: null,
    count_pending_as_unavailable: values.count_pending_as_unavailable,
  }
}

function createInput(values: RuleFormValues) {
  return { id: AvailabilityRuleId.parse(crypto.randomUUID()), ...ruleContent(values) }
}

/** The codes the command answers on the row (D-068): the schema and the row checks of `schema.sql`. */
export function ruleFormIssues(values: RuleFormValues): Issue[] {
  return formIssues(CreateAvailabilityRuleInput, createInput(values))
}

export function toCreateRuleInput(values: RuleFormValues): CreateAvailabilityRuleInput {
  return CreateAvailabilityRuleInput.parse(createInput(values))
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Only what differs from the stored rule, at the version the form opened with. NULL when nothing changed. */
export function toUpdateRuleInput(
  rule: AvailabilityRule,
  openedVersion: number,
  values: RuleFormValues,
): UpdateAvailabilityRuleInput | null {
  const content = CreateAvailabilityRuleInput.parse(createInput(values))
  const stored: Readonly<Record<string, unknown>> = rule
  const changes = Object.fromEntries(
    Object.entries(content).filter(([column, value]) => column !== 'id' && !sameValue(value, stored[column])),
  )
  if (Object.keys(changes).length === 0) return null
  return UpdateAvailabilityRuleInput.parse({ id: rule.id, expected_version: openedVersion, changes })
}

/** Live rules, as the repository orders them: priority, then name (D-140). */
export function liveRules(rules: readonly AvailabilityRule[]): AvailabilityRule[] {
  return rules.filter((rule) => rule.archived_at === null)
}
