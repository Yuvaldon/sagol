import type { JsonValue } from '@contracts'

// JSON helpers for JSONB values (properties, filter operands). Object key order never
// matters: two values are equal when their stable forms are equal.

/** Code-unit order of strings: deterministic and locale-independent. */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** JSON text with object keys sorted, so equal values give equal text. */
export function stableStringify(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([a], [b]) => compareCodeUnits(a, b))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** Deep equality of two JSON values; `undefined` (absent) equals only `undefined`. */
export function jsonEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return stableStringify(a) === stableStringify(b)
}
