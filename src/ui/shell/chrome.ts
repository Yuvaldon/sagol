import { SHELL } from '@config'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// What the pages and the floating bar of the shell share (D-455): the bar hides while a page scrolls down and returns
// when it scrolls up, a tray takes its place while something is selected, and a press on the tab in sight brings the
// page back to its top.

export interface ShellChrome {
  /** The bar is out of sight: the page is being read downward. */
  readonly barHidden: boolean
  /** A tray stands in the bar's place. */
  readonly covered: boolean
  /** The page's scrolling element, or NULL when it leaves. */
  readonly bindScroller: (element: HTMLElement | null) => void
  /** The page scrolled to an offset from its top. */
  readonly onScroll: (top: number) => void
  readonly showBar: () => void
  readonly cover: (on: boolean) => void
  readonly toTop: () => void
}

const NONE: ShellChrome = {
  barHidden: false,
  covered: false,
  bindScroller: () => undefined,
  onScroll: () => undefined,
  showBar: () => undefined,
  cover: () => undefined,
  toTop: () => undefined,
}

export const ShellChromeContext = createContext<ShellChrome>(NONE)

export function useShellChrome(): ShellChrome {
  return useContext(ShellChromeContext)
}

export function useShellChromeScope(): ShellChrome {
  const [barHidden, setBarHidden] = useState(false)
  const [covered, setCovered] = useState(false)
  const scroller = useRef<HTMLElement | null>(null)
  /** Where the page was when the bar last changed, or when it last turned around. */
  const anchor = useRef(0)
  const bindScroller = useCallback((element: HTMLElement | null) => {
    scroller.current = element
    anchor.current = 0
    setBarHidden(false)
  }, [])
  const onScroll = useCallback((top: number) => {
    const moved = top - anchor.current
    if (Math.abs(moved) < SHELL.barScrollPx) return
    anchor.current = top
    // At the very top the bar always shows, also after an overscroll bounce.
    setBarHidden(moved > 0 && top > SHELL.barScrollPx)
  }, [])
  const showBar = useCallback(() => {
    setBarHidden(false)
  }, [])
  const toTop = useCallback(() => {
    scroller.current?.scrollTo({ top: 0 })
    setBarHidden(false)
  }, [])
  return useMemo(
    () => ({ barHidden, covered, bindScroller, onScroll, showBar, cover: setCovered, toTop }),
    [barHidden, covered, bindScroller, onScroll, showBar, toTop],
  )
}
