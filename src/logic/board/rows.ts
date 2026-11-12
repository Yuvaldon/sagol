import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  FilterExpression,
  JsonValue,
  PropertyDefinition,
  PropertyDefinitionId,
  Soldier,
  SoldierId,
  Unit,
  UnitId,
} from '@contracts'
import { effectiveSeniority } from '@domain'
import { filterContextOf, populationOf, type FilterSource } from '../filters/source'
import { byName, compareText, membershipsBySoldier, unitStateOn, type UnitState } from '../roster/roster'
import type { SortRule } from '../view-state/sort-rules'
import { unitTreeRows } from '../units/tree'

/** One sort key and direction, as the old single sort wrote it (D-214); the board now takes a list of rules (D-313). */
export type BoardSort = Extract<SortRule, { readonly key: unknown }>

// The rows of the board (D-105, D-174): who served in the selected unit during the window, grouped by
// unit like the tree, in the order of the sort rules (D-214, D-313), most senior first by default. The bar's leave
// conditions and "only who is missing" narrow them (D-132, D-133). Pure; the hook feeds it.

/** The filter source, and the window and conditions the board shows it for. */
export interface BoardInput extends FilterSource {
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  /** The selected unit, whose name starts no path below it. */
  readonly scopeUnitId: UnitId | null
  /**
   * Whether the actor may read the soldier's placements; NULL while that hint has not answered. A soldier with no
   * placement read yet waits out of the board until it does, so their row never says "unknown" early (D-122, OI-093).
   */
  readonly readsPlacements: (soldierId: SoldierId) => boolean | null
  /** With leave conditions: whether the soldier has a matching mark in the window (D-132). NULL without them. */
  readonly marked: ((soldierId: SoldierId) => boolean) | null
  /** With "only who is missing": whether the soldier is unavailable, one flag per day (D-133). NULL when off. */
  readonly absent: ((soldierId: SoldierId) => readonly boolean[]) | null
  /** The sort rules, in order (D-313). */
  readonly sorts: readonly SortRule[]
  /** With the `absent` sort key: the soldier's approved days away in the window (D-214). NULL otherwise. */
  readonly daysAway: ((soldierId: SoldierId) => number) | null
}

/** What a group header says: a unit by its path, or one of the states of D-106. */
export type BoardGroupLabel =
  | { readonly kind: 'unit'; readonly path: readonly string[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'other' }
  | { readonly kind: 'unknown' }

export interface BoardGroupItem {
  readonly kind: 'group'
  readonly key: string
  readonly label: BoardGroupLabel
  /** How many soldiers the group holds. */
  readonly size: number
}

export interface BoardSoldierItem {
  readonly kind: 'soldier'
  readonly key: SoldierId
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** One flag per day of the window: false where the soldier does not match the filter that day. */
  readonly inScope: readonly boolean[]
  /** With "only who is missing", one flag per day: true where it mutes a day the soldier is present (D-133). */
  readonly present?: readonly boolean[]
}

export type BoardItem = BoardGroupItem | BoardSoldierItem

const EVERYONE: FilterExpression = {}
/** The groups of the soldiers with no visible unit, after the units (D-106). */
export const STATE_GROUPS = ['none', 'other', 'unknown'] as const

/** What a row is sorted by, beside its name. */
interface SortValues {
  readonly rank: number | null
  readonly seniority: number | null
  readonly daysAway: number
}

type Comparable = number | string | null

/** A soldier's value of a sortable property (D-313): a select by its option's order; no value or another type is NULL. */
function propertyValueOf(definition: PropertyDefinition | undefined, value: JsonValue | undefined): Comparable {
  if (definition === undefined || value === undefined || value === null) return null
  switch (definition.data_type) {
    case 'text':
    case 'date':
      return typeof value === 'string' && value !== '' ? value : null
    case 'number':
      return typeof value === 'number' ? value : null
    case 'boolean':
      return typeof value === 'boolean' ? Number(value) : null
    case 'select':
      return definition.options.find((option) => option.id === value)?.sort_order ?? null
    default:
      return null
  }
}

function compareValues(x: Comparable, y: Comparable): number {
  if (x === null || y === null) return 0
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return compareText(String(x), String(y))
}

type Compare = (a: BoardSoldierItem, b: BoardSoldierItem) => number

/**
 * Orders rows by each rule in turn (D-214, D-313): a row with no value for a rule comes after the others either way,
 * and the name breaks the last ties. The unit key orders the groups (see `boardItems`), so inside one it is skipped.
 */
function rowOrder(
  sorts: readonly SortRule[],
  values: ReadonlyMap<SoldierId, SortValues>,
  definitions: ReadonlyMap<PropertyDefinitionId, PropertyDefinition>,
): Compare {
  const byRule = (rule: SortRule): Compare | null => {
    const sign = rule.order === 'asc' ? 1 : -1
    const byValue =
      (pick: (row: BoardSoldierItem) => Comparable): Compare =>
      (a, b) => {
        const x = pick(a)
        const y = pick(b)
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
        return compareValues(x, y) * sign
      }
    const stored = (pick: (row: SortValues) => number | null) => byValue((row) => {
      const held = values.get(row.key)
      return held === undefined ? null : pick(held)
    })
    if ('property' in rule) {
      const definition = definitions.get(rule.property)
      return byValue((row) => propertyValueOf(definition, row.soldier.properties[rule.property]))
    }
    switch (rule.key) {
      case 'name':
        return (a, b) => byName(a.soldier, b.soldier) * sign
      case 'rank':
        return stored((row) => row.rank)
      case 'seniority':
        return stored((row) => row.seniority)
      case 'absent':
        return stored((row) => row.daysAway)
      case 'unit':
        return null
    }
  }
  const compares = sorts.flatMap((rule) => byRule(rule) ?? [])
  return (a, b) => {
    for (const compare of compares) {
      const result = compare(a, b)
      if (result !== 0) return result
    }
    return byName(a.soldier, b.soldier)
  }
}

/** The names from below the selected unit down to `unitId`; the selected unit names itself. */
export function unitPathOf(unitId: UnitId, unitById: ReadonlyMap<UnitId, Unit>, scopeUnitId: UnitId | null): string[] {
  const names: string[] = []
  const seen = new Set<UnitId>()
  for (let current = unitById.get(unitId); current !== undefined; ) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    if (current.id === scopeUnitId && names.length > 0) break
    names.unshift(current.name)
    if (current.id === scopeUnitId || current.parent_id === null) break
    current = unitById.get(current.parent_id)
  }
  return names
}

