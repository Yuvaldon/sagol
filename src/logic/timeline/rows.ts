import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  FilterExpression,
  Soldier,
  SoldierId,
  Unit,
  UnitId,
  UnitMembership,
} from '@contracts'
import { createFilterContext } from '@domain'
import { byName, membershipsBySoldier, unitStateOn, type ReadsPlacements, type UnitState } from '../roster/roster'
import { unitTreeRows } from '../units/tree'

// The rows of the timeline (D-105): who served in the selected unit during the window, grouped by
// unit like the tree, most senior first. Pure; the hook feeds it.

export interface TimelineInput {
  readonly soldiers: readonly Soldier[]
  /** Archived ones too: a soldier keeps showing the rank they hold. */
  readonly ranks: readonly CommandRank[]
  /** The live units the actor can see. */
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  /** The selected unit, whose name starts no path below it. */
  readonly scopeUnitId: UnitId | null
  readonly readsPlacements: ReadsPlacements
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
  const context = createFilterContext({
    units: input.units,
    soldiers: input.soldiers,
    soldier_tags: [],
    command_ranks: input.ranks,
    seniority_overrides: [],
    unit_memberships: input.memberships,
    property_definitions: [],
  })
  const rankById = new Map<CommandRankId, CommandRank>(input.ranks.map((rank) => [rank.id, rank]))
  const unitById = new Map<UnitId, Unit>(input.units.map((unit) => [unit.id, unit]))
  const bySoldier = membershipsBySoldier(input.memberships)
  const todayIndex = days.indexOf(today)

  const groups = new Map<string, { label: TimelineGroupLabel; rows: TimelineSoldierItem[] }>()
  for (const soldier of input.soldiers) {
    if (soldier.status !== 'active' || soldier.archived_at !== null) continue
    const inScope = days.map((day) => context.matches(filter, soldier.id, day))
    const firstMatch = inScope.indexOf(true)
    if (firstMatch < 0) continue
    // Today when the soldier is in the view today, otherwise the first day they are (D-105).
    const referenceDay = todayIndex >= 0 && inScope[todayIndex] === true ? today : (days[firstMatch] ?? null)
    const own = bySoldier.get(soldier.id) ?? []
    const state = unitStateOn(own, unitById, soldier.id, referenceDay, input.readsPlacements(soldier.id))
    const key = groupKeyOf(state)
    const label: TimelineGroupLabel =
      state.kind === 'unit' ? { kind: 'unit', path: pathOf(state.unit.id, unitById, input.scopeUnitId) } : { kind: state.kind }
    const rank = soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null)
    const group = groups.get(key) ?? { label, rows: [] }
    group.rows.push({ kind: 'soldier', key: soldier.id, soldier, rank, inScope })
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
