import { useDateWindow, useRotationScope } from '@logic'

/**
 * Whether the board shows, and with it the controls that act on it: the dates, the view, the filters (D-173). With no
 * rotation running or to come the viewport holds the empty state instead, and those controls do not exist (D-218).
 */
export function useBoardShown(): boolean {
  const { window } = useDateWindow()
  const scope = useRotationScope()
  return window !== null && !(scope.ready && scope.none)
}
