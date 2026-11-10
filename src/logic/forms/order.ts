// The order of rows that carry `sort_order` (D-045): set at creation and by reorder.

export function bySortOrder<Row extends { readonly id: string; readonly sort_order: number }>(a: Row, b: Row): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

/** After the last of `rows`: where a new row of the same group goes. */
export function nextSortOrder(rows: readonly { readonly sort_order: number }[]): number {
  return Math.max(-1, ...rows.map((row) => row.sort_order)) + 1
}

/**
 * The live rows of a group with `row` moved one place up (-1) or down (1), or NULL when it cannot move. What a
 * reorder command takes, as `{ id, expected_version }` items.
 */
export function steppedItems<Row extends { readonly id: string; readonly version: number }>(
  group: readonly Row[],
  row: Row,
  direction: -1 | 1,
): { id: Row['id']; expected_version: number }[] | null {
  const from = group.findIndex((candidate) => candidate.id === row.id)
  const other = group[from + direction]
  if (from < 0 || other === undefined) return null
  const order = group.map((candidate, index) => (index === from ? other : index === from + direction ? row : candidate))
  return order.map((candidate) => ({ id: candidate.id, expected_version: candidate.version }))
}
