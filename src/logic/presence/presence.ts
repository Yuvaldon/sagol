import type {
  CalendarDate,
  CommandRank,
  CommandRankId,
  FilterExpression,
  Leave,
  LeaveId,
  LeaveType,
  LeaveTypeId,
  Soldier,
} from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext, partitionAvailability, type SoldierDay } from '@domain'
import { filterContextOf, populationOf, type FilterSource } from '../filters/source'
import { byName } from '../roster/roster'

// Present and absent lists of one day (D-134, OI-090): a partition of who the board's soldier filter selects that
// day, with the meaning of the commands (D-070) and approved leaves only (D-133). Pure; the hook feeds it.

/** One soldier on the day, once, in one of the two lists. */
export interface PresenceEntry {
  readonly soldier: Soldier
  readonly rank: CommandRank | null
  /** The types of the leaves that make the soldier absent. NULL where the actor may not read the type. */
  readonly absences: readonly (LeaveType | null)[]
  /** A pending leave would make the soldier absent if approved. */
  readonly pending: boolean
  /** Markers covering the day, as annotations (D-032). */
  readonly markers: readonly (LeaveType | null)[]
}

export interface PresenceLists {
  readonly day: CalendarDate
  readonly absent: readonly PresenceEntry[]
  readonly present: readonly PresenceEntry[]
}

export interface PresenceInput {
  readonly source: FilterSource
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  /** The pending and approved leaves the actor sees that cover the day, or more. */
  readonly leaves: readonly Leave[]
  /** Archived ones too, so a leave keeps its type (D-113). */
  readonly types: readonly LeaveType[]
  readonly day: CalendarDate
}

const EVERYONE: FilterExpression = {}

function entryOf(day: SoldierDay, soldier: Soldier, rank: CommandRank | null, typeOf: (leaveId: LeaveId) => LeaveType | null): PresenceEntry {
  return {
    soldier,
    rank,
    absences: day.leaves.filter((leave) => leave.counted).map((leave) => typeOf(leave.leave_id)),
    pending: day.leaves.some((leave) => leave.status === 'pending' && leave.effect === 'unavailable'),
    markers: day.leaves.filter((leave) => leave.effect === 'available').map((leave) => typeOf(leave.leave_id)),
  }
}

export function presenceLists({ source, filter, leaves, types, day }: PresenceInput): PresenceLists {
  const context = filterContextOf(source)
  const inPopulation = populationOf(filter)
  const expression = filter ?? EVERYONE
  const soldiers = source.soldiers
    .filter((soldier) => inPopulation(soldier) && context.matches(expression, soldier.id, day))
    .toSorted(byName)
  const byId = new Map(soldiers.map((soldier) => [soldier.id, soldier]))
  const rankById = new Map<CommandRankId, CommandRank>(source.ranks.map((rank) => [rank.id, rank]))
  const typeById = new Map<LeaveTypeId, LeaveType>(types.map((type) => [type.id, type]))
  const leaveById = new Map<LeaveId, Leave>(leaves.map((leave) => [leave.id, leave]))
  const typeOf = (leaveId: LeaveId) => {
    const leave = leaveById.get(leaveId)
    return leave === undefined ? null : (typeById.get(leave.leave_type_id) ?? null)
  }

  const availability = createAvailabilityContext({ leaves, leave_types: types })
  const partition = partitionAvailability(availability, soldiers.map((soldier) => soldier.id), day, APPROVED_ONLY)
  const entries = (days: readonly SoldierDay[]) =>
    days.flatMap((soldierDay) => {
      const soldier = byId.get(soldierDay.soldier_id)
      if (soldier === undefined) return []
      const rank = soldier.command_rank_id === null ? null : (rankById.get(soldier.command_rank_id) ?? null)
      return [entryOf(soldierDay, soldier, rank, typeOf)]
    })
  return { day, absent: entries(partition.unavailable), present: entries(partition.available) }
}
