// Lanes of overlapping items in one row (D-111). Pure: no React and no domain knowledge. An item is a run of day
// indexes in the window.

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
