import { BoardGroupKey } from '@config'
import { TagCategoryId, TagSelectionMode, type TagCategory, type Unit, type UnitId } from '@contracts'
import { z } from 'zod'

// The board's grouping in the URL (D-452): no groups, the unit (D-105), the command rank, or a tag category. Absent, the
// default holds: no groups when the board covers one unit, by unit when it covers several.

export const BoardGrouping = z.union([z.object({ key: BoardGroupKey }).strict(), z.object({ category: TagCategoryId }).strict()])
export type BoardGrouping = z.infer<typeof BoardGrouping>

export const NO_GROUPING: BoardGrouping = { key: BoardGroupKey.enum.none }
export const UNIT_GROUPING: BoardGrouping = { key: BoardGroupKey.enum.unit }

export function sameGrouping(a: BoardGrouping, b: BoardGrouping): boolean {
  return 'key' in a ? 'key' in b && a.key === b.key : 'category' in b && a.category === b.category
}

/** Whether a category can group the rows: live and `single`, so each soldier sits in one group (D-452). */
export function groupsByCategory(category: Pick<TagCategory, 'selection_mode' | 'archived_at'>): boolean {
  return category.archived_at === null && category.selection_mode === TagSelectionMode.enum.single
}

/**
 * The grouping when the URL names none (D-452): none when the scope holds one live unit the actor sees, by unit
 * otherwise. `units` are the live units the actor sees; `scopeUnitId` the filter's unit, NULL for everything they see.
 */
export function defaultGrouping(units: readonly Pick<Unit, 'id' | 'parent_id'>[], scopeUnitId: UnitId | null): BoardGrouping {
  const single = scopeUnitId === null ? units.length === 1 : !units.some((unit) => unit.parent_id === scopeUnitId)
  return single ? NO_GROUPING : UNIT_GROUPING
}

/**
 * The grouping the board applies: the held one when it still reads, the default otherwise. A category that is
 * archived, no longer `single` or unknown is held but not applied (D-452).
 */
export function appliedGrouping(
  held: BoardGrouping | undefined,
  categories: readonly Pick<TagCategory, 'id' | 'selection_mode' | 'archived_at'>[],
  fallback: BoardGrouping,
): BoardGrouping {
  if (held === undefined) return fallback
  if ('key' in held) return held
  const category = categories.find((candidate) => candidate.id === held.category)
  return category !== undefined && groupsByCategory(category) ? held : fallback
}
