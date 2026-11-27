import type { CalendarDate, FilterExpression, SoldierId, TagCategory } from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext, daysTally } from '@domain'
import { useCallback, useMemo } from 'react'
import { useRotationScope } from '../view-state/rotation'
import { useFilterSource } from '../filters/source'
import type { Loaded } from '../queries/loaded'
import { useLeaves, useLeaveTypes } from '../leaves/hooks'
import { useTagCategories, useTags } from '../tags/hooks'
import { useUnits } from '../units/hooks'
import { usePlacementHints } from '../roster/hooks'
import { hasLeaveConditions, leaveMatches, type LeaveConditions } from '../view-state/conditions'
import { filterUnitOf } from '../view-state/filter'
import { appliedGrouping, defaultGrouping, groupsByCategory, sameGrouping, type BoardGrouping } from '../view-state/grouping'
import { useChangeSearch, useWorkspaceSearch } from '../view-state/search'
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
  /** The sort rules of the rows, in order (D-313). */
  readonly sorts: readonly SortRule[]
  /** The URL's grouping (D-452); absent, the default for the board's scope. */
  readonly grouping?: BoardGrouping | undefined
}

const NO_BOARD_CONDITIONS: BoardConditions = {
  leaves: {},
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
  const tags = useTags()
  const categories = useTagCategories()
  const placements = usePlacementHints(source.status === 'ready' ? source.value.soldiers : NO_SOLDIERS)
  const { sorts } = board
  const leaveConditions = board.leaves
  const held = board.grouping

  return useMemo((): Loaded<BoardModel> => {
    if (source.status !== 'ready') return source
    if (leaves.status !== 'ready') return leaves
    if (leaveTypes.status !== 'ready') return leaveTypes
    if (tags.status !== 'ready') return tags
    if (categories.status !== 'ready') return categories
    // What a row says about its unit waits for the hints (D-122).
    if (!placements.settled) return { status: 'loading' }
    const unit = filterUnitOf(filter)
    const scopeUnitId = unit.kind === 'unit' ? unit.unitId : null
    const definitions = new Map(source.value.propertyDefinitions.map((definition) => [definition.id, definition]))
    const drawn = boardLeaves(
      leaves.value.filter((leave) => leaveMatches(leaveConditions, definitions, leave)),
      leaveTypes.value,
    )
    // Availability counts every leave, whatever the leave conditions draw (D-133).
    const approved = boardLeaves(
      leaves.value.filter((leave) => leave.status === 'approved'),
      leaveTypes.value,
    )
    const countsAway = sorts.some((rule) => 'key' in rule && rule.key === 'absent')
    const availability =
      countsAway ? createAvailabilityContext({ leaves: leaves.value, leave_types: leaveTypes.value }) : null
    const isAway = (soldierId: SoldierId) => (day: CalendarDate) =>
      availability?.isAvailable(soldierId, day, APPROVED_ONLY) === false
    const items = boardItems({
      ...source.value,
      days: window.days,
      today,
      filter,
      scopeUnitId,
      readsPlacements: placements.readsOrPending,
      marked: hasLeaveConditions(leaveConditions) ? (soldierId) => drawn.has(soldierId) : null,
      sorts,
      daysAway: countsAway ? (soldierId) => daysTally(window.days, everyDay, isAway(soldierId)).home : null,
      grouping: appliedGrouping(held, categories.value, defaultGrouping(source.value.units, scopeUnitId)),
      tags: tags.value,
      tagCategories: categories.value,
    })
    const soldierCount = items.filter((item) => item.kind === 'soldier').length
    const rosterCount = source.value.soldiers.length
    return { status: 'ready', value: { days: window.days, today, items, leaves: drawn, approved, soldierCount, rosterCount } }
  }, [source, leaves, leaveTypes, tags, categories, window, today, filter, leaveConditions, sorts, held, placements])
}

export interface BoardGroupingState {
  /** The grouping the board applies (D-452); NULL while what decides it loads. */
  readonly grouping: BoardGrouping | null
  /** The URL's grouping when the board cannot apply it: a category archived, no longer `single`, or unknown. */
  readonly unavailable: BoardGrouping | null
  /** The categories the rows can be grouped by: live, `single`, in their order. */
  readonly categories: readonly TagCategory[]
  set(next: BoardGrouping): void
}

/** The board's grouping (D-452): the URL's when it applies, else the default for the board's scope. */
export function useBoardGrouping(): BoardGroupingState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const units = useUnits()
  const categories = useTagCategories()
  const held = search.group
  const filter = search.filter ?? null
  const set = useCallback(
    (next: BoardGrouping) => {
      change({ group: next })
    },
    [change],
  )
  return useMemo((): BoardGroupingState => {
    if (units.status !== 'ready' || categories.status !== 'ready') return { grouping: null, unavailable: null, categories: [], set }
    const unit = filterUnitOf(filter)
    const fallback = defaultGrouping(units.value, unit.kind === 'unit' ? unit.unitId : null)
    const grouping = appliedGrouping(held, categories.value, fallback)
    return {
      grouping,
      unavailable: held !== undefined && !sameGrouping(held, grouping) ? held : null,
      categories: categories.value.filter(groupsByCategory).sort((a, b) => a.sort_order - b.sort_order),
      set,
    }
  }, [units, categories, held, filter, set])
}

const NO_SOLDIERS: readonly never[] = []
// The board counts every day of its window: a row is a soldier in view, whatever they serve (D-349).
const everyDay = () => true
