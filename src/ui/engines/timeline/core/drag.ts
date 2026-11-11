import type { GridLayout } from './layout'

// Dragging on the timeline (D-143, D-144). Pure: no React and no domain knowledge. Days are offsets from the window's
// first day, and a range may reach past the window on either side (a leave the window cuts). Pixels are inline
// offsets from the grid's inline start, so the same numbers serve RTL and LTR.

/** What a drag does: move a mark, move its first or last day, or mark days for a new item. */
export type DragKind = 'move' | 'start' | 'end' | 'create'

/** A run of days, both ends included. */
export interface DayRange {
  readonly start: number
  readonly end: number
}

/** The inline offset of a pointer from a box's inline start. In RTL the inline start is the box's right edge. */
export function inlineOffset(clientX: number, box: { readonly left: number; readonly right: number }, rtl: boolean): number {
  return rtl ? box.right - clientX : clientX - box.left
}

/** Whether an inline offset falls on one of the window's days, not on the name column or past the last day. */
export function isOnDays(layout: GridLayout, inlinePx: number): boolean {
  return inlinePx >= layout.nameColumnPx && inlinePx < layout.nameColumnPx + layout.dayPx * layout.dayCount
}

/** The day under an inline offset. A pointer past either end counts as the window's first or last day. */
export function dayAt(layout: GridLayout, inlinePx: number): number {
  const day = Math.floor((inlinePx - layout.nameColumnPx) / layout.dayPx)
  return Math.min(Math.max(day, 0), Math.max(layout.dayCount - 1, 0))
}

/**
 * What pressing a mark at an inline offset inside it grabs: an end of a bar that may be resized, or its body. An end
 * the window cuts is not grabbed, since its day is out of sight. Handles never take more than a quarter of the mark.
 */
export function grabOf(
  offsetPx: number,
  widthPx: number,
  handlePx: number,
  ends: { readonly start: boolean; readonly end: boolean },
): DragKind {
  const handle = Math.min(handlePx, widthPx / 4)
  if (ends.start && offsetPx < handle) return 'start'
  if (ends.end && offsetPx >= widthPx - handle) return 'end'
  return 'move'
}

/**
 * The range a drag leaves, from the day it was pressed on to the day under the pointer. A move keeps the length; an
 * end stops at the other end, so at least one day remains; a creation spans the two days in order.
 */
export function draggedRange(kind: DragKind, origin: DayRange, fromDay: number, toDay: number): DayRange {
  const delta = toDay - fromDay
  switch (kind) {
    case 'move':
      return { start: origin.start + delta, end: origin.end + delta }
    case 'start':
      return { start: Math.min(origin.start + delta, origin.end), end: origin.end }
    case 'end':
      return { start: origin.start, end: Math.max(origin.end + delta, origin.start) }
    case 'create':
      return { start: Math.min(fromDay, toDay), end: Math.max(fromDay, toDay) }
  }
}

export function sameRange(a: DayRange, b: DayRange): boolean {
  return a.start === b.start && a.end === b.end
}

/** Whether a pointer has travelled far enough from where it was pressed. */
export function isPastThreshold(dx: number, dy: number, thresholdPx: number): boolean {
  return Math.hypot(dx, dy) >= thresholdPx
}

/**
 * How far to scroll sideways while a drag nears an edge of what is in sight: negative toward the inline start,
 * positive toward the inline end, and faster the deeper the pointer is in the edge zone. Zero away from the edges.
 */
export function edgeStep(inlinePx: number, visibleStart: number, visibleEnd: number, zonePx: number, maxStepPx: number): number {
  const intoStart = visibleStart + zonePx - inlinePx
  if (intoStart > 0) return -Math.ceil((Math.min(intoStart, zonePx) / zonePx) * maxStepPx)
  const intoEnd = inlinePx - (visibleEnd - zonePx)
  if (intoEnd > 0) return Math.ceil((Math.min(intoEnd, zonePx) / zonePx) * maxStepPx)
  return 0
}

/** The part of a range in the window, as a run of days and which sides the window cuts. NULL when none is in it. */
export function rangeInWindow(
  range: DayRange,
  dayCount: number,
): { readonly start: number; readonly length: number; readonly cut: { readonly start: boolean; readonly end: boolean } } | null {
  const start = Math.max(range.start, 0)
  const end = Math.min(range.end, dayCount - 1)
  if (end < start) return null
  return { start, length: end - start + 1, cut: { start: range.start < 0, end: range.end > dayCount - 1 } }
}
