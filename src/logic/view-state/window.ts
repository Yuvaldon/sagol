import { DATE_WINDOW, FIRST_DAY_OF_WEEK } from '@config'
import type { CalendarDate } from '@contracts'
import { addDays, daysBetween, eachDay, startOfWeek } from '@domain'
import { useCallback, useMemo } from 'react'
import { useToday } from '../session/today'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The date window of the views (D-103). A link holds `from` and `to`; without them the window is the
// week that holds today, and it follows the clock. Pure parts first, then the hook.

export interface DateWindow {
  readonly from: CalendarDate
  readonly to: CalendarDate
  /** Every day of the window, in order. */
  readonly days: readonly CalendarDate[]
  /** True when the URL holds no window, so it moves with today. */
  readonly followsToday: boolean
  readonly holdsToday: boolean
}

interface WindowParams {
  readonly from?: CalendarDate | undefined
  readonly to?: CalendarDate | undefined
}

/** A pair from a link, or NULL when it is missing a side, inverted or too long. */
function linkedWindow({ from, to }: WindowParams): { from: CalendarDate; to: CalendarDate } | null {
  if (from === undefined || to === undefined) return null
  const span = daysBetween(from, to) + 1
  return span >= 1 && span <= DATE_WINDOW.maxDays ? { from, to } : null
}

export function dateWindowOf(params: WindowParams, today: CalendarDate): DateWindow {
  const linked = linkedWindow(params)
  const from = linked?.from ?? startOfWeek(today, FIRST_DAY_OF_WEEK)
  const to = linked?.to ?? addDays(from, DATE_WINDOW.days - 1)
  return {
    from,
    to,
    days: eachDay({ start_date: from, end_date: to }),
    followsToday: linked === null,
    holdsToday: daysBetween(from, today) >= 0 && daysBetween(today, to) >= 0,
  }
}

/** The window moved by its own length, back (-1) or forward (1). */
export function shiftedWindow(window: Pick<DateWindow, 'from' | 'to'>, step: -1 | 1): { from: CalendarDate; to: CalendarDate } {
  const length = (daysBetween(window.from, window.to) + 1) * step
  return { from: addDays(window.from, length), to: addDays(window.to, length) }
}

export interface DateWindowState {
  /** NULL until today is known: no organization yet, or no `organization:view`. */
  readonly window: DateWindow | null
  readonly today: CalendarDate | null
  shift(step: -1 | 1): void
  /** Back to the week that holds today, following the clock again. */
  goToToday(): void
}

export function useDateWindow(): DateWindowState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const { from, to } = search
  const window = useMemo(() => (today === null ? null : dateWindowOf({ from, to }, today)), [from, to, today])

  const shift = useCallback(
    (step: -1 | 1) => {
      if (window !== null) change(shiftedWindow(window, step))
    },
    [change, window],
  )
  const goToToday = useCallback(() => {
    change({ from: undefined, to: undefined })
  }, [change])

  return { window, today, shift, goToToday }
}
