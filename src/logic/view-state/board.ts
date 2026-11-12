import type { CalendarDate, LeaveTypeId } from '@contracts'
import { PANEL_IDS } from '@config'
import { addDays } from '@domain'
import { useCallback, useMemo } from 'react'
import { useToday } from '../session/today'
import { NO_LEAVE_CONDITIONS, hasLeaveConditions, type BoardLeaveStatus, type LeaveConditions } from './conditions'
import { NO_CONDITIONS, readFilter, writeFilter } from './filter'
import { useChangeSearch, useWorkspaceSearch } from './search'

// What the board shows beyond the soldier filter: its leave conditions (D-132), "only who is missing" (D-133)
// and the day of the presence lists (D-134). Each lives in the URL beside the filter.

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
  /** A condition of the filter row is on: a soldier condition beside the unit, or a leave condition (D-173). */
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
    hasLeaveConditions(leaves)
  const clearAll = useCallback(() => {
    // A filter the bar does not read has no unit it can keep (D-104).
    const unitId = read.kind === 'conditions' ? read.conditions.unitId : null
    change({ filter: writeFilter({ ...NO_CONDITIONS, unitId }), leaves: undefined })
  }, [read, change])
  return { active, clearAll }
}

/** "Only who is missing" (D-133). Off leaves the param out. */
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

export interface PresenceDayState {
  /** NULL until today is known. */
  readonly day: CalendarDate | null
  readonly today: CalendarDate | null
  shift(step: -1 | 1): void
  goToToday(): void
  /** Opens the presence panel on today, in one step of the history (D-134). */
  openToday(): void
}

/** The day of the presence lists (D-134): the URL's, else today. */
export function usePresenceDay(): PresenceDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const day = search.day ?? today
  const shift = useCallback(
    (step: -1 | 1) => {
      if (day !== null) change({ day: addDays(day, step) })
    },
    [change, day],
  )
  const goToToday = useCallback(() => {
    change({ day: undefined })
  }, [change])
  const openToday = useCallback(() => {
    change({ panel: PANEL_IDS.presence, entity: undefined, parent: undefined, day: undefined })
  }, [change])
  return { day, today, shift, goToToday, openToday }
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
