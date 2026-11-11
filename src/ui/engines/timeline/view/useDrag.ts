import { TIMELINE_DRAG } from '@config'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  dayAt,
  draggedRange,
  edgeStep,
  grabOf,
  inlineOffset,
  isOnDays,
  isPastThreshold,
  sameRange,
  type DayRange,
  type DragKind,
} from '../core/drag'
import type { GridLayout } from '../core/layout'
import type { TimelineDrag, TimelineDragProps, TimelineResourceRow } from './model'

// The pointer side of a drag on the board (D-143, D-144). A mouse or a pen drags once it passes the threshold; a finger
// first holds still, so a finger that moves keeps scrolling the board. The math is the core's; this file only follows
// the pointer, and tells the adapter what the drag holds.

interface Gesture {
  readonly pointerId: number
  readonly touch: boolean
  readonly rowKey: string
  readonly markKey: string | null
  readonly kind: DragKind
  readonly origin: DayRange
  readonly fromDay: number
  readonly startX: number
  readonly startY: number
  readonly rtl: boolean
  lastX: number
  picked: boolean
  range: DayRange
}

interface Elements {
  /** What scrolls: the board. */
  readonly scroller: HTMLElement | null
  /** The grid inside it, whose inline start is where offsets start. */
  readonly content: HTMLElement | null
}

export interface DragGesture {
  /** The drag on screen, once it has started. */
  readonly active: TimelineDrag | null
  /** A press on a row: a mark, an end of a bar, or an empty day. */
  start(event: ReactPointerEvent, row: TimelineResourceRow): void
  /** True while a press must not open what it was on, because it became a drag. */
  pressIsDrag(): boolean
  /** True while a press is held, so a long press does not open the browser's menu. */
  isHolding(): boolean
}

const isRtl = (element: Element) => getComputedStyle(element).direction === 'rtl'

/** The mark a press landed in: the nearest element that names one in `data-mark`. */
function markElementOf(target: EventTarget | null): HTMLElement | null {
  let element = target instanceof HTMLElement ? target : target instanceof Element ? target.parentElement : null
  while (element !== null && element.dataset.mark === undefined) element = element.parentElement
  return element
}

