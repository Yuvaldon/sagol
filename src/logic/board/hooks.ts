import type { CalendarDate, FilterExpression, SoldierId } from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext } from '@domain'
import { useMemo } from 'react'
import { useRotationScope } from '../view-state/rotation'
import { useFilterSource } from '../filters/source'
import type { Loaded } from '../queries/loaded'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { usePlacementHints } from '../roster/hooks'
import { hasLeaveConditions, leaveMatches, type LeaveConditions } from '../view-state/conditions'
import { filterUnitOf } from '../view-state/filter'
import { DEFAULT_SORT_RULES, type SortRule } from '../view-state/sort-rules'
import type { DateWindow } from '../view-state/window'
import { boardLeaves, type BoardLeave } from './leaves'
import { boardItems, type BoardItem } from './rows'

// What every engine shows for a window, a filter and the board's own conditions (D-105, D-132, D-133, D-174): one model,
// so the timeline, the list, the table and the calendar never disagree on who is in view (ARCHITECTURE "View engines").

export interface BoardModel {
  readonly days: readonly CalendarDate[]
  readonly today: CalendarDate
  readonly items: readonly BoardItem[]
  /** Each row's leaves in the window that meet the leave conditions (D-111, D-132). A soldier with none is absent. */
  readonly leaves: ReadonlyMap<SoldierId, readonly BoardLeave[]>
  /** Each row's approved leaves in the window, whatever the leave conditions draw: who is away (D-133, D-134). */
  readonly approved: ReadonlyMap<SoldierId, readonly BoardLeave[]>
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
  /** The sort rules of the rows, in order (D-313). */
  readonly sorts: readonly SortRule[]
}

const NO_BOARD_CONDITIONS: BoardConditions = {
  leaves: {},
  onlyMissing: false,
  sorts: DEFAULT_SORT_RULES,
}

export function useBoard(
  window: DateWindow,
  today: CalendarDate,
  filter: FilterExpression | null,
  board: BoardConditions = NO_BOARD_CONDITIONS,
): Loaded<BoardModel> {
  const source = useFilterSource(useRotationScope().rotation?.id ?? null)
  const leaves = useLeaves(window)
  const leaveTypes = useLeaveTypes()
  const placements = usePlacementHints(source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS)
  const { onlyMissing } = board
  const { sorts } = board
  const leaveConditions = board.leaves

  return useMemo((): Loaded<BoardModel> => {
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (leaveTypes.status !== 'ready') return leaveTypes
    // What a row says about its unit waits for the hints (D-122).
    if (!placements.settled) return { status: 'loading' }
    const unit = filterUnitOf(filter)
    const drawn = boardLeaves(
      leaves.value.filter((leave) => leaveMatches(leaveConditions, leave)),
      leaveTypes.value,
    )
    // Availability counts every leave, whatever the leave conditions draw (D-133).
    const approved = boardLeaves(
      leaves.value.filter((leave) => leave.status === 'approved'),
      leaveTypes.value,
    )
    const countsAway = sorts.some((rule) => 'key' in rule && rule.key === 'absent')
    const availability =
      onlyMissing || countsAway ? createAvailabilityContext({ leaves: leaves.value, leave_types: leaveTypes.value }) : null
    const awayDays = (soldierId: SoldierId) =>
      window.days.map((day) => availability?.isAvailable(soldierId, day, APPROVED_ONLY) === false)
    const items = boardItems({
      ...source.value,
      days: window.days,
      today,
      filter,
      scopeUnitId: unit.kind === 'unit' ? unit.unitId : null,
      readsPlacements: placements.readsOrPending,
      marked: hasLeaveConditions(leaveConditions) ? (soldierId) => drawn.has(soldierId) : null,
      absent: onlyMissing ? awayDays : null,
      sorts,
      daysAway: countsAway ? (soldierId) => awayDays(soldierId).filter(Boolean).length : null,
    })
    const soldierCount = items.filter((item) => item.kind === 'soldier').length
    const rosterCount = source.value.soldiers.length
    return { status: 'ready', value: { days: window.days, today, items, leaves: drawn, approved, soldierCount, rosterCount } }
  }, [source, leaves, leaveTypes, window, today, filter, leaveConditions, onlyMissing, sorts, placements])
}

const NO_SOLDIERS: readonly never[] = []
