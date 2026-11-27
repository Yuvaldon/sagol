import { DATE_WINDOW, WEEK_SPANS, type ViewId } from '@config'
import type { CalendarDate } from '@contracts'
import { addDays, addMonths, compareDates, daysBetween, startOfMonth } from '@domain'
import { useCallback, useMemo } from 'react'
import { useToday } from '../session/today'
import { useChangeSearch, useWorkspaceSearch, type WorkspaceSearch } from './search'
import { FIRST_MOVEMENTS, boardWindowOf, shiftedWindow, useDateWindow, type DateWindow } from './window'

// The board's one selected day (the handoff's board spec, §2; D-480): every view shows it and keeps it when another view
// is chosen. It lives in the URL's `day`, the same day the day report and the rules panel read (D-134, D-141); absent,
// it is today. Choosing a day lets the window follow it, unless the window is a rotation or a free range, which hold
// their own days.

/** The search change that selects a day: today leaves `day` out, so the address follows the clock. */
export function selectedDayChange(current: WorkspaceSearch, day: CalendarDate, today: CalendarDate | null): Partial<WorkspaceSearch> {
  const next = day === today ? undefined : day
  const free = current.range === undefined && current.from !== undefined && current.to !== undefined
  if (current.range === 'rotation' || free) return { day: next }
  return { day: next, from: undefined, to: undefined }
}

/** The day `step` windows away for the kinds that follow the selected day (D-211, D-383). */
export function steppedDay(day: CalendarDate, kind: DateWindow['kind'], step: -1 | 1): CalendarDate | null {
  switch (kind) {
    case 'day':
      return addDays(day, step)
    case 'week':
    case 'two_weeks':
    case 'four_weeks':
      return addDays(day, WEEK_SPANS[kind] * DATE_WINDOW.days * step)
    case 'month':
      return addMonths(day, step)
    case 'rotation':
    case 'custom':
      return null
  }
}

/** The day a step of the calendar lands on: today in today's month, else the month's first day. */
export function steppedMonthDay(day: CalendarDate, step: -1 | 1, today: CalendarDate | null): CalendarDate {
  const first = addMonths(startOfMonth(day), step)
  return today !== null && startOfMonth(today) === first ? today : first
}

export interface BoardDayState {
  /** The selected day: the URL's, else today. NULL until today is known. */
  readonly day: CalendarDate | null
  readonly today: CalendarDate | null
  select(day: CalendarDate): void
}

export function useBoardDay(): BoardDayState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const select = useCallback(
    (day: CalendarDate) => {
      change((current) => selectedDayChange(current, day, today))
    },
    [change, today],
  )
  return { day: search.day ?? today, today, select }
}

export interface BoardWindowState {
  /** NULL until today is known, or while the rotations a window waits for load. */
  readonly window: DateWindow | null
  /** Whether a step back (-1) or forward (1) leads anywhere. */
  canStep(step: -1 | 1): boolean
  /** The previous or next month, week or range of the view; the selected day moves with it. */
  step(step: -1 | 1): void
}

/**
 * The window of a view (D-480): `phone` for the device's own default range, and `reach` for how far the movements read
 * around their anchor.
 */
export function useBoardWindow(
  view: ViewId,
  phone: boolean,
  reach: { readonly before: number; readonly after: number } = FIRST_MOVEMENTS,
): BoardWindowState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const dates = useDateWindow()
  const { today, rotations } = dates
  const { from, to, range, rotation, day } = search
  // The timeline and the table wait as the URL's window does: for the rotations a rotation window is made of.
  const bare = range === undefined && from === undefined && to === undefined
  const waits = (view === 'timeline' || view === 'table') && !(phone && bare) && dates.window === null
  const window = useMemo(
    () => (today === null || waits ? null : boardWindowOf(view, { from, to, range, rotation, day }, today, rotations, phone, reach)),
    [view, from, to, range, rotation, day, today, rotations, waits, phone, reach],
  )
  const selected = day ?? today
  const canStep = useCallback(
    (direction: -1 | 1) => {
      if (window === null) return false
      if (view === 'calendar' || view === 'list') return true
      return window.kind === 'rotation' ? dates.canShift(direction) : true
    },
    [window, view, dates],
  )
  const step = useCallback(
    (direction: -1 | 1) => {
      if (window === null || selected === null) return
      if (view === 'calendar') {
        change((current) => selectedDayChange(current, steppedMonthDay(selected, direction, today), today))
        return
      }
      const next = steppedDay(selected, window.kind, direction)
      if (next !== null) {
        change((current) => selectedDayChange(current, next, today))
        return
      }
      if (window.kind === 'rotation') {
        dates.shift(direction)
        return
      }
      // A free range moves by its own length, and the selected day with it.
      const moved = shiftedWindow(window, direction)
      const length = daysBetween(window.from, moved.from)
      const shifted = addDays(selected, length)
      change({ ...moved, day: shifted === today ? undefined : shifted })
    },
    [window, selected, view, change, today, dates],
  )
  return { window, canStep, step }
}

/** Whether a day is in a window. */
export function windowHolds(window: Pick<DateWindow, 'from' | 'to'>, day: CalendarDate): boolean {
  return compareDates(window.from, day) <= 0 && compareDates(day, window.to) <= 0
}
