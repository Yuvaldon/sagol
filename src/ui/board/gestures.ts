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

/** Two fingers apart (fewer days in sight) or together (more days). */
export type PinchDirection = 'spread' | 'squeeze'

export interface Pinch {
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onPointerMove: (event: PointerEvent) => void
  readonly onPointerUp: (event: PointerEvent) => void
  /** Whether a pinch is under way or just ended: its fingers' taps are not taps. Asking forgets an ended one. */
  readonly consumed: () => boolean
}

/**
 * Calls `onPinch` once per pinch (OI-399), when two fingers have moved apart or together past `BOARD.pinchRatio` of
 * where they started. One pinch is one step, however far it goes; the fingers lift before the next.
 */
export function usePinch(onPinch: ((direction: PinchDirection) => void) | null): Pinch {
  const fingers = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef<number | null>(null)
  const done = useRef(false)
  const pinched = useRef(false)
  const spanOf = () => {
    const [a, b] = [...fingers.current.values()]
    return a === undefined || b === undefined ? null : Math.hypot(a.x - b.x, a.y - b.y)
  }
  return {
    onPointerDown: (event) => {
      if (event.pointerType !== 'touch' || onPinch === null) return
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (fingers.current.size === 2) {
        start.current = spanOf()
        done.current = false
        pinched.current = true
      }
    },
    onPointerMove: (event) => {
      if (!fingers.current.has(event.pointerId)) return
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      const from = start.current
      const now = spanOf()
      if (from === null || now === null || from === 0 || done.current || onPinch === null) return
      const ratio = now / from
      if (ratio >= BOARD.pinchRatio) {
        done.current = true
        onPinch('spread')
      } else if (ratio <= 1 / BOARD.pinchRatio) {
        done.current = true
        onPinch('squeeze')
      }
    },
    onPointerUp: (event) => {
      fingers.current.delete(event.pointerId)
      if (fingers.current.size < 2) start.current = null
    },
    consumed: () => {
      const was = pinched.current
      if (fingers.current.size === 0) pinched.current = false
      return was
    },
  }
}
