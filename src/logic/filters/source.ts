import type { CommandRank, FilterExpression, FilterNode, Soldier, SoldierTag, Unit, UnitMembership } from '@contracts'
import { createFilterContext, type FilterContext } from '@domain'
import { useMemo } from 'react'
import type { Loaded } from '../queries/loaded'
import { useCommandRanks, useMemberships, useSoldiers, useUnitsWithArchived } from '../roster/hooks'
import { useSoldierTags } from '../tags/hooks'
import { useUnits } from '../units/hooks'

// The one source of the data a filter reads (D-131, OI-079): every engine, the filter bar, the presence lists and the
// rules read it, so a condition means the same everywhere (D-067, D-147). Seniority overrides join with V15 (OI-081) and property values with V14
// (OI-080); before them none can exist.

export interface FilterSource {
  /** Live soldiers the actor sees. */
  readonly soldiers: readonly Soldier[]
  /** Archived ones too: a soldier keeps showing the rank they hold. */
  readonly ranks: readonly CommandRank[]
  /** The live units the actor sees. */
  readonly units: readonly Unit[]
  /**
   * Every unit the actor sees, archived ones too: "a unit and below" counts the days a soldier served in a sub-unit
   * archived later, as rules and commands do (D-147).
   */
  readonly unitTree: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly soldierTags: readonly SoldierTag[]
}

/**
 * The filter context of a source. A unit or rank the actor does not see matches nobody (D-104, D-131, OI-101):
 * a link may name an archived unit or one outside the actor's scope, and the evaluator would match its id directly.
 */
export function filterContextOf(source: FilterSource): FilterContext {
  const context = createFilterContext({
    units: source.unitTree,
    soldiers: source.soldiers,
    soldier_tags: source.soldierTags,
    command_ranks: source.ranks,
    seniority_overrides: [],
    unit_memberships: source.memberships,
    property_definitions: [],
  })
  const seenOnly = seenOnlyOf(source)
  const guarded = new WeakMap<FilterExpression, FilterExpression>()
  const guard = (expression: FilterExpression) => {
    const known = guarded.get(expression)
    if (known !== undefined) return known
    const result = expression.where === undefined ? expression : { ...expression, where: seenOnly(expression.where) }
    guarded.set(expression, result)
    return result
  }
  return {
    soldierIds: context.soldierIds,
    matches: (expression, soldierId, date) => context.matches(guard(expression), soldierId, date),
    select: (expression, date) => context.select(guard(expression), date),
  }
}

/** Drops the live units and the ranks the actor does not see from a filter, so a condition on them alone matches nobody. */
function seenOnlyOf(source: FilterSource): (node: FilterNode) => FilterNode {
  const units = new Set<string>(source.units.map((unit) => unit.id))
  const ranks = new Set<string>(source.ranks.map((rank) => rank.id))
  const seenOnly = (node: FilterNode): FilterNode => {
    switch (node.kind) {
      case 'and':
      case 'or':
        return { ...node, nodes: node.nodes.map(seenOnly) }
      case 'not':
        return { ...node, node: seenOnly(node.node) }
      case 'unit':
        return { ...node, unit_ids: node.unit_ids.filter((id) => units.has(id)) }
      case 'command_rank':
        return { ...node, command_rank_ids: node.command_rank_ids.filter((id) => ranks.has(id)) }
      default:
        return node
    }
  }
  return seenOnly
}

export function useFilterSource(): Loaded<FilterSource> {
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnits()
  const unitTree = useUnitsWithArchived()
  const memberships = useMemberships()
  const soldierTags = useSoldierTags()
  return useMemo((): Loaded<FilterSource> => {
    if (soldiers.status !== 'ready') return soldiers
    if (ranks.status !== 'ready') return ranks
    if (units.status !== 'ready') return units
    if (unitTree.status !== 'ready') return unitTree
    if (memberships.status !== 'ready') return memberships
    if (soldierTags.status !== 'ready') return soldierTags
    return {
      status: 'ready',
      value: {
        soldiers: soldiers.value,
        ranks: ranks.value,
        units: units.value,
        unitTree: unitTree.value,
        memberships: memberships.value,
        soldierTags: soldierTags.value,
      },
    }
  }, [soldiers, ranks, units, unitTree, memberships, soldierTags])
}

function mentionsStatus(node: FilterNode): boolean {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.nodes.some(mentionsStatus)
    case 'not':
      return mentionsStatus(node.node)
    default:
      return node.kind === 'soldier_status'
  }
}

/**
 * Who a view may show before the filter speaks (D-105, D-131): soldiers not archived, and only active ones unless
 * the filter has a status condition of its own.
 */
export function populationOf(filter: FilterExpression | null): (soldier: Soldier) => boolean {
  const statusDecided = filter?.where !== undefined && mentionsStatus(filter.where)
  return (soldier) => soldier.archived_at === null && (statusDecided || soldier.status === 'active')
}
