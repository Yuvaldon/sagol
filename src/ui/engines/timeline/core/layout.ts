// The timeline's days, as runs (ARCHITECTURE "View engines"). Pure: no React and no domain knowledge.

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
