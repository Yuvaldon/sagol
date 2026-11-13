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
  type DeploymentId,
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
import { NO_RULES, readRules, writeRules, type FilterRule } from '../view-state/filter'

// The rules module's form (D-140), between its fields and the rule commands (D-139). Pure. The population is built
// with the rule builder's rules (D-312): a tag category's "any of" per category and the rank's "any of"; none selects
// everyone.

/** Who a rule counts, as the builder's rules hold it, or a filter the form does not read (a rule written elsewhere). */
export type RulePopulation =
  | { readonly kind: 'conditions'; readonly tagSets: readonly (readonly TagId[])[]; readonly rankIds: readonly CommandRankId[] }
  | { readonly kind: 'other'; readonly filter: FilterExpression }

export const EVERYONE: RulePopulation = { kind: 'conditions', tagSets: [], rankIds: [] }

/**
 * The form's fields. The population is held as the bar's conditions, never as a filter: a filter the form does not read
 * stays on the stored rule until it is cleared, so the values stay plain data for the form library.
 */
export interface RuleFormValues {
  readonly name: string
  readonly description: string
  readonly enforcement: RuleEnforcement
  /** NULL = the whole organization. */
  readonly scope_unit_id: UnitId | null
  readonly scope_mode: RuleScopeMode
  /** Only with `each_descendant_at_level`. */
  readonly scope_level_id: UnitLevelId | null
  /** One set per tag category, each matching any of its tags. With the ranks, who the rule counts; none = everyone. */
  readonly tag_sets: readonly (readonly TagId[])[]
  readonly rank_ids: readonly CommandRankId[]
  /** The stored rule counts with a filter the form does not read, kept as it is until cleared. */
  readonly other_population: boolean
  readonly group_by: RuleGroupBy
  /** Only with `group_by = tag`; NULL = every category. */
  readonly group_tag_category_id: TagCategoryId | null
  readonly metric: RuleMetric
  /** '' = no bound. Text while typed; the schema answers. */
  readonly min_value: string
  readonly max_value: string
  readonly effective_from: CalendarDate | ''
  readonly effective_to: CalendarDate | ''
  /** NULL = always; otherwise the rule counts only while the deployment runs, only its members (D-071). */
  readonly deployment_id: DeploymentId | null
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
  tag_sets: [],
  rank_ids: [],
  other_population: false,
  group_by: RuleGroupBy.enum.none,
  group_tag_category_id: null,
  metric: RuleMetric.enum.count,
  min_value: '',
  max_value: '',
  effective_from: '',
  effective_to: '',
  deployment_id: null,
  count_pending_as_unavailable: false,
  priority: '0',
  is_enabled: true,
}

/** The population the form reads from a stored filter. */
export function rulePopulationOf(filter: FilterExpression): RulePopulation {
  const read = readRules(filter)
  const other: RulePopulation = { kind: 'other', filter }
  // A unit is no part of a population the form writes: the scope holds the unit (D-071). Nor are או, a "none of", a
  // status or a property: the form offers none of them.
  if (read.kind === 'other' || read.filter.unitId !== null || read.filter.match !== 'all') return other
  const tagSets: (readonly TagId[])[] = []
  let rankIds: readonly CommandRankId[] = []
  for (const rule of read.filter.rules) {
    if (rule.kind === 'tag' && !rule.negate) tagSets.push(rule.tagIds)
    else if (rule.kind === 'rank' && !rule.negate && rankIds.length === 0) rankIds = rule.rankIds
    else return other
  }
  return { kind: 'conditions', tagSets, rankIds }
}

export function rulePopulationFilter(population: RulePopulation): FilterExpression {
  if (population.kind === 'other') return population.filter
  const rules: FilterRule[] = [
    ...population.tagSets.map((tagIds): FilterRule => ({ kind: 'tag', negate: false, tagIds })),
    ...(population.rankIds.length === 0 ? [] : [{ kind: 'rank' as const, negate: false, rankIds: population.rankIds }]),
  ]
  return writeRules({ ...NO_RULES, rules }) ?? {}
}

const textOf = (value: number | null) => (value === null ? '' : String(value))

export function ruleFormValues(rule: AvailabilityRule): RuleFormValues {
  const population = rulePopulationOf(rule.population_filter)
  return {
    name: rule.name,
    description: rule.description ?? '',
    enforcement: rule.enforcement,
    scope_unit_id: rule.scope_unit_id,
    scope_mode: rule.scope_mode,
    scope_level_id: rule.scope_level_id,
    tag_sets: population.kind === 'conditions' ? population.tagSets : [],
    rank_ids: population.kind === 'conditions' ? population.rankIds : [],
    other_population: population.kind === 'other',
    group_by: rule.group_by,
    group_tag_category_id: rule.group_tag_category_id,
    metric: rule.metric,
    min_value: textOf(rule.min_value),
    max_value: textOf(rule.max_value),
    effective_from: rule.effective_from ?? '',
    effective_to: rule.effective_to ?? '',
    deployment_id: rule.deployment_id,
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

/**
 * The columns of the form, as the commands take them. A field the mode does not use is NULL. `stored` is the filter
 * of the rule being edited, kept while the form does not read it.
 */
function ruleContent(values: RuleFormValues, stored: FilterExpression | null) {
  const atLevel = values.scope_mode === RuleScopeMode.enum.each_descendant_at_level
  const byTag = values.group_by === RuleGroupBy.enum.tag
  const priority = numberOf(values.priority)
  return {
    name: values.name,
    description: optionalText(values.description),
    is_enabled: values.is_enabled,
    // An empty priority is the schema's to refuse, as every other number of the form.
    priority,
    enforcement: values.enforcement,
    scope_unit_id: values.scope_unit_id,
    scope_mode: values.scope_mode,
    scope_level_id: atLevel ? values.scope_level_id : null,
    population_filter:
      values.other_population && stored !== null
        ? stored
        : rulePopulationFilter({ kind: 'conditions', tagSets: values.tag_sets, rankIds: values.rank_ids }),
    group_by: values.group_by,
    group_tag_category_id: byTag ? values.group_tag_category_id : null,
    metric: values.metric,
    min_value: numberOf(values.min_value),
    max_value: numberOf(values.max_value),
    effective_from: values.effective_from === '' ? null : values.effective_from,
    effective_to: values.effective_to === '' ? null : values.effective_to,
    deployment_id: values.deployment_id,
    count_pending_as_unavailable: values.count_pending_as_unavailable,
  }
}

function createInput(values: RuleFormValues, stored: FilterExpression | null = null) {
  return { id: AvailabilityRuleId.parse(crypto.randomUUID()), ...ruleContent(values, stored) }
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
  const content = CreateAvailabilityRuleInput.parse(createInput(values, rule.population_filter))
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
