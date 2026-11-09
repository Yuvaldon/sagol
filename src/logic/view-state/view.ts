import { DEFAULT_VIEW_ID, type ViewId } from '@config'
import { useCallback } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The active view (D-023). `ui` holds the registry of engines, so it passes the ids that exist, and a
// view that does not exist falls back to the default (D-076).

export interface ActiveViewState {
  readonly view: ViewId
  select(view: ViewId): void
}

export function useActiveView(available: readonly ViewId[]): ActiveViewState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const wanted = search.view ?? DEFAULT_VIEW_ID
  const view = available.includes(wanted) ? wanted : DEFAULT_VIEW_ID
  const select = useCallback(
    (next: ViewId) => {
      change({ view: next === DEFAULT_VIEW_ID ? undefined : next })
    },
    [change],
  )
  return { view, select }
}
