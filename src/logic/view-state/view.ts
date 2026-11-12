import { DEFAULT_VIEW_BY_DEVICE, type ViewId } from '@config'
import { useCallback } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The active view (D-023). `ui` holds the registry of engines, so it passes the ids that exist, and a
// view that does not exist falls back to the default (D-076). `ui` knows the screen too, so it passes the device,
// whose view opens when the URL names none (D-290).

export type ViewDevice = keyof typeof DEFAULT_VIEW_BY_DEVICE

export interface ActiveViewState {
  readonly view: ViewId
  select(view: ViewId): void
}

/** The view a device opens on: its own, when the registry holds it, else the first one there is. */
export function defaultViewOf(device: ViewDevice, available: readonly ViewId[]): ViewId {
  const own = DEFAULT_VIEW_BY_DEVICE[device]
  return available.includes(own) ? own : (available[0] ?? DEFAULT_VIEW_BY_DEVICE.desktop)
}

export function useActiveView(available: readonly ViewId[], device: ViewDevice): ActiveViewState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const fallback = defaultViewOf(device, available)
  const wanted = search.view ?? fallback
  const view = available.includes(wanted) ? wanted : fallback
  const select = useCallback(
    (next: ViewId) => {
      change({ view: next === fallback ? undefined : next })
    },
    [change, fallback],
  )
  return { view, select }
}
