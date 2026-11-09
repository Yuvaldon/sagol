import type { CalendarDate, FilterExpression, SoldierId } from '@contracts'
import { useMemo } from 'react'
import type { Loaded } from '../queries/loaded'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { useCommandRanks, useMemberships, usePlacementReading, useSoldiers } from '../roster/hooks'
import { useUnits } from '../units/hooks'
import { filterUnitOf } from '../view-state/filter'
import type { DateWindow } from '../view-state/window'
import { timelineLeaves, type TimelineLeave } from './leaves'
import { timelineItems, type TimelineItem } from './rows'

// What the timeline engine shows for a window and a filter (D-105). The viewport hands both to the engine,
// so every engine reads the same state (ARCHITECTURE "View engines").

export interface TimelineModel {
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  readonly items: readonly TimelineItem[]
  /** Each row's leaves in the window (D-111). A soldier with none is absent. */
  readonly leaves: ReadonlyMap<SoldierId, readonly TimelineLeave[]>
  /** How many soldiers the rows hold, headers aside. */
  readonly soldierCount: number
  /** How many live soldiers the actor sees at all, so an empty board can tell "nobody yet" from "nobody here". */
  readonly rosterCount: number
}

export function useTimeline(window: DateWindow, today: CalendarDate, filter: FilterExpression | null): Loaded<TimelineModel> {
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnits()
  const memberships = useMemberships()
  const leaves = useLeaves(window)
  const leaveTypes = useLeaveTypes()
  const readsPlacements = usePlacementReading(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)

  return useMemo((): Loaded<TimelineModel> => {
    if (soldiers.status !== 'ready') return soldiers
    if (ranks.status !== 'ready') return ranks
    if (units.status !== 'ready') return units
    if (memberships.status !== 'ready') return memberships
    if (leaves.status !== 'ready') return leaves
    if (leaveTypes.status !== 'ready') return leaveTypes
    const unit = filterUnitOf(filter)
    const items = timelineItems({
      soldiers: soldiers.value,
      ranks: ranks.value,
      units: units.value,
      memberships: memberships.value,
      days: window.days,
      today,
      filter,
      scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
      readsPlacements,
    })
    const soldierCount = items.filter((item) => item.kind === 'soldier').length
    const rosterCount = soldiers.value.length
    const drawn = timelineLeaves(leaves.value, leaveTypes.value)
    return { status: 'ready', value: { days: window.days, today, items, leaves: drawn, soldierCount, rosterCount } }
  }, [soldiers, ranks, units, memberships, leaves, leaveTypes, window, today, filter, readsPlacements])
}

const NO_SOLDIERS: readonly never[] = []
