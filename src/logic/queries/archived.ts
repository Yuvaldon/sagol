// The archived rows of a list read with `include_archived` (D-371): what a quiet "archived" section offers to restore.

/** The archived rows, in the list's order. */
export function archivedRows<T extends { archived_at: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.archived_at !== null)
}
