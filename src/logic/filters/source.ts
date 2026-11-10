import type { CommandRank, FilterExpression, FilterNode, Soldier, SoldierTag, Unit, UnitMembership } from '@contracts'
import { createFilterContext, type FilterContext } from '@domain'
import { useMemo } from 'react'
import type { Loaded } from '../queries/loaded'
import { useCommandRanks, useMemberships, useSoldiers } from '../roster/hooks'
import { useSoldierTags } from '../tags/hooks'
import { useUnits } from '../units/hooks'

// The one source of the data a filter reads (D-131, OI-079): the board, the filter bar and the presence lists
// read it, and V7's rules will. Seniority overrides join with V15 (OI-081) and property values with V14
// (OI-080); before them none can exist.

export interface FilterSource {
  /** Live soldiers the actor sees. */
  readonly soldiers: readonly Soldier[]
  /** Archived ones too: a soldier keeps showing the rank they hold. */
  readonly ranks: readonly CommandRank[]
  /** The live units the actor sees. */
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly soldierTags: readonly SoldierTag[]
}

export function filterContextOf(source: FilterSource): FilterContext {
  return createFilterContext({
    units: source.units,
    soldiers: source.soldiers,
    soldier_tags: source.soldierTags,
    command_ranks: source.ranks,
    seniority_overrides: [],
    unit_memberships: source.memberships,
    property_definitions: [],
  })
}

export function useFilterSource(): Loaded<FilterSource> {
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnits()
  const memberships = useMemberships()
  const soldierTags = useSoldierTags()
  return useMemo((): Loaded<FilterSource> => {
    if (soldiers.status !== 'ready') return soldiers
    if (ranks.status !== 'ready') return ranks
    if (units.status !== 'ready') return units
    if (memberships.status !== 'ready') return memberships
    if (soldierTags.status !== 'ready') return soldierTags
    return {
      status: 'ready',
      value: {
        soldiers: soldiers.value,
        ranks: ranks.value,
        units: units.value,
        memberships: memberships.value,
        soldierTags: soldierTags.value,
      },
    }
  }, [soldiers, ranks, units, memberships, soldierTags])
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
