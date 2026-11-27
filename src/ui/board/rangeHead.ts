import type { ViewId } from '@config'
import { useBoardDay, useBoardWindow, useDateWindow, windowHolds, type BoardWindowState } from '@logic'
import { useMemo } from 'react'
import { formatDateRange } from '../patterns/dates'
import { NEXT_LABELS, PREVIOUS_LABELS } from '../shell/windowLabels'
import type { BoardHeadProps } from './BoardScreen'

// The head of a view with a range (the timeline, the table): titled by the selected day's month, or the range's first
// when the day is outside it; its arrows step the range, and "היום" shows once today or the range has moved (D-480).

export function useRangeHead(view: ViewId, phone: boolean): { readonly head: BoardHeadProps; readonly board: BoardWindowState } {
  const board = useBoardWindow(view, phone)
  const { day, today } = useBoardDay()
  const { goToToday } = useDateWindow()
  const { window } = board
  const head = useMemo((): BoardHeadProps => {
    const month = window === null ? day : day !== null && windowHolds(window, day) ? day : window.from
    return {
      month,
      focusTitle: window === null ? undefined : formatDateRange(window.from, window.to),
      steps:
        window === null
          ? null
          : { previousKey: PREVIOUS_LABELS[window.kind], nextKey: NEXT_LABELS[window.kind], canStep: board.canStep, step: board.step },
      away: window !== null && today !== null && (day !== today || !windowHolds(window, today)),
      onToday: goToToday,
    }
  }, [window, day, today, board.canStep, board.step, goToToday])
  return { head, board }
}
