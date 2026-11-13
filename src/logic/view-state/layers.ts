import type { AnyRouter, HistoryLocation, RouterHistory } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { entryIndex, isOverlayEntry, leaveOverlayEntry, overlayState } from './overlay'
import { WorkspaceSearch } from './search'

// A menu, a picker, a sheet or a dialog that lives inside a component holds one history entry while it is open, as
// the navigation panel does, so the back button closes it (D-335). Each open layer pushes its own entry on top of the
// one it opened over, so nested layers close innermost first, one back press each. A layer closed by its own controls
// takes its entry back; that is put off to the end of the turn, so a layer that opens as another closes (a menu item
// that opens a dialog) takes over the closing one's entry instead of going back and forth. A panel opened from a layer
// over the main screen takes the layer's entry (D-332). Leaving a layer's entry never changes what the screen shows:
// a change made on the layer's entry (a window chosen in a menu, a panel's row switched) is kept on the entry below.

interface Layer {
  /** The position of the layer's entry. */
  floor: number
  /** Whether a panel was open under the layer when it opened. */
  readonly overPanel: boolean
  readonly onBack: () => void
}

interface Layers {
  open: Layer[]
  pending: Layer[]
  /** The entries layers pushed, each with whether the entry under it is an overlay's. */
  readonly owned: Map<number, boolean>
  scheduled: boolean
}

const registry = new WeakMap<RouterHistory, Layers>()

function hasPanel(router: AnyRouter, location: HistoryLocation): boolean {
  return WorkspaceSearch.parse(router.parseLocation(location).search).panel !== undefined
}

function layersOf(router: AnyRouter): Layers {
  const history: RouterHistory = router.history
  const known = registry.get(history)
  if (known !== undefined) return known
  const layers: Layers = { open: [], pending: [], owned: new Map(), scheduled: false }
  registry.set(history, layers)
  let previous = history.location
  history.subscribe(({ location, action }) => {
    const left = previous
    previous = location
    const index = entryIndex(location)
    if (index === undefined) return
    if (action.type === 'PUSH') {
      for (const owned of [...layers.owned.keys()]) if (owned >= index) layers.owned.delete(owned)
      return
    }
    if (action.type !== 'BACK' && action.type !== 'GO') return
    const leftIndex = entryIndex(left)
    const leftLayer = leftIndex !== undefined && layers.owned.has(leftIndex)
    for (const owned of [...layers.owned.keys()]) if (owned > index) layers.owned.delete(owned)
    const closing = layers.open.filter((layer) => layer.floor > index).sort((a, b) => b.floor - a.floor)
    layers.open = layers.open.filter((layer) => layer.floor <= index)
    layers.pending = layers.pending.filter((layer) => layer.floor <= index)
    for (const layer of closing) layer.onBack()
    // The entry below an overlay's keeps what changed on the layer's entry; below that, `useOverlayHistory` does.
    const keeps = leftLayer && isOverlayEntry(location) && left.pathname === location.pathname && left.href !== location.href
    if (keeps) void router.navigate({ href: left.href, replace: true, state: true })
  })
  return layers
}

function settle(router: AnyRouter, layers: Layers): void {
  layers.scheduled = false
  const leaving = layers.pending
  layers.pending = []
  const history: RouterHistory = router.history
  const current = entryIndex(history.location)
  if (current === undefined) return
  const top = Math.max(-1, ...layers.open.map((layer) => layer.floor))
  const floors = leaving.map((layer) => layer.floor).filter((floor) => floor > top && floor <= current)
  if (floors.length === 0) return
  const low = Math.min(...floors)
  // An entry in the way that no layer holds (another overlay took it) stays, with everything under it.
  for (let index = low; index <= current; index += 1) if (!layers.owned.has(index)) return
  const lowest = leaving.find((layer) => layer.floor === low)
  const handsToPanel = lowest !== undefined && !lowest.overPanel && hasPanel(router, history.location)
  if (handsToPanel) layers.owned.delete(low)
  const steps = current - low + (handsToPanel ? 0 : 1)
  if (steps > 0) leaveOverlayEntry(history, steps)
}

function openLayer(router: AnyRouter, onBack: () => void): Layer {
  const layers = layersOf(router)
  const history: RouterHistory = router.history
  const current = entryIndex(history.location)
  const closing = layers.pending.find((layer) => layer.floor === current && layers.owned.has(layer.floor))
  if (closing !== undefined) {
    layers.pending = layers.pending.filter((layer) => layer !== closing)
    const layer: Layer = { floor: closing.floor, overPanel: closing.overPanel, onBack }
    layers.open.push(layer)
    return layer
  }
  const under = history.location
  const overPanel = hasPanel(router, under)
  history.push(under.href, overlayState())
  const floor = entryIndex(history.location) ?? 0
  layers.owned.set(floor, isOverlayEntry(under))
  const layer: Layer = { floor, overPanel, onBack }
  layers.open.push(layer)
  return layer
}

function closeLayer(router: AnyRouter, layer: Layer): void {
  const layers = layersOf(router)
  if (!layers.open.includes(layer)) return
  layers.open = layers.open.filter((one) => one !== layer)
  layers.pending.push(layer)
  if (layers.scheduled) return
  layers.scheduled = true
  queueMicrotask(() => {
    settle(router, layers)
  })
}

/**
 * The entries of the layers open over the current one, counted down from the top, and whether the entry under them
 * is an overlay's. A panel that closes leaves them with its own entry (D-335).
 */
export function layersAbove(history: RouterHistory): { readonly count: number; readonly overOverlay: boolean } {
  const layers = registry.get(history)
  let index = entryIndex(history.location)
  if (layers === undefined || index === undefined) return { count: 0, overOverlay: isOverlayEntry(history.location) }
  let count = 0
  let overOverlay = isOverlayEntry(history.location)
  while (layers.owned.has(index)) {
    overOverlay = layers.owned.get(index) === true
    count += 1
    index -= 1
  }
  return { count, overOverlay }
}

/** Takes a layer's entry for another overlay, such as the navigation panel opened from a layer: the entry stays. */
export function takeLayerEntry(history: RouterHistory, index: number): void {
  registry.get(history)?.owned.delete(index)
}

/**
 * Holds a history entry while a local overlay is open, so the back button closes it (D-335). `onBack` closes the
 * overlay; closing it any other way takes the entry back.
 */
export function useOverlayLayer(isOpen: boolean, onBack: () => void): void {
  const router = useRouter()
  const back = useRef(onBack)
  useEffect(() => {
    back.current = onBack
  }, [onBack])
  useEffect(() => {
    if (!isOpen) return
    const layer = openLayer(router, () => {
      back.current()
    })
    return () => {
      closeLayer(router, layer)
    }
  }, [isOpen, router])
}
