import { SHELL } from '@config'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

// What the pages and the floating bar of the shell share (D-455): the bar hides while a page scrolls down and returns
// when it scrolls up, a tray takes its place while something is selected, and a press on the tab in sight brings the
// page back to its top. The keyboard follows the screen: a page that opens takes it on its heading, and a page that
// closes hands it back to the control that opened it.

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
  /** The page was moved to an offset by the screen, not by the reader: the bar shows, and the next scroll counts from there. */
  readonly settle: (top: number) => void
  readonly cover: (on: boolean) => void
  readonly toTop: () => void
  /** The page's heading, or NULL when it leaves. */
  readonly bindHeading: (element: HTMLElement | null) => void
  /** Puts the keyboard on the page's heading: where it goes when what held it is gone. */
  readonly focusHeading: () => void
  /** Notes which control opened a page, so the keyboard returns to it when the page closes. */
  readonly rememberOpener: (key: string) => void
  /** Whether the control of this key is the one to return to; asking forgets it. */
  readonly takeOpener: (key: string) => boolean
}

const NONE: ShellChrome = {
  barHidden: false,
  covered: false,
  bindScroller: () => undefined,
  onScroll: () => undefined,
  showBar: () => undefined,
  settle: () => undefined,
  cover: () => undefined,
  toTop: () => undefined,
  bindHeading: () => undefined,
  focusHeading: () => undefined,
  rememberOpener: () => undefined,
  takeOpener: () => false,
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
  const settle = useCallback((top: number) => {
    anchor.current = top
    setBarHidden(false)
  }, [])
  const toTop = useCallback(() => {
    scroller.current?.scrollTo({ top: 0 })
    setBarHidden(false)
  }, [])
  const heading = useRef<HTMLElement | null>(null)
  const opener = useRef<string | null>(null)
  const bindHeading = useCallback((element: HTMLElement | null) => {
    heading.current = element
  }, [])
  const focusHeading = useCallback(() => {
    heading.current?.focus()
  }, [])
  const rememberOpener = useCallback((key: string) => {
    opener.current = key
  }, [])
  const takeOpener = useCallback((key: string) => {
    if (opener.current !== key) return false
    opener.current = null
    return true
  }, [])
  return useMemo(
    () => ({ barHidden, covered, bindScroller, onScroll, showBar, settle, cover: setCovered, toTop, bindHeading, focusHeading, rememberOpener, takeOpener }),
    [barHidden, covered, bindScroller, onScroll, showBar, settle, toTop, bindHeading, focusHeading, rememberOpener, takeOpener],
  )
}

/**
 * For the control that opens a page: `remember` before it opens, and the ref returns the keyboard to the control when
 * the page has closed and the control is on screen again.
 */
export function useOpener(key: string): { readonly remember: () => void; readonly ref: (element: HTMLElement | null) => void } {
  const { rememberOpener, takeOpener } = useShellChrome()
  return useMemo(
    () => ({
      remember: () => {
        rememberOpener(key)
      },
      ref: (element: HTMLElement | null) => {
        if (element !== null && takeOpener(key)) element.focus()
      },
    }),
    [key, rememberOpener, takeOpener],
  )
}

/**
 * For the screen a page closes back to: when the control that opened the page is no longer there to take the keyboard
 * (the card left with its last row), the screen's heading takes it, and the note is dropped.
 */
export function useOpenerFallback(key: string): void {
  const { takeOpener, focusHeading } = useShellChrome()
  useEffect(() => {
    if (takeOpener(key)) focusHeading()
  }, [key, takeOpener, focusHeading])
}
