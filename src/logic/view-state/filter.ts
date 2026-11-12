import {
  PropertyOptionId,
  type CommandRankId,
  type FilterExpression,
  type FilterNode,
  type JsonValue,
  type PropertyDefinitionId,
  type SoldierStatus,
  type TagCategoryId,
  type TagId,
  type UnitId,
} from '@contracts'
import { useCallback, useMemo } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The view filter in the URL (D-104, D-131). It is one `FilterExpression` (D-067): the unit selector writes the
// unit, and the filter bar its chips, as one top-level `and`. Anything else is a filter the bar does not read.

/** The conditions the bar and the unit selector read and write. An empty list is a chip that is not there. */
export interface SoldierConditions {
  readonly unitId: UnitId | null
  /** One set per tag chip, each matching any of its tags. */
  readonly tagSets: readonly (readonly TagId[])[]
  readonly rankIds: readonly CommandRankId[]
  readonly statuses: readonly SoldierStatus[]
  /** One chip per property, in the order they were added (D-177). */
  readonly properties: readonly PropertyChip[]
}

/**
 * A property condition the bar reads (D-177): any of some options of a select or multi-select property, or a yes / no
 * property that equals one answer. Other conditions on a property are a filter the bar does not read.
 */
export type PropertyChip =
  | { readonly kind: 'options'; readonly definitionId: PropertyDefinitionId; readonly optionIds: readonly PropertyOptionId[] }
  | { readonly kind: 'boolean'; readonly definitionId: PropertyDefinitionId; readonly value: boolean }

export const NO_CONDITIONS: SoldierConditions = { unitId: null, tagSets: [], rankIds: [], statuses: [], properties: [] }

function optionIdsOf(value: JsonValue): PropertyOptionId[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ids = value.map((item) => PropertyOptionId.safeParse(item))
  return ids.every((id) => id.success) ? ids.map((id) => id.data) : null
}

function propertyChipOf(node: Extract<FilterNode, { kind: 'property' }>): PropertyChip | null {
  const definitionId = node.property_definition_id
  if (node.operator === 'equals' && typeof node.value === 'boolean') return { kind: 'boolean', definitionId, value: node.value }
  if (node.operator !== 'any_of') return null
  const optionIds = optionIdsOf(node.value)
  return optionIds === null ? null : { kind: 'options', definitionId, optionIds }
}

function propertyNodeOf(chip: PropertyChip): FilterNode {
  return chip.kind === 'boolean'
    ? { kind: 'property', property_definition_id: chip.definitionId, operator: 'equals', value: chip.value }
    : { kind: 'property', property_definition_id: chip.definitionId, operator: 'any_of', value: [...chip.optionIds] }
}

/** The chip of one property replaced, in its place, or removed when NULL (D-177). */
export function withPropertyChip(
  conditions: SoldierConditions,
  definitionId: PropertyDefinitionId,
  chip: PropertyChip | null,
): SoldierConditions {
  const at = conditions.properties.findIndex((held) => held.definitionId === definitionId)
  if (chip === null) return { ...conditions, properties: conditions.properties.filter((held) => held.definitionId !== definitionId) }
  if (at < 0) return { ...conditions, properties: [...conditions.properties, chip] }
  return { ...conditions, properties: conditions.properties.map((held, index) => (index === at ? chip : held)) }
}

export type ReadFilter =
  | { readonly kind: 'conditions'; readonly conditions: SoldierConditions }
  /** A filter the bar does not read, as a hand-written link may hold. */
  | { readonly kind: 'other' }

const OTHER: ReadFilter = { kind: 'other' }

function nodesOf(filter: FilterExpression | null): readonly FilterNode[] {
  if (filter === null || filter.where === undefined) return []
  return filter.where.kind === 'and' ? filter.where.nodes : [filter.where]
}

