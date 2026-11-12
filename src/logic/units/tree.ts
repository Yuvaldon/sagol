import { DROP_EDGE_FRACTION } from '@config'
import type { Unit, UnitId } from '@contracts'
import { buildUnitTree, descendantsOf } from '@domain'

// The tree as the drawer shows it, and what a drop means. Pure: the adapter stays the authority, so a
// cycle is planned here like any other drop and refused there (D-092).

export interface UnitTreeRow {
  readonly unit: Unit
  readonly depth: number
}

/** The order the adapter uses for lists. */
export function bySortOrder(a: { sort_order: number; id: string }, b: { sort_order: number; id: string }): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

/**
 * The live units in tree order, each with its depth. A unit whose parent the actor cannot see shows at
 * the top, so nothing visible is lost (D-053).
 */
export function unitTreeRows(units: readonly Unit[]): UnitTreeRow[] {
  const known = new Set(units.map((unit) => unit.id))
  const childrenOf = new Map<UnitId | null, Unit[]>()
  for (const unit of [...units].sort(bySortOrder)) {
    const parent = unit.parent_id !== null && known.has(unit.parent_id) ? unit.parent_id : null
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), unit])
  }
  const rows: UnitTreeRow[] = []
  const seen = new Set<UnitId>()
  function visit(parent: UnitId | null, depth: number) {
    for (const unit of childrenOf.get(parent) ?? []) {
      if (seen.has(unit.id)) continue
      seen.add(unit.id)
      rows.push({ unit, depth })
      visit(unit.id, depth + 1)
    }
  }
  visit(null, 0)
  return rows
}

/** The live children of a parent, in order. */
export function siblingsUnder(units: readonly Unit[], parentId: UnitId | null): Unit[] {
  return units.filter((unit) => unit.parent_id === parentId).sort(bySortOrder)
}

/** Where a unit may go by "move to": anywhere but itself and its own subtree (D-009). */
export function moveCandidates(units: readonly Unit[], unit: Unit): UnitTreeRow[] {
  const excluded = new Set<UnitId>([unit.id, ...descendantsOf(buildUnitTree(units), unit.id)])
  return unitTreeRows(units).filter((row) => !excluded.has(row.unit.id))
}

/** A row moved one step up or down its list. NULL when it is already at that end. */
export function steppedOrder<Row extends { id: string }>(rows: readonly Row[], id: Row['id'], step: -1 | 1): Row[] | null {
  const from = rows.findIndex((row) => row.id === id)
  const to = from + step
  const moving = rows[from]
  const other = rows[to]
  if (moving === undefined || other === undefined) return null
  const next = [...rows]
  next[from] = other
  next[to] = moving
  return next
}

export type UnitDropZone = 'before' | 'after' | 'into'

/** Which part of a row the pointer is over. */
export function dropZoneAt(pointerY: number, rowTop: number, rowHeight: number): UnitDropZone {
  const position = (pointerY - rowTop) / rowHeight
  if (position < DROP_EDGE_FRACTION) return 'before'
  if (position > 1 - DROP_EDGE_FRACTION) return 'after'
  return 'into'
}

/** The commands a drop needs. NULL when the drop changes nothing. */
export interface UnitDropPlan {
  /** Set when the parent changes. The unit lands last (D-087). */
  readonly move: { readonly parent_id: UnitId | null } | null
  /** The new order of the destination's children, when the unit should not stay last. */
  readonly order: readonly Unit[] | null
}

function sameOrder(a: readonly Unit[], b: readonly Unit[]): boolean {
  return a.length === b.length && a.every((unit, index) => unit.id === b[index]?.id)
}

export function planUnitDrop(
  units: readonly Unit[],
  activeId: UnitId,
  overId: UnitId,
  zone: UnitDropZone,
  /** Whether the user may move a unit under this parent: a drop the server would refuse plans nothing (OI-247). */
  moveTo: (parentId: UnitId | null) => boolean = () => true,
): UnitDropPlan | null {
  const active = units.find((unit) => unit.id === activeId)
  const over = units.find((unit) => unit.id === overId)
  if (active === undefined || over === undefined || activeId === overId) return null

  const parentId = zone === 'into' ? over.id : over.parent_id
  const others = siblingsUnder(units, parentId).filter((unit) => unit.id !== activeId)
  const insertAt = zone === 'into' ? others.length : others.findIndex((unit) => unit.id === overId) + (zone === 'after' ? 1 : 0)
  const order = [...others.slice(0, insertAt), active, ...others.slice(insertAt)]
  const landsLast = insertAt === others.length

  if (active.parent_id !== parentId) {
    if (!moveTo(parentId)) return null
    return { move: { parent_id: parentId }, order: landsLast ? null : order }
  }
  return sameOrder(order, siblingsUnder(units, parentId)) ? null : { move: null, order }
}
