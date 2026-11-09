import { dayOffset, type GridLayout } from './layout'

// Lanes of overlapping items in one row (D-111), and where a bar or a badge sits. Pure: no React and no
// domain knowledge. An item is a run of day indexes in the window.

export interface LaneItem {
  /** The first day of the window it covers. */
  readonly start: number
  /** How many days of the window it covers, at least one. */
  readonly length: number
}

/**
 * In start order, the longer first on a tie, each item takes the first lane that is free on all its days.
 * Returns each item's lane, in the input order, and how many lanes the row needs (at least one).
 */
export function assignLanes(items: readonly LaneItem[]): { readonly lanes: number[]; readonly count: number } {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.start - b.item.start || b.item.length - a.item.length || a.index - b.index)
  /** The last day each lane holds so far. */
  const ends: number[] = []
  const lanes: number[] = items.map(() => 0)
  for (const { item, index } of order) {
    const free = ends.findIndex((end) => end < item.start)
    const lane = free < 0 ? ends.length : free
    ends[lane] = item.start + item.length - 1
    lanes[index] = lane
  }
  return { lanes, count: Math.max(1, ends.length) }
}

export interface LaneSizes {
  readonly barPx: number
  readonly laneStepPx: number
  readonly barInsetPx: number
}

/** A row holds one lane at its base height, and grows by a step for each more. */
export function rowHeightFor(baseRowPx: number, laneCount: number, sizes: LaneSizes): number {
  return baseRowPx + Math.max(0, laneCount - 1) * sizes.laneStepPx
}

/** The top of a lane: the first lane is centered in the base row, as in Stone 3. */
export function laneTop(baseRowPx: number, lane: number, sizes: LaneSizes): number {
  return Math.floor((baseRowPx - sizes.barPx) / 2) + lane * sizes.laneStepPx
}

/** A bar's inline start and width. A side cut by the window's edge has no inset, so the bar reads as going on. */
export function barSpan(
  layout: GridLayout,
  item: LaneItem,
  cut: { readonly start: boolean; readonly end: boolean },
  sizes: LaneSizes,
): { readonly startPx: number; readonly widthPx: number } {
  const startInset = cut.start ? 0 : sizes.barInsetPx
  const endInset = cut.end ? 0 : sizes.barInsetPx
  return {
    startPx: dayOffset(layout, item.start) + startInset,
    widthPx: layout.dayPx * item.length - startInset - endInset,
  }
}

/** Where a badge of one day sits: centered in the day. */
export function badgeStart(layout: GridLayout, day: number, sizes: LaneSizes): number {
  return dayOffset(layout, day) + Math.floor((layout.dayPx - sizes.barPx) / 2)
}
