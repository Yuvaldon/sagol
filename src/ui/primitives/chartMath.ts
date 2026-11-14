/** A share of `max` in percent, 0 … 100; 0 when `max` is not positive. */
export function percentOf(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
}
