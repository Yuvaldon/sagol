import { DAY_REPORT } from '@config'
import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  Deployment,
  FilterExpression,
  Leave,
  LeaveId,
  LeaveType,
  LeaveTypeId,
  Soldier,
  SoldierId,
  Unit,
  UnitId,
} from '@contracts'
import { addDays, APPROVED_ONLY, compareDates, createAvailabilityContext, dayMovements, type SoldierMovement } from '@domain'
import { groupKeyOf, STATE_GROUPS, unitPathOf, type BoardGroupLabel } from '../board/rows'
import { filterContextOf, populationOf, type FilterSource } from '../filters/source'
import { byName, membershipsBySoldier, unitStateOn } from '../roster/roster'
import { unitTreeRows } from '../units/tree'

// The day report (D-193, D-194): who the board's soldier filter selects on a day, present or absent, who leaves and
// who returns, overall and per unit in the tree's order, for one day or a span. Pure; the hook feeds it.

/** One soldier in a report's lists. */
export interface ReportEntry {
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** Absent only: the types of the leaves that make the soldier absent. NULL where the viewer may not read the type. */
  readonly absences: readonly (LeaveType | null)[]
  /** Absent only: the reason texts of those leaves, where there is one (D-194). */
  readonly reasons: readonly string[]
  readonly leaving: boolean
  readonly returning: boolean
}

export interface ReportCounts {
  /** The population: the report has no planned strength (D-193). */
  readonly total: number
  readonly present: number
  readonly absent: number
  readonly leaving: number
  readonly returning: number
}

export interface ReportLists {
  readonly counts: ReportCounts
  readonly present: readonly ReportEntry[]
  /** Every absent soldier; leaving and returning are part of them. */
  readonly absent: readonly ReportEntry[]
  readonly leaving: readonly ReportEntry[]
  readonly returning: readonly ReportEntry[]
}

/** One unit of a day, or one of the states of D-106 for those with no visible unit. */
export interface ReportSection extends ReportLists {
  readonly key: string
  /** The section's unit; NULL for the states with no visible unit. */
  readonly unitId: UnitId | null
  readonly label: BoardGroupLabel
}

export interface ReportDay extends ReportLists {
  readonly date: CalendarDate
  /** The scope's rotations that run on the day (D-211). */
  readonly rotations: readonly Deployment[]
  readonly units: readonly ReportSection[]
}

export interface DayReport {
  readonly days: readonly ReportDay[]
  /** Whether a reason or a readable type stands beside an absent soldier: the switch shows only then (D-194). */
  readonly hasReasons: boolean
}

export interface DayReportInput {
  readonly source: FilterSource
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  /** The approved and pending leaves the viewer reads that cover the days, the day before and the day after. */
  readonly leaves: readonly Leave[]
  /** Archived ones too, so a leave keeps its type (D-113). */
  readonly types: readonly LeaveType[]
  readonly days: readonly CalendarDate[]
  /** The selected unit, whose name starts no path below it. */
  readonly scopeUnitId: UnitId | null
  /** The scope's live rotations (D-211). */
  readonly rotations: readonly Deployment[]
  /** Whether the viewer may read the soldier's leaves; the others are left out (D-161). */
  readonly readsLeavesOf: (soldier: Soldier) => boolean
  /** Whether the viewer reads the soldier's placements: true, false, or NULL while unknown (D-122). */
  readonly readsPlacements: (soldierId: SoldierId) => boolean | null
}

const EVERYONE: FilterExpression = {}

/** Whether a rotation runs on `day`; one with no end runs from its start on. */
export function runsOn(rotation: Pick<Deployment, 'start_date' | 'end_date'>, day: CalendarDate): boolean {
  return compareDates(rotation.start_date, day) <= 0 && (rotation.end_date === null || compareDates(day, rotation.end_date) <= 0)
}

/** A day is reportable when one of the scope's rotations runs on it (D-193); routine has no report (D-222). */
export function isReportable(rotations: readonly Pick<Deployment, 'start_date' | 'end_date'>[], day: CalendarDate): boolean {
  return rotations.some((rotation) => runsOn(rotation, day))
}

/**
 * The next reportable day from `day` in the direction of `step`, skipping the days no rotation runs on; NULL past the
 * last rotation's end, before the first one's start, or with no rotation at all.
 */
export function steppedReportDay(
  rotations: readonly Pick<Deployment, 'start_date' | 'end_date'>[],
  day: CalendarDate,
  step: -1 | 1,
): CalendarDate | null {
  if (rotations.length === 0) return null
  const first = rotations.reduce((least, rotation) => (compareDates(rotation.start_date, least) < 0 ? rotation.start_date : least), rotations[0]?.start_date ?? day)
  const open = rotations.some((rotation) => rotation.end_date === null)
  const last = rotations.reduce<CalendarDate>(
    (most, rotation) => (rotation.end_date !== null && compareDates(rotation.end_date, most) > 0 ? rotation.end_date : most),
    first,
  )
  for (let candidate = addDays(day, step); ; candidate = addDays(candidate, step)) {
    if (step < 0 && compareDates(candidate, first) < 0) return null
    if (step > 0 && !open && compareDates(candidate, last) > 0) return null
    if (isReportable(rotations, candidate)) return candidate
  }
}

