import { DEVICE_KEYS, FOCUS_MODE } from '@config'
import { useDeviceFlag } from '@logic'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'

// Focus mode (D-301): one control and one key hide both strips and the chips row; one restore button, the same key
// and Escape bring them back. Focus moves with the change, so the control pressed never vanishes under the keyboard.

type Target = 'control' | 'restore'

export interface FocusMode {
  /** Whether the strips are hidden. */
  readonly on: boolean
  readonly enter: () => void
  readonly leave: () => void
  /** Takes the view menu's trigger or the restore button as its ref; the change focuses the one it shows. */
  readonly bind: (target: Target) => (element: HTMLButtonElement | null) => void
}

function noop() {
  // Outside the workspace there is nothing to hide.
}

const NONE: FocusMode = { on: false, enter: noop, leave: noop, bind: () => noop }

export const FocusModeContext = createContext<FocusMode>(NONE)

export function useFocusMode(): FocusMode {
  return useContext(FocusModeContext)
}

function isShortcut(event: KeyboardEvent): boolean {
  return (
    event.code === FOCUS_MODE.code &&
    event.altKey === FOCUS_MODE.altKey &&
    event.shiftKey === FOCUS_MODE.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey
  )
}

function inOverlay(event: KeyboardEvent): boolean {
  return (
    (event.target instanceof Element && event.target.closest(FOCUS_MODE.overlay) !== null) ||
    document.querySelector(FOCUS_MODE.overlay) !== null
  )
}

/** The workspace's focus mode: kept for the browser session (D-197), live only while the board shows (D-218). */
export function useFocusModeScope(boardShown: boolean): FocusMode {
  const flag = useDeviceFlag(DEVICE_KEYS.focusMode, 'session')
  const on = boardShown && flag.value
  const pending = useRef<Target | null>(null)
  const { set } = flag
  const enter = useCallback(() => {
    pending.current = 'restore'
    set(true)
  }, [set])
  const leave = useCallback(() => {
    pending.current = 'control'
    set(false)
  }, [set])
  const elements = useRef<Record<Target, HTMLButtonElement | null>>({ control: null, restore: null })
  const bind = useCallback(
    (target: Target) => (element: HTMLButtonElement | null) => {
      elements.current[target] = element
    },
    [],
  )
  // After the change, once a closing menu has handed focus back to its gone trigger: the next frame.
  useEffect(() => {
    const target = pending.current
    if (target === null) return
    const frame = requestAnimationFrame(() => {
      pending.current = null
      elements.current[target]?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [on])

  // The listener reads the mode as last committed, so a key pressed right after a change meets the new mode, not the
  // listener of the render before it.
  const current = useRef(on)
  useLayoutEffect(() => {
    current.current = on
  }, [on])
  useEffect(() => {
    if (!boardShown) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (isShortcut(event)) {
        event.preventDefault()
        if (current.current) leave()
        else enter()
      } else if (event.key === 'Escape' && current.current && !inOverlay(event)) {
        event.preventDefault()
        leave()
      }
    }
    // On the window, capturing: ahead of a tooltip's own Escape on the document, so one Escape leaves; a real overlay
    // still closes first, through `inOverlay`.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [boardShown, enter, leave])

  return useMemo(() => ({ on, enter, leave, bind }), [on, enter, leave, bind])
}
