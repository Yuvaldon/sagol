import type { BoardSortKey, SortOrder } from '@config'
import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  FilterExpression,
  Soldier,
  SoldierId,
  Unit,
  UnitId,
} from '@contracts'
import { effectiveSeniority } from '@domain'
import { filterContextOf, populationOf, type FilterSource } from '../filters/source'
import { byName, membershipsBySoldier, unitStateOn, type UnitState } from '../roster/roster'
import { unitTreeRows } from '../units/tree'

// The rows of the board (D-105, D-174): who served in the selected unit during the window, grouped by
// unit like the tree, in the order the sort control asks for (D-214), most senior first by default. The bar's leave
// conditions and "only who is missing" narrow them (D-132, D-133). Pure; the hook feeds it.

/** How the rows are ordered (D-214). */
export interface BoardSort {
  readonly key: BoardSortKey
  readonly order: SortOrder
}

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
  readonly sort: BoardSort
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

/**
 * Orders rows by the sort's key in its direction (D-214): a row with no value for the key comes last either way, and
 * the name breaks ties. The unit key orders the groups, so inside one the rows keep the default, most senior first.
 */
function rowOrder(sort: BoardSort, values: ReadonlyMap<SoldierId, SortValues>): (a: BoardSoldierItem, b: BoardSoldierItem) => number {
  const sign = sort.order === 'asc' ? 1 : -1
  const byValue = (pick: (row: SortValues) => number | null, direction: number) => (a: BoardSoldierItem, b: BoardSoldierItem) => {
    const left = values.get(a.key)
    const right = values.get(b.key)
    const x = left === undefined ? null : pick(left)
    const y = right === undefined ? null : pick(right)
    if (x === null || y === null) {
      if (x !== y) return x === null ? 1 : -1
    } else if (x !== y) {
      return (x - y) * direction
    }
    return byName(a.soldier, b.soldier)
  }
  switch (sort.key) {
    case 'name':
      return (a, b) => byName(a.soldier, b.soldier) * sign
    case 'rank':
      return byValue((row) => row.rank, sign)
    case 'seniority':
      return byValue((row) => row.seniority, sign)
    case 'absent':
      return byValue((row) => row.daysAway, sign)
    case 'unit':
      return byValue((row) => row.seniority, -1)
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
    const state = unitStateOn(own, unitById, soldier.id, referenceDay, reads === true)
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
  if (input.sort.key === 'unit' && input.sort.order === 'desc') unitOrder.reverse()
  const order: string[] = [...unitOrder, ...STATE_GROUPS]
  const compare = rowOrder(input.sort, values)
  return order.flatMap((key) => {
    const group = groups.get(key)
    if (group === undefined) return []
    const header: BoardGroupItem = { kind: 'group', key: `group:${key}`, label: group.label, size: group.rows.length }
    return [header, ...group.rows.sort(compare)]
  })
}
