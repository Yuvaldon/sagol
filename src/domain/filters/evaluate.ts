import {
  PropertyEntityType,
  type CalendarDate,
  type CommandRank,
  type CommandRankId,
  type FilterExpression,
  type FilterNode,
  type JsonValue,
  type Soldier,
  type SoldierId,
  type SoldierTag,
  type TagId,
  type Unit,
  type UnitId,
} from '@contracts'
import { buildUnitTree, isAncestorOrSelf, primaryUnitOn, type MembershipSpan, type UnitNode } from '../hierarchy'
import { effectiveSeniority, type SeniorityOverrideSpan } from '../policy'
import { propertyMatches } from './operators'
import type { FilterDefinitionShape } from './validate'

// The filter evaluator (ARCHITECTURE "Filters", D-067): one meaning for view filters,
// saved views and availability-rule populations. Time-bound conditions are evaluated on
// a given day: the unit is the primary membership that day (D-054), the seniority the
// effective seniority that day (D-029). Rank, status, tags and properties are current. A unit property reads the
// soldier's primary unit that day (D-381).

/** What filters read of a unit: its place in the tree and its property values (D-381). */
export type FilterUnit = UnitNode & Pick<Unit, 'properties'>

/** What filters read. Full contract rows fit every field. */
export interface FilterData {
  readonly units: Iterable<FilterUnit>
  readonly soldiers: Iterable<Pick<Soldier, 'id' | 'command_rank_id' | 'status' | 'properties'>>
  readonly soldier_tags: Iterable<Pick<SoldierTag, 'soldier_id' | 'tag_id'>>
  readonly command_ranks: Iterable<Pick<CommandRank, 'id' | 'seniority'>>
  readonly seniority_overrides: Iterable<SeniorityOverrideSpan>
  readonly unit_memberships: Iterable<MembershipSpan>
  readonly property_definitions: Iterable<FilterDefinitionShape>
}

/** The indexed snapshot. Build once with `createFilterContext`, evaluate many times. */
export interface FilterContext {
  /** Every soldier of the snapshot, in input order. */
  readonly soldierIds: readonly SoldierId[]
  /** True when the soldier matches on `date`. An unknown soldier matches nothing. */
  matches(expression: FilterExpression, soldierId: SoldierId, date: CalendarDate): boolean
  /** The soldiers that match on `date`, in input order. */
  select(expression: FilterExpression, date: CalendarDate): SoldierId[]
}

interface IndexedSoldier {
  readonly id: SoldierId
  readonly command_rank_id: CommandRankId | null
  readonly status: Soldier['status']
  readonly properties: ReadonlyMap<string, JsonValue>
  readonly tags: ReadonlySet<TagId>
}

function groupBy<K, V>(items: Iterable<V>, keyOf: (item: V) => K): Map<K, V[]> {
  const groups = new Map<K, V[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [item])
    else group.push(item)
  }
  return groups
}

export function createFilterContext(data: FilterData): FilterContext {
  const units = [...data.units]
  const tree = buildUnitTree(units)
  const unitProperties = new Map<UnitId, ReadonlyMap<string, JsonValue>>(
    units.map((unit) => [unit.id, new Map(Object.entries(unit.properties))]),
  )
  const rankSeniority = new Map<CommandRankId, number>([...data.command_ranks].map((rank) => [rank.id, rank.seniority]))
  const membershipsBySoldier = groupBy(data.unit_memberships, (row) => row.soldier_id)
  const overridesBySoldier = groupBy(data.seniority_overrides, (row) => row.soldier_id)
  const tagsBySoldier = groupBy(data.soldier_tags, (row) => row.soldier_id)
  const definitions = new Map<string, FilterDefinitionShape>()
  for (const definition of data.property_definitions) definitions.set(definition.id, definition)

  const soldiers = new Map<SoldierId, IndexedSoldier>()
  for (const soldier of data.soldiers) {
    soldiers.set(soldier.id, {
      id: soldier.id,
      command_rank_id: soldier.command_rank_id,
      status: soldier.status,
      properties: new Map(Object.entries(soldier.properties)),
      tags: new Set((tagsBySoldier.get(soldier.id) ?? []).map((row) => row.tag_id)),
    })
  }
  const soldierIds = [...soldiers.keys()]

  const unitCache = new Map<string, UnitId | null>()
  function unitOn(soldierId: SoldierId, date: CalendarDate): UnitId | null {
    const key = `${soldierId}|${date}`
    const cached = unitCache.get(key)
    if (cached !== undefined) return cached
    const unitId = primaryUnitOn(membershipsBySoldier.get(soldierId) ?? [], soldierId, date)
    unitCache.set(key, unitId)
    return unitId
  }

  function seniorityOn(soldier: IndexedSoldier, date: CalendarDate): number | null {
    const fromRank = soldier.command_rank_id === null ? null : (rankSeniority.get(soldier.command_rank_id) ?? null)
    return effectiveSeniority(fromRank, overridesBySoldier.get(soldier.id) ?? [], soldier.id, date)
  }

  function evaluate(node: FilterNode, soldier: IndexedSoldier, date: CalendarDate): boolean {
    switch (node.kind) {
      case 'and':
        return node.nodes.every((child) => evaluate(child, soldier, date))
      case 'or':
        return node.nodes.some((child) => evaluate(child, soldier, date))
      case 'not':
        return !evaluate(node.node, soldier, date)
      case 'tag':
        if (node.match === 'any') return node.tag_ids.some((id) => soldier.tags.has(id))
        if (node.match === 'all') return node.tag_ids.every((id) => soldier.tags.has(id))
        return !node.tag_ids.some((id) => soldier.tags.has(id))
      case 'command_rank':
        return soldier.command_rank_id !== null && node.command_rank_ids.includes(soldier.command_rank_id)
      case 'seniority': {
        const seniority = seniorityOn(soldier, date)
        if (seniority === null) return false
        return (node.min === null || seniority >= node.min) && (node.max === null || seniority <= node.max)
      }
      case 'unit': {
        const unitId = unitOn(soldier.id, date)
        if (unitId === null) return false
        return node.unit_ids.some(
          (id) => id === unitId || (node.include_descendants && isAncestorOrSelf(tree, id, unitId)),
        )
      }
      case 'soldier_status':
        return node.statuses.includes(soldier.status)
      case 'soldier':
        return node.soldier_ids.includes(soldier.id)
      case 'property': {
        // A soldier property reads the soldier; a unit property the soldier's primary unit that day, and a soldier
        // with no unit that day has no value (D-381). A missing definition, or a leave's, matches nobody (D-067).
        const definition = definitions.get(node.property_definition_id)
        if (definition === undefined) return false
        if (definition.entity_type === PropertyEntityType.enum.soldier) {
          return propertyMatches(definition, node.operator, node.value, soldier.properties.get(definition.id))
        }
        if (definition.entity_type !== PropertyEntityType.enum.unit) return false
        const unitId = unitOn(soldier.id, date)
        const stored = unitId === null ? undefined : unitProperties.get(unitId)?.get(definition.id)
        return propertyMatches(definition, node.operator, node.value, stored)
      }
    }
  }

  function matches(expression: FilterExpression, soldierId: SoldierId, date: CalendarDate): boolean {
    const soldier = soldiers.get(soldierId)
    if (soldier === undefined) return false
    return expression.where === undefined || evaluate(expression.where, soldier, date)
  }

  return {
    soldierIds,
    matches,
    select: (expression, date) => soldierIds.filter((soldierId) => matches(expression, soldierId, date)),
  }
}
