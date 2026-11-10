import {
  RuleGroupBy,
  RuleMetric,
  RuleScopeMode,
  type AvailabilityRule,
  type AvailabilityRuleId,
  type CommandRank,
  type RuleGroupValue,
  type Tag,
  type Unit,
  type UnitId,
  type UnitLevel,
  type UnitLevelId,
} from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  rulePopulationOf,
  useAvailabilityRules,
  useCommandRanks,
  useTags,
  useUnitLevels,
  useUnitsWithArchived,
  type Loaded,
} from '@logic'
import { useMemo } from 'react'

// How rules and their violations are written (D-138, D-140): a rule's name, its unit, its group and what it asks. A
// name the actor may not read is a neutral "unknown", as D-106 does for units.

const PART_SEPARATOR = ' · '
const WORD_SEPARATOR = ' '
const LIST_SEPARATOR = ', '

export interface RuleNames {
  rule(id: AvailabilityRuleId): string
  /** NULL is the whole organization. */
  unit(id: UnitId | null): string
  level(id: UnitLevelId | null): string
  group(group: RuleGroupValue): string
  tag(tag: Tag['id']): string
  rank(rank: CommandRank['id']): string
}

const NO_ROWS: readonly never[] = []

function rowsOf<T>(loaded: Loaded<readonly T[]>): readonly T[] {
  return loaded.status === 'ready' ? loaded.value : NO_ROWS
}

/** Names of whatever a rule or a violation points at. A row still loading, or not visible, is "unknown" meanwhile. */
export function useRuleNames(): RuleNames {
  const rules = useAvailabilityRules()
  const units = useUnitsWithArchived()
  const levels = useUnitLevels()
  const tags = useTags()
  const ranks = useCommandRanks()
  return useMemo(() => {
    const byId = <T extends { readonly id: string }>(rows: readonly T[]) => new Map<string, T>(rows.map((row) => [row.id, row]))
    const ruleById = byId<AvailabilityRule>(rowsOf(rules))
    const unitById = byId<Unit>(rowsOf(units))
    const levelById = byId<UnitLevel>(rowsOf(levels))
    const tagById = byId<Tag>(rowsOf(tags))
    const rankById = byId<CommandRank>(rowsOf(ranks))
    const tag = (id: string) => tagById.get(id)?.name ?? t('rules.unknownGroup')
    const rank = (id: string) => rankById.get(id)?.title ?? t('rules.unknownGroup')
    return {
      rule: (id) => ruleById.get(id)?.name ?? t('rules.unknownRule'),
      unit: (id) => (id === null ? t('rules.wholeOrganization') : (unitById.get(id)?.name ?? t('rules.unknownUnit'))),
      level: (id) => (id === null ? t('rules.unknownUnit') : (levelById.get(id)?.name ?? t('rules.unknownUnit'))),
      group: (group) => (group.group_by === RuleGroupBy.enum.tag ? tag(group.tag_id) : rank(group.command_rank_id)),
      tag,
      rank,
    }
  }, [rules, units, levels, tags, ranks])
}

const join = (...parts: readonly string[]) => parts.join(WORD_SEPARATOR)

/** "לפחות 2" or "לכל היותר 30%". */
export function boundText(boundKey: I18nKey, value: number, percent: boolean): string {
  return join(t(boundKey), `${String(value)}${percent ? t('rules.percent') : ''}`)
}

/** What a rule asks, as its row in the list says it (D-140): the bounds, who, and where. */
export function ruleSummary(rule: AvailabilityRule, names: RuleNames): string {
  const percent = rule.metric === RuleMetric.enum.percent
  const bounds = [
    ...(rule.min_value === null ? [] : [boundText('rules.min', rule.min_value, percent)]),
    ...(rule.max_value === null ? [] : [boundText('rules.max', rule.max_value, percent)]),
  ]
  const population = rulePopulationOf(rule.population_filter)
  const who =
    population.kind === 'other'
      ? t('rules.otherPopulation')
      : [...population.tagSets.flat().map(names.tag), ...population.rankIds.map(names.rank)].join(LIST_SEPARATOR) || t('rules.everyone')
  return [...bounds, who, scopeText(rule, names)].join(PART_SEPARATOR)
}

function scopeText(rule: AvailabilityRule, names: RuleNames): string {
  const unit = names.unit(rule.scope_unit_id)
  switch (rule.scope_mode) {
    case RuleScopeMode.enum.unit_tree:
      return unit
    case RuleScopeMode.enum.each_child:
      return join(t('rules.eachChild'), unit)
    case RuleScopeMode.enum.each_descendant_at_level:
      return rule.scope_unit_id === null
        ? join(t('rules.eachAtLevel'), names.level(rule.scope_level_id))
        : join(t('rules.eachAtLevel'), names.level(rule.scope_level_id), t('rules.under'), unit)
  }
}