/**
 * The days of a report from `day` to `until`, the last day, at most `DAY_REPORT.maxSpanDays`, the reportable ones only
 * (D-193). Without `until`, or with one before `day`, the day alone.
 */
export function reportDays(
  rotations: readonly Pick<Deployment, 'start_date' | 'end_date'>[],
  day: CalendarDate,
  until: CalendarDate | null,
): CalendarDate[] {
  const days: CalendarDate[] = []
  const last = until === null || compareDates(until, day) < 0 ? day : until
  for (let index = 0, current = day; index < DAY_REPORT.maxSpanDays && compareDates(current, last) <= 0; index += 1) {
    if (isReportable(rotations, current)) days.push(current)
    current = addDays(current, 1)
  }
  return days
}

function countsOf(present: readonly ReportEntry[], absent: readonly ReportEntry[]): ReportCounts {
  return {
    total: present.length + absent.length,
    present: present.length,
    absent: absent.length,
    leaving: absent.filter((entry) => entry.leaving).length,
    returning: absent.filter((entry) => entry.returning).length,
  }
}

function listsOf(entries: readonly ReportEntry[], isAbsent: (entry: ReportEntry) => boolean): ReportLists {
  const sorted = entries.toSorted((a, b) => byName(a.soldier, b.soldier))
  const present = sorted.filter((entry) => !isAbsent(entry))
  const absent = sorted.filter(isAbsent)
  return {
    counts: countsOf(present, absent),
    present,
    absent,
    leaving: absent.filter((entry) => entry.leaving),
    returning: absent.filter((entry) => entry.returning),
  }
}

export function dayReport(input: DayReportInput): DayReport {
  const { source, types, leaves } = input
  const context = filterContextOf(source)
  const inPopulation = populationOf(input.filter)
  const expression = input.filter ?? EVERYONE
  const rankById = new Map<CommandRankId, CommandRank>(source.ranks.map((rank) => [rank.id, rank]))
  const typeById = new Map<LeaveTypeId, LeaveType>(types.map((type) => [type.id, type]))
  const leaveById = new Map<LeaveId, Leave>(leaves.map((leave) => [leave.id, leave]))
  // The tree holds archived units too, so a soldier in an archived sub-unit keeps its heading (D-147).
  const unitById = new Map<UnitId, Unit>(source.unitTree.map((unit) => [unit.id, unit]))
  const bySoldier = membershipsBySoldier(source.memberships)
  const order: string[] = [...unitTreeRows(source.unitTree).map((row) => row.unit.id), ...STATE_GROUPS]
  const availability = createAvailabilityContext({ leaves, leave_types: types })
  const readable = source.soldiers.filter((soldier) => inPopulation(soldier) && input.readsLeavesOf(soldier))
  let hasReasons = false

  const entryOf = (soldier: Soldier, movement: SoldierMovement): ReportEntry => {
    const counted = movement.day.leaves.filter((leave) => leave.counted).map((leave) => leaveById.get(leave.leave_id))
    const absences = counted.map((leave) => (leave === undefined ? null : (typeById.get(leave.leave_type_id) ?? null)))
    const reasons = counted.flatMap((leave) => (leave?.reason ? [leave.reason] : []))
    if (reasons.length > 0 || absences.some((type) => type !== null)) hasReasons = true
    return {
      soldier,
      rank: soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null),
      absences,
      reasons,
      leaving: movement.leaving,
      returning: movement.returning,
    }
  }

  const days = input.days.map((date): ReportDay => {
    const soldiers = readable.filter((soldier) => context.matches(expression, soldier.id, date))
    const byId = new Map(soldiers.map((soldier) => [soldier.id, soldier]))
    const lists = dayMovements(availability, soldiers.map((soldier) => soldier.id), date, APPROVED_ONLY)
    const absentIds = new Set(lists.absent.map((movement) => movement.day.soldier_id))
    const entries = [...lists.present, ...lists.absent].flatMap((movement) => {
      const soldier = byId.get(movement.day.soldier_id)
      return soldier === undefined ? [] : [entryOf(soldier, movement)]
    })
    const isAbsent = (entry: ReportEntry) => absentIds.has(entry.soldier.id)

    const groups = new Map<string, { unitId: UnitId | null; label: BoardGroupLabel; entries: ReportEntry[] }>()
    for (const entry of entries) {
      const own = bySoldier.get(entry.soldier.id) ?? []
      const reads = input.readsPlacements(entry.soldier.id)
      const state = unitStateOn(own, unitById, entry.soldier.id, date, reads === true)
      const key = groupKeyOf(state)
      const label: BoardGroupLabel =
        state.kind === 'unit' ? { kind: 'unit', path: unitPathOf(state.unit.id, unitById, input.scopeUnitId) } : { kind: state.kind }
      const group = groups.get(key) ?? { unitId: state.kind === 'unit' ? state.unit.id : null, label, entries: [] }
      group.entries.push(entry)
      groups.set(key, group)
    }
    const units = order.flatMap((key): ReportSection[] => {
      const group = groups.get(key)
      return group === undefined ? [] : [{ key, unitId: group.unitId, label: group.label, ...listsOf(group.entries, isAbsent) }]
    })
    return {
      date,
      rotations: input.rotations.filter((rotation) => runsOn(rotation, date)),
      units,
      ...listsOf(entries, isAbsent),
    }
  })
  return { days, hasReasons }
}