export function useDrag(layout: GridLayout, elements: Elements, handlers: TimelineDragProps | null): DragGesture {
  const [active, setActive] = useState<TimelineDrag | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const suppressPress = useRef(false)
  /** What the listeners read, current at every event. */
  const latest = useRef({ layout, elements, handlers })
  useLayoutEffect(() => {
    latest.current = { layout, elements, handlers }
  })
  /** Undoes what a press set up: its timer, its listeners and its scrolling. */
  const teardown = useRef<() => void>(() => undefined)

  const finish = useCallback((dropped: boolean) => {
    const current = gesture.current
    teardown.current()
    gesture.current = null
    if (current === null || !current.picked) return
    setActive(null)
    // The press that ends a drag is over once this event is; only then may the next press open a mark.
    window.setTimeout(() => {
      suppressPress.current = false
    }, 0)
    const drag: TimelineDrag = { rowKey: current.rowKey, markKey: current.markKey, kind: current.kind, range: current.range }
    if (dropped) latest.current.handlers?.onDrop(drag)
    else latest.current.handlers?.onChange(null)
  }, [])

  // A board that goes away mid-drag leaves nothing behind.
  useEffect(
    () => () => {
      teardown.current()
    },
    [],
  )

  const start = useCallback(
    (event: ReactPointerEvent, row: TimelineResourceRow) => {
      const { handlers: drag, elements: found, layout: grid } = latest.current
      const content = found.content
      // One drag at a time: a drop that waits for its answer holds the board.
      if (drag === null || drag.held !== null || content === null || gesture.current !== null) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const rtl = isRtl(content)
      // The names stay in sight over days the board scrolled under them: a press there is on a name, never a day.
      const scroller = found.scroller
      if (scroller !== null && inlineOffset(event.clientX, scroller.getBoundingClientRect(), rtl) < grid.nameColumnPx) return
      const at = inlineOffset(event.clientX, content.getBoundingClientRect(), rtl)
      const target = markElementOf(event.target)
      let markKey: string | null = null
      let kind: DragKind = 'create'
      let origin: DayRange
      if (target === null) {
        if (!row.creatable || !isOnDays(grid, at)) return
        const day = dayAt(grid, at)
        origin = { start: day, end: day }
      } else {
        const mark = row.marks.find((candidate) => candidate.key === target.dataset.mark)
        if (mark === undefined || mark.drag === null) return
        const box = target.getBoundingClientRect()
        const ends = mark.drag.resize ? { start: !mark.cut.start, end: !mark.cut.end } : { start: false, end: false }
        kind = mark.kind === 'bar' ? grabOf(inlineOffset(event.clientX, box, rtl), box.width, TIMELINE_DRAG.handlePx, ends) : 'move'
        markKey = mark.key
        origin = mark.range
      }
      // A mouse press on an empty day would start selecting text. A mark's button keeps its own press.
      if (event.pointerType === 'mouse' && markKey === null) event.preventDefault()
      suppressPress.current = false
      const current: Gesture = {
        pointerId: event.pointerId,
        touch: event.pointerType === 'touch',
        rowKey: row.key,
        markKey,
        kind,
        origin,
        fromDay: dayAt(grid, at),
        startX: event.clientX,
        startY: event.clientY,
        rtl,
        lastX: event.clientX,
        picked: false,
        range: origin,
      }
      gesture.current = current

      const report = () => {
        setActive({ rowKey: current.rowKey, markKey: current.markKey, kind: current.kind, range: current.range })
        latest.current.handlers?.onChange({ rowKey: current.rowKey, markKey: current.markKey, kind: current.kind, range: current.range })
      }
      /** The days under the pointer now, also after the board scrolled under a still pointer. */
      const follow = () => {
        const box = latest.current.elements.content?.getBoundingClientRect()
        if (box === undefined) return
        const day = dayAt(latest.current.layout, inlineOffset(current.lastX, box, current.rtl))
        const range = draggedRange(current.kind, current.origin, current.fromDay, day)
        if (sameRange(range, current.range)) return
        current.range = range
        report()
      }
      // While a finger drags, the board must not scroll under it.
      const holdScroll = (touchEvent: TouchEvent) => {
        touchEvent.preventDefault()
      }
      let frame = 0
      const scrollAtEdge = () => {
        const scroller = latest.current.elements.scroller
        if (scroller !== null) {
          const box = scroller.getBoundingClientRect()
          const step = edgeStep(
            inlineOffset(current.lastX, box, current.rtl),
            latest.current.layout.nameColumnPx,
            scroller.clientWidth,
            TIMELINE_DRAG.edgeZonePx,
            TIMELINE_DRAG.edgeStepPx,
          )
          if (step !== 0) {
            scroller.scrollBy({ left: current.rtl ? -step : step })
            follow()
          }
        }
        frame = window.requestAnimationFrame(scrollAtEdge)
      }
      const pick = () => {
        current.picked = true
        if (current.markKey !== null) suppressPress.current = true
        if (current.touch) document.addEventListener('touchmove', holdScroll, { passive: false })
        frame = window.requestAnimationFrame(scrollAtEdge)
        report()
      }
      const hold = current.touch ? window.setTimeout(pick, TIMELINE_DRAG.holdMs) : 0

      const onMove = (moved: PointerEvent) => {
        if (moved.pointerId !== current.pointerId) return
        current.lastX = moved.clientX
        if (!current.picked) {
          const dx = moved.clientX - current.startX
          const dy = moved.clientY - current.startY
          // A finger that wanders before the hold is a scroll; the browser takes it.
          if (current.touch) {
            if (isPastThreshold(dx, dy, TIMELINE_DRAG.holdTolerancePx)) finish(false)
            return
          }
          if (!isPastThreshold(dx, dy, TIMELINE_DRAG.thresholdPx)) return
          pick()
        }
        follow()
      }
      const onUp = (ended: PointerEvent) => {
        if (ended.pointerId === current.pointerId) finish(true)
      }
      const onCancel = (ended: PointerEvent) => {
        if (ended.pointerId === current.pointerId) finish(false)
      }
      const onKey = (key: KeyboardEvent) => {
        if (key.key !== 'Escape') return
        // Escape ends the drag only, not the drawer or dialog under it.
        key.preventDefault()
        key.stopPropagation()
        finish(false)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey, true)
      teardown.current = () => {
        window.clearTimeout(hold)
        window.cancelAnimationFrame(frame)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey, true)
        document.removeEventListener('touchmove', holdScroll)
        teardown.current = () => undefined
      }
    },
    [finish],
  )

  return {
    active,
    start,
    pressIsDrag: () => suppressPress.current,
    isHolding: () => gesture.current !== null,
  }
}