export function readFilter(filter: FilterExpression | null): ReadFilter {
  let conditions: SoldierConditions = NO_CONDITIONS
  for (const node of nodesOf(filter)) {
    if (node.kind === 'unit' && node.include_descendants && node.unit_ids.length === 1 && conditions.unitId === null) {
      const [unitId] = node.unit_ids
      if (unitId !== undefined) conditions = { ...conditions, unitId }
    } else if (node.kind === 'tag' && node.match === 'any') {
      conditions = { ...conditions, tagSets: [...conditions.tagSets, node.tag_ids] }
    } else if (node.kind === 'command_rank' && conditions.rankIds.length === 0) {
      conditions = { ...conditions, rankIds: node.command_rank_ids }
    } else if (node.kind === 'soldier_status' && conditions.statuses.length === 0) {
      conditions = { ...conditions, statuses: node.statuses }
    } else if (node.kind === 'property' && !conditions.properties.some((held) => held.definitionId === node.property_definition_id)) {
      const chip = propertyChipOf(node)
      if (chip === null) return OTHER
      conditions = { ...conditions, properties: [...conditions.properties, chip] }
    } else {
      return OTHER
    }
  }
  return { kind: 'conditions', conditions }
}

/** One top-level `and`, a lone node unwrapped, nothing when there is no condition (D-131). */
export function writeFilter(conditions: SoldierConditions): FilterExpression | undefined {
  const nodes: FilterNode[] = [
    ...(conditions.unitId === null
      ? []
      : [{ kind: 'unit' as const, unit_ids: [conditions.unitId], include_descendants: true }]),
    ...conditions.tagSets
      .filter((tagIds) => tagIds.length > 0)
      .map((tagIds) => ({ kind: 'tag' as const, match: 'any' as const, tag_ids: [...tagIds] })),
    ...(conditions.rankIds.length === 0 ? [] : [{ kind: 'command_rank' as const, command_rank_ids: [...conditions.rankIds] }]),
    ...(conditions.statuses.length === 0 ? [] : [{ kind: 'soldier_status' as const, statuses: [...conditions.statuses] }]),
    ...conditions.properties.filter((chip) => chip.kind === 'boolean' || chip.optionIds.length > 0).map(propertyNodeOf),
  ]
  const [first] = nodes
  if (first === undefined) return undefined
  return nodes.length === 1 ? { where: first } : { where: { kind: 'and', nodes } }
}

/**
 * One soldier rule of the builder (D-312): a tag category's or the command rank's "any of" or "none of", the status's
 * "is" or "is not", a select or multi-select property's "any of", "none of", "is empty" or "is not empty", or a yes / no
 * property's answer. "None of" and "is not" are `not` over "any of" and "is".
 */
export type FilterRule =
  | { readonly kind: 'tag'; readonly negate: boolean; readonly tagIds: readonly TagId[] }
  | { readonly kind: 'rank'; readonly negate: boolean; readonly rankIds: readonly CommandRankId[] }
  | { readonly kind: 'status'; readonly negate: boolean; readonly statuses: readonly SoldierStatus[] }
  | {
      readonly kind: 'options'
      readonly definitionId: PropertyDefinitionId
      readonly negate: boolean
      readonly optionIds: readonly PropertyOptionId[]
    }
  | { readonly kind: 'empty'; readonly definitionId: PropertyDefinitionId; readonly empty: boolean }
  | { readonly kind: 'boolean'; readonly definitionId: PropertyDefinitionId; readonly value: boolean }

/** Whether every soldier rule holds (וגם) or any one does (או), D-312. */
export type RuleMatch = 'all' | 'any'

/** The unit and the soldier rules of the view filter (D-104, D-312). */
export interface SoldierFilter {
  readonly unitId: UnitId | null
  readonly match: RuleMatch
  readonly rules: readonly FilterRule[]
}

export const NO_RULES: SoldierFilter = { unitId: null, match: 'all', rules: [] }

export type ReadRules =
  | { readonly kind: 'rules'; readonly filter: SoldierFilter }
  /** A filter the builder does not read, as a hand-written link may hold. */
  | { readonly kind: 'other' }

