import { BoardSortKey, DEFAULT_BOARD_SORT_KEY, DEFAULT_SORT_ORDER, SortOrder } from '@config'
import { PropertyDefinitionId } from '@contracts'
import { z } from 'zod'

// The board's sort rules in the URL (D-313): an ordered list, each a key of D-214 or a soldier property with its
// direction. The first decides, the next break its ties, the name breaks the rest. Absent, the default rule holds.

export const SortRule = z.union([
  z.object({ key: BoardSortKey, order: SortOrder }).strict(),
  z.object({ property: PropertyDefinitionId, order: SortOrder }).strict(),
])
export type SortRule = z.infer<typeof SortRule>

/** What a rule sorts by, without its direction; two rules on one target are one. */
export type SortTarget = { readonly key: BoardSortKey } | { readonly property: PropertyDefinitionId }

function targetId(rule: SortTarget): string {
  return 'key' in rule ? `key:${rule.key}` : `property:${rule.property}`
}

export function sameTarget(a: SortTarget, b: SortTarget): boolean {
  return targetId(a) === targetId(b)
}

/** A list in which each target appears once. An empty list sorts by the name alone. */
export const SortRules = z
  .array(SortRule)
  .refine((rules) => new Set(rules.map(targetId)).size === rules.length)

export const DEFAULT_SORT_RULES: readonly SortRule[] = [
  { key: DEFAULT_BOARD_SORT_KEY, order: DEFAULT_SORT_ORDER[DEFAULT_BOARD_SORT_KEY] },
]

/** The direction a target starts in: a key's own (D-214), ascending for a property. */
export function defaultOrderOf(target: SortTarget): SortOrder {
  return 'key' in target ? DEFAULT_SORT_ORDER[target.key] : SortOrder.enum.asc
}

export function isDefaultSort(rules: readonly SortRule[]): boolean {
  return (
    rules.length === DEFAULT_SORT_RULES.length &&
    rules.every((rule, index) => {
      const held = DEFAULT_SORT_RULES[index]
      return held !== undefined && sameTarget(rule, held) && rule.order === held.order
    })
  )
}
