import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  FilterExpression,
  PropertyDefinition,
  Soldier,
  SoldierId,
  SoldierTag,
  Unit,
  UnitId,
  UnitMembership,
} from '@contracts'
import { filterContextOf, populationOf } from '../filters/source'
import { byName, membershipsBySoldier, unitStateOn, type UnitState } from '../roster/roster'
import { unitTreeRows } from '../units/tree'

// The rows of the timeline (D-105): who served in the selected unit during the window, grouped by
// unit like the tree, most senior first. The bar's leave conditions and "only who is missing" narrow them
// (D-132, D-133). Pure; the hook feeds it.

export interface TimelineInput {
  readonly soldiers: readonly Soldier[]
  /** Archived ones too: a soldier keeps showing the rank they hold. */
  readonly ranks: readonly CommandRank[]
  /** The live units the actor can see. */
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  /** Every tag row of the soldiers, which the filter reads (D-131). */
  readonly soldierTags: readonly SoldierTag[]
  /** Archived ones too, as the filter source holds them (OI-080). */
  readonly propertyDefinitions: readonly PropertyDefinition[]
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
}

/** What a group header says: a unit by its path, or one of the states of D-106. */
export type TimelineGroupLabel =
  | { readonly kind: 'unit'; readonly path: readonly string[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'other' }
  | { readonly kind: 'unknown' }

export interface TimelineGroupItem {
  readonly kind: 'group'
  readonly key: string
  readonly label: TimelineGroupLabel
  /** How many soldiers the group holds. */
  readonly size: number
}

export interface TimelineSoldierItem {
  readonly kind: 'soldier'
  readonly key: SoldierId
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** One flag per day of the window: false where the soldier does not match the filter that day. */
  readonly inScope: readonly boolean[]
  /** With "only who is missing", one flag per day: true where it mutes a day the soldier is present (D-133). */
  readonly present?: readonly boolean[]
}

export type TimelineItem = TimelineGroupItem | TimelineSoldierItem

const EVERYONE: FilterExpression = {}
const STATE_GROUPS = ['none', 'other', 'unknown'] as const

/** The most senior rank first, no rank last, then by name (D-094, D-105). */
function bySeniorityThenName(a: TimelineSoldierItem, b: TimelineSoldierItem): number {
  if (a.rank === null || b.rank === null) {
    if (a.rank !== b.rank) return a.rank === null ? 1 : -1
  } else if (a.rank.seniority !== b.rank.seniority) {
    return b.rank.seniority - a.rank.seniority
  }
  return byName(a.soldier, b.soldier)
}

/** The names from below the selected unit down to `unitId`; the selected unit names itself. */
function pathOf(unitId: UnitId, unitById: ReadonlyMap<UnitId, Unit>, scopeUnitId: UnitId | null): string[] {
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

function groupKeyOf(state: UnitState): string {
  return state.kind === 'unit' ? state.unit.id : state.kind
}

export function timelineItems(input: TimelineInput): TimelineItem[] {
  const { days, today } = input
  const filter = input.filter ?? EVERYONE
  const context = filterContextOf({
    soldiers: input.soldiers,
    ranks: input.ranks,
    units: input.units,
    memberships: input.memberships,
    soldierTags: input.soldierTags,
    propertyDefinitions: input.propertyDefinitions,
  })
  const inPopulation = populationOf(input.filter)
  const rankById = new Map<CommandRankId, CommandRank>(input.ranks.map((rank) => [rank.id, rank]))
  const unitById = new Map<UnitId, Unit>(input.units.map((unit) => [unit.id, unit]))
  const bySoldier = membershipsBySoldier(input.memberships)
  const todayIndex = days.indexOf(today)

  const groups = new Map<string, { label: TimelineGroupLabel; rows: TimelineSoldierItem[] }>()
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
    const label: TimelineGroupLabel =
      state.kind === 'unit' ? { kind: 'unit', path: pathOf(state.unit.id, unitById, input.scopeUnitId) } : { kind: state.kind }
    const rank = soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null)
    const group = groups.get(key) ?? { label, rows: [] }
    group.rows.push({ kind: 'soldier', key: soldier.id, soldier, rank, inScope, ...(present === null ? {} : { present }) })
    groups.set(key, group)
  }

  const order: string[] = [...unitTreeRows(input.units).map((row) => row.unit.id), ...STATE_GROUPS]
  return order.flatMap((key) => {
    const group = groups.get(key)
    if (group === undefined) return []
    const header: TimelineGroupItem = { kind: 'group', key: `group:${key}`, label: group.label, size: group.rows.length }
    return [header, ...group.rows.sort(bySeniorityThenName)]
  })
}
