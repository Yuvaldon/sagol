import type { CalendarDate, LeaveTypeId } from '@contracts'
import { addDays } from '@domain'
import { useCallback } from 'react'
import { useToday } from '../session/today'
import { NO_LEAVE_CONDITIONS, hasLeaveConditions, type BoardLeaveStatus, type LeaveConditions } from './conditions'
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
  return { day, today, shift, goToToday }
}
