import { BOARD } from '@config'
import { useCallback, useEffect, useRef, type PointerEvent } from 'react'

// The board's gestures (the handoff's `02`, "Gestures and motion"; D-458): a held finger and a swipe. Each has a tap
// path beside it, so neither is the only way to anything. Pointer events serve the finger, the pen and the mouse alike.

export interface LongPress {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onPointerMove: (event: PointerEvent) => void
  readonly onPointerUp: () => void
  readonly onPointerCancel: () => void
  /** Whether the press that just ended was held: its tap is then not a tap. Asking forgets it. */
  readonly consumed: () => boolean
}

/** Calls `onHold` once a pointer has rested `BOARD.holdMs` without wandering. */
export function useLongPress(onHold: (() => void) | null): LongPress {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }, [])
  useEffect(() => stop, [stop])
  return {
    onPointerDown: (event) => {
      held.current = false
      if (onHold === null || (event.pointerType === 'mouse' && event.button !== 0)) return
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = window.setTimeout(() => {
        held.current = true
        timer.current = null
        onHold()
      }, BOARD.holdMs)
    },
    onPointerMove: (event) => {
      const start = origin.current
      if (start === null) return
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > BOARD.holdTolerancePx) stop()
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    consumed: () => {
      const was = held.current
      held.current = false
      return was
    },
  }
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export interface Swipe {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onPointerUp: (event: PointerEvent) => void
  readonly onPointerCancel: () => void
  /** Whether the pointer that just lifted swiped: its tap is then not a tap. Asking forgets it. */
  readonly consumed: () => boolean
}

/** Calls `onSwipe` when a pointer lifts `BOARD.swipePx` or more from where it went down, mostly along one axis. */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void): Swipe {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  return {
    onPointerDown: (event) => {
      swiped.current = false
      origin.current = { x: event.clientX, y: event.clientY }
    },
    onPointerUp: (event) => {
      const start = origin.current
      origin.current = null
      if (start === null) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < BOARD.swipePx) return
      const direction: SwipeDirection = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      // A swipe that meant nothing here is still not a tap.
      swiped.current = true
      onSwipe(direction)
    },
    onPointerCancel: () => {
      origin.current = null
    },
    consumed: () => {
      const was = swiped.current
      swiped.current = false
      return was
    },
  }
}
