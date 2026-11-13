import { ROUTES } from '@config'
import { useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { takeLayerEntry } from './layers'
import { entryIndex, isOverlayEntry, leaveOverlayEntry, overlayState } from './overlay'
import { WorkspaceSearch } from './search'

// The back button leaves the current state, it never replays the actions that led to it (D-332). Only an open overlay
// (a panel, a drawer, the navigation panel) adds a history entry, one, marked in its state; the back button consumes it
// by closing the overlay, and closing the overlay any other way takes the entry back with it. View, window, filter and
// sort changes replace the entry they happen on. Back from the main screen leaves the app.

/** The workspace search an entry holds, without what belongs to the open panel (D-143). */
function withoutPanel(search: WorkspaceSearch): WorkspaceSearch {
  return { ...search, panel: undefined, entity: undefined, parent: undefined, draft: undefined }
}

/**
 * Keeps what changed while an overlay was open once the back button leaves it: the view, the window and the filter
 * stay as they were in the overlay's entry, only the panel goes. Mounted once, by the workspace.
 */
export function useOverlayHistory(): void {
  const router = useRouter()
  useEffect(() => {
    let previous = router.history.location
    return router.history.subscribe(({ location, action }) => {
      const left = previous
      previous = location
      if (action.type !== 'BACK' && action.type !== 'GO') return
      if (!isOverlayEntry(left) || isOverlayEntry(location) || left.pathname !== location.pathname) return
      const kept = withoutPanel(WorkspaceSearch.parse(router.parseLocation(left).search))
      void router.navigate({ to: ROUTES.workspace, search: kept, replace: true })
    })
  }, [router])
}

export interface OverlayEntry {
  /** The overlay opened: it adds its entry, or takes the one a panel left it, unless it opens over an open panel. */
  readonly enter: () => void
  /** The overlay closed by its own controls: its entry goes. */
  readonly leave: () => void
  /**
   * The overlay closed to run what was chosen in it: a panel that opens takes its entry; anything else leaves it, so
   * no entry stays behind without an overlay.
   */
  readonly handOff: (run: () => void) => void
}

/** The history entry of an overlay that lives outside the URL, such as the navigation panel. */
export function useOverlayEntry(onBack: () => void): OverlayEntry {
  const router = useRouter()
  const back = useRef(onBack)
  const open = useRef(false)
  const own = useRef<number | undefined>(undefined)
  useEffect(() => {
    back.current = onBack
  }, [onBack])
  // The entry the overlay sits on: its own, or the open panel's it opened over. A back press that stays on it or above
  // it closes a menu or a dialog open over the overlay (D-337), not the overlay.
  const floor = useRef<number | undefined>(undefined)
  useEffect(
    () =>
      router.history.subscribe(({ location, action }) => {
        if (!open.current || (action.type !== 'BACK' && action.type !== 'GO')) return
        const index = entryIndex(location)
        if (index !== undefined && floor.current !== undefined && index >= floor.current) return
        open.current = false
        own.current = undefined
        floor.current = undefined
        back.current()
      }),
    [router],
  )
  const hasPanel = useCallback(
    () => WorkspaceSearch.parse(router.parseLocation(router.history.location).search).panel !== undefined,
    [router],
  )
  const enter = useCallback(() => {
    if (open.current) return
    open.current = true
    const { history } = router
    const shares = isOverlayEntry(history.location) && hasPanel()
    if (!isOverlayEntry(history.location)) history.push(history.location.href, overlayState())
    floor.current = entryIndex(history.location)
    if (shares) return
    own.current = floor.current
    if (own.current !== undefined) takeLayerEntry(history, own.current)
  }, [router, hasPanel])
  const leave = useCallback(() => {
    const { history } = router
    const ownIndex = own.current
    open.current = false
    own.current = undefined
    floor.current = undefined
    if (ownIndex !== undefined && entryIndex(history.location) === ownIndex) leaveOverlayEntry(history)
  }, [router])
  const handOff = useCallback(
    (run: () => void) => {
      const ownIndex = own.current
      open.current = false
      own.current = undefined
      floor.current = undefined
      run()
      const { history } = router
      if (ownIndex !== undefined && entryIndex(history.location) === ownIndex && !hasPanel()) leaveOverlayEntry(history)
    },
    [router, hasPanel],
  )
  return useMemo(() => ({ enter, leave, handOff }), [enter, leave, handOff])
}