function positiveRuleOf(node: FilterNode, negate: boolean): FilterRule | null {
  switch (node.kind) {
    case 'tag':
      return node.match === 'any' ? { kind: 'tag', negate, tagIds: node.tag_ids } : null
    case 'command_rank':
      return { kind: 'rank', negate, rankIds: node.command_rank_ids }
    case 'soldier_status':
      return { kind: 'status', negate, statuses: node.statuses }
    case 'property': {
      const definitionId = node.property_definition_id
      if (node.operator === 'any_of') {
        const optionIds = optionIdsOf(node.value)
        return optionIds === null ? null : { kind: 'options', definitionId, negate, optionIds }
      }
      if (negate) return null
      if (node.operator === 'equals' && typeof node.value === 'boolean') return { kind: 'boolean', definitionId, value: node.value }
      if (node.operator === 'is_empty' || node.operator === 'is_not_empty') {
        return node.value === null ? { kind: 'empty', definitionId, empty: node.operator === 'is_empty' } : null
      }
      return null
    }
    default:
      return null
  }
}

function ruleOf(node: FilterNode): FilterRule | null {
  return node.kind === 'not' ? positiveRuleOf(node.node, true) : positiveRuleOf(node, false)
}

function positiveNodeOf(rule: FilterRule): FilterNode | null {
  switch (rule.kind) {
    case 'tag':
      return rule.tagIds.length === 0 ? null : { kind: 'tag', match: 'any', tag_ids: [...rule.tagIds] }
    case 'rank':
      return rule.rankIds.length === 0 ? null : { kind: 'command_rank', command_rank_ids: [...rule.rankIds] }
    case 'status':
      return rule.statuses.length === 0 ? null : { kind: 'soldier_status', statuses: [...rule.statuses] }
    case 'options':
      return rule.optionIds.length === 0
        ? null
        : { kind: 'property', property_definition_id: rule.definitionId, operator: 'any_of', value: [...rule.optionIds] }
    case 'empty':
      return {
        kind: 'property',
        property_definition_id: rule.definitionId,
        operator: rule.empty ? 'is_empty' : 'is_not_empty',
        value: null,
      }
    case 'boolean':
      return { kind: 'property', property_definition_id: rule.definitionId, operator: 'equals', value: rule.value }
  }
}

/** The node a rule writes; NULL for a rule still without a value, which lives only in the open builder (D-312). */
function nodeOf(rule: FilterRule): FilterNode | null {
  const node = positiveNodeOf(rule)
  if (node === null) return null
  return 'negate' in rule && rule.negate ? { kind: 'not', node } : node
}

/** Reads the unit and the rules: `and(unit, ...rules)` for וגם, `and(unit, or(...rules))` for או (D-312). */
export function readRules(filter: FilterExpression | null): ReadRules {
  let unitId: UnitId | null = null
  const rest: FilterNode[] = []
  for (const node of nodesOf(filter)) {
    if (node.kind === 'unit' && node.include_descendants && node.unit_ids.length === 1 && unitId === null) {
      unitId = node.unit_ids[0] ?? null
    } else {
      rest.push(node)
    }
  }
  const [only] = rest
  const match: RuleMatch = rest.length === 1 && only?.kind === 'or' ? 'any' : 'all'
  const nodes = match === 'any' && only?.kind === 'or' ? only.nodes : rest
  const rules: FilterRule[] = []
  for (const node of nodes) {
    const rule = ruleOf(node)
    if (rule === null) return { kind: 'other' }
    rules.push(rule)
  }
  return { kind: 'rules', filter: { unitId, match, rules } }
}

/**
 * Writes the unit and the rules as one top-level `and`, a lone node unwrapped, nothing for no condition (D-131, D-312).
 * With או the rules go in an `or`, even a single one, so the toggle reads back.
 */
