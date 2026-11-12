import { useDateWindow } from '@logic'

/**
 * Whether the board shows, and with it the controls that act on it: the dates, the view, the filters (D-173). With no
 * window yet, they do not exist. Routine (no rotation) shows the board too, under its band (D-257, D-222).
 */
export function useBoardShown(): boolean {
  const { window } = useDateWindow()
  return window !== null
}
