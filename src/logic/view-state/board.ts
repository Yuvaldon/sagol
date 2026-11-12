import type { CalendarDate, Deployment, LeaveTypeId } from '@contracts'
import {
  BoardSortKey,
  DEFAULT_BOARD_SORT_KEY,
  DEFAULT_SORT_ORDER,
  PANEL_IDS,
  type SortKey,
  type SortOrder,
} from '@config'
import { addDays, compareDates, daysBetween } from '@domain'
import { isReportable, reportDays, steppedReportDay } from '../presence/report'
import { useCallback, useMemo } from 'react'
import { useToday } from '../session/today'
import { NO_LEAVE_CONDITIONS, hasLeaveConditions, type BoardLeaveStatus, type LeaveConditions } from './conditions'
import { NO_CONDITIONS, readFilter, writeFilter } from './filter'
import { useChangeSearch, useWorkspaceSearch } from './search'
import { useDateWindow } from './window'

// What the board shows beyond the soldier filter: its leave conditions (D-132), "only who is missing" (D-133)
// and the day of the report (D-134, D-193). Each lives in the URL beside the filter.

export interface LeaveConditionsState {
  readonly conditions: LeaveConditions
  setStatuses(statuses: readonly BoardLeaveStatus[]): void
  setTypes(typeIds: readonly LeaveTypeId[]): void
}

export function useLeaveConditions(): LeaveConditionsState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const conditions = search.leaves ?? NO_LEAVE_CONDITIONS
  const write = useCallback(
    (next: LeaveConditions) => {
      change({ leaves: hasLeaveConditions(next) ? next : undefined })
    },
    [change],
  )
  const setStatuses = useCallback(
    (statuses: readonly BoardLeaveStatus[]) => {
      write({ ...conditions, statuses: statuses.length === 0 ? undefined : [...statuses] })
    },
    [conditions, write],
  )
  const setTypes = useCallback(
    (typeIds: readonly LeaveTypeId[]) => {
      write({ ...conditions, type_ids: typeIds.length === 0 ? undefined : [...typeIds] })
    },
    [conditions, write],
  )
  return { conditions, setStatuses, setTypes }
}

export interface OnlyMissingState {
  readonly on: boolean
  set(on: boolean): void
}

export interface BoardFiltersState {
  /**
   * A condition of the filter row is on: a soldier condition beside the unit, a leave condition, or "only who is
   * missing" (D-173, D-213).
   */
  readonly active: boolean
  /** Removes every condition of the filter row; the unit stays, as it is the scope and not a condition (D-173). */
  clearAll(): void
}

export function useBoardFilters(): BoardFiltersState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const filter = search.filter ?? null
  const read = useMemo(() => readFilter(filter), [filter])
  const leaves = search.leaves ?? NO_LEAVE_CONDITIONS
  const active =
    read.kind === 'other' ||
    read.conditions.tagSets.length > 0 ||
    read.conditions.rankIds.length > 0 ||
    read.conditions.statuses.length > 0 ||
    read.conditions.properties.length > 0 ||
    hasLeaveConditions(leaves) ||
    search.missing === true
  const clearAll = useCallback(() => {
    // A filter the bar does not read has no unit it can keep (D-104).
    const unitId = read.kind === 'conditions' ? read.conditions.unitId : null
    change({ filter: writeFilter({ ...NO_CONDITIONS, unitId }), leaves: undefined, missing: undefined })
  }, [read, change])
  return { active, clearAll }
}

/** "Only who is missing" (D-133), a condition of the filter row (D-213). Off leaves the param out. */
export function useOnlyMissing(): OnlyMissingState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const set = useCallback(
    (on: boolean) => {
      change({ missing: on ? true : undefined })
    },
    [change],
  )
  return { on: search.missing === true, set }
}

export interface BoardSortState {
  /** The key and direction the URL holds; NULL when it names none (D-214). */
  readonly key: SortKey | null
  readonly order: SortOrder
  /** What the board's rows are ordered by: the URL's key when the board knows it, else the default. */
  readonly board: { readonly key: BoardSortKey; readonly order: SortOrder }
  /** Sorts by a key; with no direction, the key's own (D-214). The default order leaves both params out. */
  set(key: SortKey, order?: SortOrder): void
}

function defaultOrderOf(key: SortKey): SortOrder {
  const parsed = BoardSortKey.safeParse(key)
  return parsed.success ? DEFAULT_SORT_ORDER[parsed.data] : 'asc'
}