export function writeRules(filter: SoldierFilter): FilterExpression | undefined {
  const ruleNodes = filter.rules.flatMap((rule) => nodeOf(rule) ?? [])
  const nodes: FilterNode[] = [
    ...(filter.unitId === null ? [] : [{ kind: 'unit' as const, unit_ids: [filter.unitId], include_descendants: true }]),
    ...(filter.match === 'all' ? ruleNodes : ruleNodes.length === 0 ? [] : [{ kind: 'or' as const, nodes: ruleNodes }]),
  ]
  const [first] = nodes
  if (first === undefined) return undefined
  return nodes.length === 1 ? { where: first } : { where: { kind: 'and', nodes } }
}

/** Whether a rule has a value to write (D-312). */
export function ruleHasValue(rule: FilterRule): boolean {
  return positiveNodeOf(rule) !== null
}

/** The filter of one unit and its sub-units, as the unit selector writes it (D-104). */
export function unitFilterOf(unitId: UnitId | null): FilterExpression | undefined {
  return writeRules({ ...NO_RULES, unitId })
}

/** What the unit selector shows for the current filter. */
export type FilterUnit =
  | { readonly kind: 'organization' }
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  /** A filter the bar does not read. */
  | { readonly kind: 'other' }

export function filterUnitOf(filter: FilterExpression | null): FilterUnit {
  const read = readRules(filter)
  if (read.kind === 'other') return { kind: 'other' }
  const { unitId } = read.filter
  return unitId === null ? { kind: 'organization' } : { kind: 'unit', unitId }
}

/**
 * The tag chip of one category replaced by `tagIds` (D-131): the sets that hold a tag of the category give way, the
 * new set takes the place of the first of them, and an empty one removes the chip.
 */
export function withTagChip(
  conditions: SoldierConditions,
  categoryOf: (tagId: TagId) => TagCategoryId | undefined,
  categoryId: TagCategoryId,
  tagIds: readonly TagId[],
): SoldierConditions {
  const inCategory = (set: readonly TagId[]) => set.some((tagId) => categoryOf(tagId) === categoryId)
  const at = conditions.tagSets.findIndex(inCategory)
  const others = conditions.tagSets.filter((set) => !inCategory(set))
  if (tagIds.length === 0) return { ...conditions, tagSets: others }
  const position = at < 0 ? others.length : conditions.tagSets.slice(0, at).filter((set) => !inCategory(set)).length
  return { ...conditions, tagSets: [...others.slice(0, position), tagIds, ...others.slice(position)] }
}

export interface ViewFilterState {
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  readonly read: ReadFilter
  /** The unit and the soldier rules (D-312). */
  readonly rules: ReadRules
  readonly unit: FilterUnit
  selectUnit(unitId: UnitId | null): void
  /** Writes the bar's conditions. */
  setConditions(conditions: SoldierConditions): void
  /** Writes the unit and the soldier rules (D-312). */
  setRules(filter: SoldierFilter): void
  /** Removes every condition, the unit included. */
  clear(): void
}

export function useViewFilter(): ViewFilterState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const filter = search.filter ?? null
  const read = useMemo(() => readFilter(filter), [filter])
  const rules = useMemo(() => readRules(filter), [filter])
  const unit = useMemo(() => filterUnitOf(filter), [filter])
  const setConditions = useCallback(
    (conditions: SoldierConditions) => {
      change({ filter: writeFilter(conditions) })
    },
    [change],
  )
  const setRules = useCallback(
    (next: SoldierFilter) => {
      change({ filter: writeRules(next) })
    },
    [change],
  )
  const selectUnit = useCallback(
    (unitId: UnitId | null) => {
      // A filter the builder does not read gives way to the unit alone, as in V3 (D-104).
      const base = rules.kind === 'rules' ? rules.filter : NO_RULES
      setRules({ ...base, unitId })
    },
    [rules, setRules],
  )
  const clear = useCallback(() => {
    change({ filter: undefined })
  }, [change])
  return { filter, read, rules, unit, selectUnit, setConditions, setRules, clear }
}
