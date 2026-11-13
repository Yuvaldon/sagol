import { OVERLAY_HISTORY_KEY } from '@config'
import type { HistoryLocation, RouterHistory } from '@tanstack/react-router'

// An open overlay's history entry is marked in its state, so the back button can close it (D-332).

declare module '@tanstack/history' {
  interface HistoryState {
    readonly [OVERLAY_HISTORY_KEY]?: true
  }
}

/** The state an overlay's entry carries. */
export function overlayState(): { readonly [OVERLAY_HISTORY_KEY]: true } {
  return { [OVERLAY_HISTORY_KEY]: true }
}

/** Whether this entry is an open overlay's. */
export function isOverlayEntry(location: HistoryLocation): boolean {
  return location.state[OVERLAY_HISTORY_KEY] === true
}

/** The position of an entry in the history, which a replace keeps (unlike its key). */
export function entryIndex(location: HistoryLocation): number | undefined {
  return location.state.__TSR_index
}

// An overlay entry the app has already asked the history to leave, until the history answers: a second close in
// that time (a double tap, a button and its dialog's change) must not leave the entry below it too. A close that asks
// for more (the panel under a closing dialog, closed before the dialog's entry is gone) leaves the rest once the
// history answers, so it is not lost (D-337).
interface Leaving {
  readonly index: number
  readonly steps: number
  wanted: number
}

const leaving = new WeakMap<RouterHistory, Leaving>()

/**
 * Leaves the current overlay entry, and `steps - 1` entries under it that belong to overlays above the screen
 * (D-337), once however often it is asked before the history answers.
 */
export function leaveOverlayEntry(history: RouterHistory, steps = 1): void {
  const index = entryIndex(history.location)
  if (index === undefined) return
  const pending = leaving.get(history)
  if (pending?.index === index) {
    pending.wanted = Math.max(pending.wanted, steps)
    return
  }
  const leave: Leaving = { index, steps, wanted: steps }
  leaving.set(history, leave)
  const stop = history.subscribe(({ action }) => {
    if (action.type !== 'BACK' && action.type !== 'GO') return
    stop()
    if (leaving.get(history) === leave) leaving.delete(history)
    const rest = leave.wanted - leave.steps
    if (rest > 0 && entryIndex(history.location) === index - leave.steps) leaveOverlayEntry(history, rest)
  })
  if (steps === 1) history.back()
  else history.go(-steps)
}

/** Whether the app has asked the history to leave the current entry and is waiting for it. */
export function isLeavingEntry(history: RouterHistory): boolean {
  const index = entryIndex(history.location)
  return index !== undefined && leaving.get(history)?.index === index
}
