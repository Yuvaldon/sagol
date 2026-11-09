import { DEFAULT_BAR_COLOR_MODE, type BarColorMode } from '@config'
import { useCallback } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// What a timeline bar's color means lives in the URL with the rest of the view (D-112). The default leaves the
// param out, so a plain link shows the type colors.

export interface BarColorsState {
  readonly mode: BarColorMode
  select(mode: BarColorMode): void
}

export function useBarColors(): BarColorsState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const select = useCallback(
    (mode: BarColorMode) => {
      change({ colors: mode === DEFAULT_BAR_COLOR_MODE ? undefined : mode })
    },
    [change],
  )
  return { mode: search.colors ?? DEFAULT_BAR_COLOR_MODE, select }
}