export function groupKeyOf(state: UnitState): string {
  return state.kind === 'unit' ? state.unit.id : state.kind
}

export function boardItems(input: BoardInput): BoardItem[] {
  const { days, today } = input
  const filter = input.filter ?? EVERYONE
  const context = filterContextOf(input)
  const inPopulation = populationOf(input.filter)
  const rankById = new Map<CommandRankId, CommandRank>(input.ranks.map((rank) => [rank.id, rank]))
  // The tree holds archived units too, so a soldier in an archived sub-unit keeps its heading (D-147).
  const unitById = new Map<UnitId, Unit>(input.unitTree.map((unit) => [unit.id, unit]))
  const bySoldier = membershipsBySoldier(input.memberships)
  const todayIndex = days.indexOf(today)
  const values = new Map<SoldierId, SortValues>()
  // With one live root, a soldier with no unit in the window belongs to it (D-315).
  const roots = input.units.filter((unit) => unit.parent_id === null)
  const root = roots.length === 1 ? (roots[0] ?? null) : null

  const groups = new Map<string, { label: BoardGroupLabel; rows: BoardSoldierItem[] }>()
  for (const soldier of input.soldiers) {
    if (!inPopulation(soldier)) continue
    if (input.marked !== null && !input.marked(soldier.id)) continue
    const inScope = days.map((day) => context.matches(filter, soldier.id, day))
    const absentDays = input.absent === null ? null : input.absent(soldier.id)
    const present = absentDays === null ? null : days.map((_, index) => inScope[index] === true && absentDays[index] !== true)
    // With "only who is missing", a row needs a day on which it is in the view and absent (D-133).
    if (!inScope.some((on, index) => on && present?.[index] !== true)) continue
    const firstMatch = inScope.indexOf(true)
    // Today when the soldier is in the view today, otherwise the first day they are (D-105).
    const referenceDay = todayIndex >= 0 && inScope[todayIndex] === true ? today : (days[firstMatch] ?? null)
    const own = bySoldier.get(soldier.id) ?? []
    const reads = input.readsPlacements(soldier.id)
    if (reads === null && own.length === 0) continue
    const placed = unitStateOn(own, unitById, soldier.id, referenceDay, reads === true)
    const state: UnitState = placed.kind === 'none' && root !== null ? { kind: 'unit', unit: root } : placed
    const key = groupKeyOf(state)
    const label: BoardGroupLabel =
      state.kind === 'unit' ? { kind: 'unit', path: unitPathOf(state.unit.id, unitById, input.scopeUnitId) } : { kind: state.kind }
    const rank = soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null)
    const seniorityDay = referenceDay ?? days[0]
    values.set(soldier.id, {
      rank: rank?.seniority ?? null,
      seniority:
        seniorityDay === undefined
          ? (rank?.seniority ?? null)
          : effectiveSeniority(rank?.seniority ?? null, input.seniorityOverrides, soldier.id, seniorityDay),
      daysAway: input.daysAway === null ? 0 : input.daysAway(soldier.id),
    })
    const group = groups.get(key) ?? { label, rows: [] }
    group.rows.push({ kind: 'soldier', key: soldier.id, soldier, rank, inScope, ...(present === null ? {} : { present }) })
    groups.set(key, group)
  }

  const unitOrder = unitTreeRows(input.unitTree).map((row) => row.unit.id)
  const unitRule = input.sorts.find((rule) => 'key' in rule && rule.key === 'unit')
  if (unitRule?.order === 'desc') unitOrder.reverse()
  const order: string[] = [...unitOrder, ...STATE_GROUPS]
  const definitions = new Map(input.propertyDefinitions.map((definition) => [definition.id, definition]))
  const compare = rowOrder(input.sorts, values, definitions)
  return order.flatMap((key) => {
    const group = groups.get(key)
    if (group === undefined) return []
    const header: BoardGroupItem = { kind: 'group', key: `group:${key}`, label: group.label, size: group.rows.length }
    return [header, ...group.rows.sort(compare)]
  })
}
