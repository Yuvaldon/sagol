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
  Tag,
  TagCategory,
  TagId,
  Unit,
  UnitId,
} from '@contracts'
import { effectiveSeniority } from '@domain'
import { filterContextOf, populationOf, type FilterSource } from '../filters/source'
import { byName, compareText, membershipsBySoldier, unitStateOn, type UnitState } from '../roster/roster'
import { DEFAULT_SORT_RULES, type SortRule } from '../view-state/sort-rules'
import type { BoardGrouping } from '../view-state/grouping'
import { unitTreeRows } from '../units/tree'

// The rows of the board (D-105, D-174): who served in the selected unit during the window, grouped as the view asks
// (D-452) — by unit like the tree, by command rank, by a tag category, or not at all — in the order of the sort rules
// (D-214, D-313), most senior first by default. The bar's leave conditions and "only who is missing" narrow them
// (D-132, D-133). Pure; the hook feeds it.

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
  /** The grouping the board applies (D-452): the URL's, or the default. */
  readonly grouping: BoardGrouping
  /** Every tag and category, archived ones too: a held tag keeps its group (D-130). */
  readonly tags: readonly Tag[]
  readonly tagCategories: readonly TagCategory[]
}

/** What a group header says: a unit by its path, or one of the states of D-106. */
export type BoardGroupLabel =
  | { readonly kind: 'unit'; readonly path: readonly string[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'other' }
  | { readonly kind: 'unknown' }

/** What a header of the board says (D-452): a unit or a state of D-106, a command rank, or a tag of the category. */
export type BoardHeading =
  | BoardGroupLabel
  | { readonly kind: 'rank'; readonly title: string }
  | { readonly kind: 'noRank' }
  | { readonly kind: 'tag'; readonly name: string }
  | { readonly kind: 'noTag'; readonly category: string }

export interface BoardGroupItem {
  readonly kind: 'group'
  readonly key: string
  readonly label: BoardHeading
  /** How many soldiers the group holds. */
  readonly size: number
}

export interface BoardSoldierItem {
  readonly kind: 'soldier'
  readonly key: SoldierId
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** The soldier's unit on the reference day (D-105), whatever the grouping: the table's unit column reads it. */
  readonly unit: BoardGroupLabel
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
  /** The place of the soldier's unit in the tree, then the states of D-106 after every unit. */
  readonly unit: { readonly state: number; readonly place: number }
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
 * and the name breaks the last ties. The key the rows are grouped by orders the groups (see `boardItems`), so inside one
 * it is skipped; when it is the only rule, the rows inside a group keep the default order, most senior first (D-214).
 * Without unit grouping, the unit key sorts the rows by their unit's place in the tree, the states of D-106 after (D-452).
 */
function rowOrder(
  sorts: readonly SortRule[],
  values: ReadonlyMap<SoldierId, SortValues>,
  definitions: ReadonlyMap<PropertyDefinitionId, PropertyDefinition>,
  groupKey: 'unit' | 'rank' | null,
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
    if (rule.key === groupKey) return null
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
        return (a, b) => {
          const x = values.get(a.key)?.unit
          const y = values.get(b.key)?.unit
          if (x === undefined || y === undefined) return 0
          // The states keep D-106's order after the units, whichever way the units go.
          return x.state !== y.state ? x.state - y.state : (x.place - y.place) * sign
        }
    }
  }
  const own = sorts.flatMap((rule) => byRule(rule) ?? [])
  const compares = own.length > 0 || sorts.length === 0 ? own : DEFAULT_SORT_RULES.flatMap((rule) => byRule(rule) ?? [])
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

interface Group {
  readonly label: BoardHeading
  readonly rows: BoardSoldierItem[]
}

const NO_RANK = 'noRank'
const NO_TAG = 'noTag'
const UNGROUPED = 'all'

/** Where a soldier's row goes under a rank or tag grouping, and the order of those groups (D-452). */
interface Grouper {
  readonly keyOf: (soldier: Soldier, rank: CommandRank | null) => { readonly key: string; readonly label: BoardHeading }
  readonly order: readonly string[]
}

function rankGrouper(input: BoardInput): Grouper {
  const rule = input.sorts.find((held) => 'key' in held && held.key === 'rank')
  // The most senior first, as the rank key sorts by default (D-214); a `rank` rule's direction orders them.
  const sign = rule?.order === 'asc' ? 1 : -1
  const ranks = [...input.ranks].sort((a, b) => (a.seniority - b.seniority) * sign || compareText(a.title, b.title))
  return {
    keyOf: (_soldier, rank) =>
      rank === null ? { key: NO_RANK, label: { kind: 'noRank' } } : { key: `rank:${rank.id}`, label: { kind: 'rank', title: rank.title } },
    order: [...ranks.map((rank) => `rank:${rank.id}`), NO_RANK],
  }
}

function tagGrouper(input: BoardInput, category: TagCategory): Grouper {
  const inCategory = input.tags
    .filter((tag) => tag.category_id === category.id)
    .sort((a, b) => a.sort_order - b.sort_order || compareText(a.name, b.name))
  const placed = new Map<TagId, { readonly tag: Tag; readonly at: number }>(inCategory.map((tag, at) => [tag.id, { tag, at }]))
  const held = new Map<SoldierId, { readonly tag: Tag; readonly at: number }>()
  for (const row of input.soldierTags) {
    const found = placed.get(row.tag_id)
    if (found === undefined) continue
    const current = held.get(row.soldier_id)
    // `single` holds one per soldier in the board's rotation (D-221); were there two, the first in order decides.
    if (current === undefined || found.at < current.at) held.set(row.soldier_id, found)
  }
  return {
    keyOf: (soldier) => {
      const tag = held.get(soldier.id)?.tag
      return tag === undefined
        ? { key: NO_TAG, label: { kind: 'noTag', category: category.name } }
        : { key: `tag:${tag.id}`, label: { kind: 'tag', name: tag.name } }
    },
    order: [...inCategory.map((tag) => `tag:${tag.id}`), NO_TAG],
  }
}

export function boardItems(input: BoardInput): BoardItem[] {
  const { days, today, grouping } = input
  const filter = input.filter ?? EVERYONE
  const context = filterContextOf(input)
  const inPopulation = populationOf(input.filter)
  const rankById = new Map<CommandRankId, CommandRank>(input.ranks.map((rank) => [rank.id, rank]))
  // The tree holds archived units too, so a soldier in an archived sub-unit keeps its heading (D-147).
  const unitById = new Map<UnitId, Unit>(input.unitTree.map((unit) => [unit.id, unit]))
  const treeOrder = unitTreeRows(input.unitTree).map((row) => row.unit.id)
  const treePlace = new Map<string, number>(treeOrder.map((unitId, index) => [unitId, index]))
  const bySoldier = membershipsBySoldier(input.memberships)
  const todayIndex = days.indexOf(today)
  const values = new Map<SoldierId, SortValues>()
  // With one live root, a soldier with no unit in the window belongs to it (D-315). The organization holds at most one
  // live top-level unit (D-321), so a top-level unit the actor sees is that root; no wider tree is needed (D-323).
  const roots = input.units.filter((unit) => unit.parent_id === null)
  const root = roots.length === 1 ? (roots[0] ?? null) : null
  const category = 'category' in grouping ? (input.tagCategories.find((held) => held.id === grouping.category) ?? null) : null
  const grouper: Grouper | null =
    category !== null ? tagGrouper(input, category) : 'key' in grouping && grouping.key === 'rank' ? rankGrouper(input) : null
  const byUnit = 'key' in grouping && grouping.key === 'unit'

  const groups = new Map<string, Group>()
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
    const unitKey = groupKeyOf(state)
    const unit: BoardGroupLabel =
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
      unit:
        state.kind === 'unit'
          ? { state: 0, place: treePlace.get(unitKey) ?? treeOrder.length }
          : { state: 1 + STATE_GROUPS.indexOf(state.kind), place: 0 },
    })
    const { key, label } =
      grouper !== null ? grouper.keyOf(soldier, rank) : byUnit ? { key: unitKey, label: unit } : { key: UNGROUPED, label: unit }
    const group = groups.get(key) ?? { label, rows: [] }
    group.rows.push({ kind: 'soldier', key: soldier.id, soldier, rank, unit, inScope, ...(present === null ? {} : { present }) })
    groups.set(key, group)
  }

  const definitions = new Map(input.propertyDefinitions.map((definition) => [definition.id, definition]))
  const groupKey = byUnit ? 'unit' : grouper !== null && category === null ? 'rank' : null
  const compare = rowOrder(input.sorts, values, definitions, groupKey)
  // No grouping: one run of rows, no header (D-452).
  if (grouper === null && !byUnit) return groups.get(UNGROUPED)?.rows.sort(compare) ?? []
  const unitRule = input.sorts.find((rule) => 'key' in rule && rule.key === 'unit')
  const unitOrder = unitRule?.order === 'desc' ? [...treeOrder].reverse() : treeOrder
  const order: readonly string[] = grouper?.order ?? [...unitOrder, ...STATE_GROUPS]
  return order.flatMap((key) => {
    const group = groups.get(key)
    if (group === undefined) return []
    const header: BoardGroupItem = { kind: 'group', key: `group:${key}`, label: group.label, size: group.rows.length }
    return [header, ...group.rows.sort(compare)]
  })
}
