import { SHELL } from '@config'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useShellChromeScope } from './chrome'

// The floating bar follows the page's scroll (D-455): away while it is read downward, back when it turns up.

describe('the bar and the page under it', () => {
  it('hides once the page has moved down far enough, and returns when it moves up as far', () => {
    const { result } = renderHook(() => useShellChromeScope())
    expect(result.current.barHidden).toBe(false)
    act(() => {
      result.current.onScroll(SHELL.barScrollPx - 1)
    })
    expect(result.current.barHidden).toBe(false)
    act(() => {
      result.current.onScroll(SHELL.barScrollPx * 3)
    })
    expect(result.current.barHidden).toBe(true)
    act(() => {
      result.current.onScroll(SHELL.barScrollPx * 3 - 1)
    })
    expect(result.current.barHidden).toBe(true)
    act(() => {
      result.current.onScroll(SHELL.barScrollPx * 2)
    })
    expect(result.current.barHidden).toBe(false)
  })

  it('always shows at the top of the page, and when the keyboard reaches it', () => {
    const { result } = renderHook(() => useShellChromeScope())
    act(() => {
      result.current.onScroll(SHELL.barScrollPx * 4)
    })
    expect(result.current.barHidden).toBe(true)
    act(() => {
      result.current.showBar()
    })
    expect(result.current.barHidden).toBe(false)
  })

  it('brings the page back to its top, with the bar', () => {
    const { result } = renderHook(() => useShellChromeScope())
    const scrollTo = vi.fn()
    act(() => {
      result.current.bindScroller({ scrollTo } as unknown as HTMLElement)
      result.current.onScroll(SHELL.barScrollPx * 4)
    })
    act(() => {
      result.current.toTop()
    })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(result.current.barHidden).toBe(false)
  })

  it('makes room for a tray, and takes it back', () => {
    const { result } = renderHook(() => useShellChromeScope())
    act(() => {
      result.current.cover(true)
    })
    expect(result.current.covered).toBe(true)
    act(() => {
      result.current.cover(false)
    })
    expect(result.current.covered).toBe(false)
  })
})
