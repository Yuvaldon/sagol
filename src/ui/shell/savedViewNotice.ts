import type { SavedViewId, SavedViewQuery } from '@contracts'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// A saved view opened from the sheet with a part that no longer reads says so (D-385). The sheet closes on the
// choice, so the notice shows over the workspace, as a preference failure does (D-187), until the soldier updates
// the view or dismisses it.

export interface DroppedView {
  readonly id: SavedViewId
  /** The view's query without the parts that were left out, to save it so. */
  readonly cleaned: SavedViewQuery
}

export interface SavedViewNotice {
  readonly dropped: DroppedView | null
  readonly show: (dropped: DroppedView | null) => void
  readonly dismiss: () => void
}

function noop(_dropped?: DroppedView | null) {
  // Outside the workspace no saved view is offered.
}

export const SavedViewNoticeContext = createContext<SavedViewNotice>({ dropped: null, show: noop, dismiss: noop })

export function useSavedViewNotice(): SavedViewNotice {
  return useContext(SavedViewNoticeContext)
}

/** The workspace's notice, shared by the view sheet that opens a view and the notice that offers to update it. */
export function useSavedViewNoticeScope(): SavedViewNotice {
  const [dropped, setDropped] = useState<DroppedView | null>(null)
  const dismiss = useCallback(() => {
    setDropped(null)
  }, [])
  return useMemo(() => ({ dropped, show: setDropped, dismiss }), [dropped, dismiss])
}