/** The order of the board's rows and the table's lines (D-214), in the URL. */
export function useBoardSort(): BoardSortState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const key = search.sort ?? null
  const order = search.order ?? (key === null ? DEFAULT_SORT_ORDER[DEFAULT_BOARD_SORT_KEY] : defaultOrderOf(key))
  const boardKey = BoardSortKey.safeParse(key)
  const board = useMemo(
    () =>
      boardKey.success
        ? { key: boardKey.data, order }
        : // A bare direction applies to the default key; a table-only key leaves the board in its default order.
          { key: DEFAULT_BOARD_SORT_KEY, order: key === null ? order : DEFAULT_SORT_ORDER[DEFAULT_BOARD_SORT_KEY] },
    [boardKey.success, boardKey.data, key, order],
  )
  const set = useCallback(
    (next: SortKey, nextOrder: SortOrder = defaultOrderOf(next)) => {
      const isDefault = next === DEFAULT_BOARD_SORT_KEY && nextOrder === DEFAULT_SORT_ORDER[DEFAULT_BOARD_SORT_KEY]
      change({
        sort: isDefault ? undefined : next,
        order: isDefault || nextOrder === defaultOrderOf(next) ? undefined : nextOrder,
      })
    },
    [change],
  )
  return { key, order, board, set }
}

export interface PresenceDayState {
  /** NULL until today is known. */
  readonly day: CalendarDate | null
  /** The last day of a span (D-193); NULL for one day. */
  readonly until: CalendarDate | null
  readonly today: CalendarDate | null
  /** The days the report shows: the day, or the span's reportable days (D-193). Empty while the day is unknown. */
  readonly days: readonly CalendarDate[]
  /** The scope's live rotations (D-211). */
  readonly rotations: readonly Deployment[]
  /** Whether the day is reportable: the scope has no rotation, or one runs on it (D-193). */
  readonly reportable: (day: CalendarDate) => boolean
  /** Whether a step back (-1) or forward (1) reaches a reportable day. */
  canShift(step: -1 | 1): boolean
  /** The previous or next reportable day; a span moves by its length. */
  shift(step: -1 | 1): void
  goToToday(): void
  /** The span's last day; NULL turns it back to one day. */
  setUntil(until: CalendarDate | null): void
  /** Opens the report on today, in one step of the history (D-134). */
  openToday(): void
  /** Opens the report on a day, in one step of the history (D-193). */
  openOn(day: CalendarDate): void
}

/** The day of the report (D-134, D-193): the URL's, else today; and the span's last day. */
export function usePresenceDay(): PresenceDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const { rotations } = useDateWindow()
  const day = search.day ?? today
  const until = day === null || search.until === undefined || compareDates(search.until, day) <= 0 ? null : search.until
  const days = useMemo(() => (day === null ? [] : reportDays(rotations, day, until)), [rotations, day, until])
  const reportable = useCallback((candidate: CalendarDate) => isReportable(rotations, candidate), [rotations])
  const target = useCallback(
    (step: -1 | 1) => (day === null ? null : steppedReportDay(rotations, day, step)),
    [rotations, day],
  )
  const canShift = useCallback((step: -1 | 1) => target(step) !== null, [target])
  const shift = useCallback(
    (step: -1 | 1) => {
      const next = target(step)
      if (day === null || next === null) return
      change({ day: next, until: until === null ? undefined : addDays(until, daysBetween(day, next)) })
    },
    [change, target, day, until],
  )
  const goToToday = useCallback(() => {
    change({ day: undefined, until: undefined })
  }, [change])
  const setUntil = useCallback(
    (next: CalendarDate | null) => {
      change({ until: next ?? undefined })
    },
    [change],
  )
  const openOn = useCallback(
    (next: CalendarDate) => {
      change({ panel: PANEL_IDS.presence, entity: undefined, parent: undefined, day: next, until: undefined })
    },
    [change],
  )
  const openToday = useCallback(() => {
    change({ panel: PANEL_IDS.presence, entity: undefined, parent: undefined, day: undefined, until: undefined })
  }, [change])
  return { day, until, today, days, rotations, reportable, canShift, shift, goToToday, setUntil, openToday, openOn }
}

export interface RulesDayState {
  /** The day whose broken rules the rules panel shows (D-141); NULL shows none. */
  readonly day: CalendarDate | null
  /** Opens the rules panel on a day of the heat row, in one step of the history. */
  openOn(day: CalendarDate): void
  /** Opens the rules panel without a day. */
  open(): void
}

/** The rules panel and its day (D-140, D-141): the same `day` param as the presence lists (D-134). */
export function useRulesDay(): RulesDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const openOn = useCallback(
    (day: CalendarDate) => {
      change({ panel: PANEL_IDS.rules, entity: undefined, parent: undefined, day })
    },
    [change],
  )
  const open = useCallback(() => {
    change({ panel: PANEL_IDS.rules, entity: undefined, parent: undefined, day: undefined })
  }, [change])
  return { day: search.day ?? null, openOn, open }
}
