// The timeline's geometry, in CSS pixels (ARCHITECTURE "View engines"). Pure: no React and no domain
// knowledge. Offsets are measured from the inline start, so the same numbers serve RTL and LTR.

export interface GridSizes {
  readonly nameColumnPx: number
  readonly minDayPx: number
}

export interface GridLayout {
  readonly nameColumnPx: number
  readonly dayPx: number
  readonly dayCount: number
  /** The whole grid: the name column and every day. */
  readonly widthPx: number
}

/**
 * Day columns are at least `minDayPx` wide and share any width left over, so a wide screen has no empty
 * strip. Below that width the grid is wider than the screen and scrolls sideways (D-108).
 */
export function gridLayout(availablePx: number, dayCount: number, sizes: GridSizes): GridLayout {
  const days = Math.max(dayCount, 1)
  const shared = Math.floor((availablePx - sizes.nameColumnPx) / days)
  const dayPx = Math.max(sizes.minDayPx, shared)
  return { nameColumnPx: sizes.nameColumnPx, dayPx, dayCount, widthPx: sizes.nameColumnPx + dayPx * dayCount }
}

/** Where a day's column starts. */
export function dayOffset(layout: GridLayout, index: number): number {
  return layout.nameColumnPx + layout.dayPx * index
}

/** A run of consecutive days. */
export interface DaySpan {
  readonly start: number
  readonly length: number
}

/** The runs of days whose flag is `wanted`, in order. */
export function spansOf(flags: readonly boolean[], wanted: boolean): DaySpan[] {
  const spans: DaySpan[] = []
  let start = -1
  flags.forEach((flag, index) => {
    if (flag === wanted && start < 0) start = index
    if (flag !== wanted && start >= 0) {
      spans.push({ start, length: index - start })
      start = -1
    }
  })
  if (start >= 0) spans.push({ start, length: flags.length - start })
  return spans
}
