import type { CalendarDate, FilterExpression, SoldierId } from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext } from '@domain'
import { useMemo } from 'react'
import { useFilterSource } from '../filters/source'
import type { Loaded } from '../queries/loaded'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { usePlacementHints } from '../roster/hooks'
import { hasLeaveConditions, leaveMatches, type LeaveConditions } from '../view-state/conditions'
import { filterUnitOf } from '../view-state/filter'
import type { DateWindow } from '../view-state/window'
import { timelineLeaves, type TimelineLeave } from './leaves'
import { timelineItems, type TimelineItem } from './rows'

// What the timeline engine shows for a window, a filter and the board's own conditions (D-105, D-132, D-133).
// The viewport hands them to the engine, so every engine reads the same state (ARCHITECTURE "View engines").

export interface TimelineModel {
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  readonly items: readonly TimelineItem[]
  /** Each row's leaves in the window that meet the leave conditions (D-111, D-132). A soldier with none is absent. */
  readonly leaves: ReadonlyMap<SoldierId, readonly TimelineLeave[]>
  /** How many soldiers the rows hold, headers aside. */
  readonly soldierCount: number
  /** How many live soldiers the actor sees at all, so an empty board can tell "nobody yet" from "nobody here". */
  readonly rosterCount: number
}

/** What the board shows beyond the soldier filter (D-132, D-133). */
export interface BoardConditions {
  readonly leaves: LeaveConditions
  /** "Only who is missing" (D-133). */
  readonly onlyMissing: boolean
}

const NO_BOARD_CONDITIONS: BoardConditions = { leaves: {}, onlyMissing: false }

export function useTimeline(
  window: DateWindow,
  today: CalendarDate,
  filter: FilterExpression | null,
  board: BoardConditions = NO_BOARD_CONDITIONS,
): Loaded<TimelineModel> {
  const source = useFilterSource()
  const leaves = useLeaves(window)
  const leaveTypes = useLeaveTypes()
  const placements = usePlacementHints(source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS)
  const { onlyMissing } = board
  const leaveConditions = board.leaves

  return useMemo((): Loaded<TimelineModel> => {
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (leaveTypes.status !== 'ready') return leaveTypes
    // What a row says about its unit waits for the hints (D-122).
    if (!placements.settled) return { status: 'loading' }
    const unit = filterUnitOf(filter)
    const drawn = timelineLeaves(
      leaves.value.filter((leave) => leaveMatches(leaveConditions, leave)),
      leaveTypes.value,
    )
    // Availability counts every leave, whatever the leave conditions draw (D-133).
    const availability = onlyMissing ? createAvailabilityContext({ leaves: leaves.value, leave_types: leaveTypes.value }) : null
    const items = timelineItems({
      soldiers: source.value.soldiers,
      ranks: source.value.ranks,
      units: source.value.units,
      memberships: source.value.memberships,
      soldierTags: source.value.soldierTags,
      days: window.days,
      today,
      filter,
      scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
      readsPlacements: placements.reads,
      marked: hasLeaveConditions(leaveConditions) ? (soldierId) => drawn.has(soldierId) : null,
      absent:
        availability === null
          ? null
          : (soldierId) => window.days.map((day) => !availability.isAvailable(soldierId, day, APPROVED_ONLY)),
    })
    const soldierCount = items.filter((item) => item.kind === 'soldier').length
    const rosterCount = source.value.soldiers.length
    return { status: 'ready', value: { days: window.days, today, items, leaves: drawn, soldierCount, rosterCount } }
  }, [source, leaves, leaveTypes, window, today, filter, leaveConditions, onlyMissing, placements])
}

const NO_SOLDIERS: readonly never[] = []
