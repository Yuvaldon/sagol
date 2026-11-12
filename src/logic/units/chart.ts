import type { Unit } from '@contracts'
import { unitTreeRows } from './tree'

// The tree as an org chart (D-319): a top-down tidy layout in abstract cells. A row is a depth; a leaf takes the next
// slot, and a parent sits centered over its first and last child. The screen turns cells into lengths, so this stays
// free of pixels and of direction: slot 0 is the inline start.

export interface UnitChartNode {
  readonly unit: Unit
  readonly depth: number
  /** The node's place along the row, in slots from the inline start; half slots center a parent. */
  readonly slot: number
}

/** A parent and its children, for the connectors: one stem down from the parent, a bar, a stem to each child. */
export interface UnitChartFamily {
  readonly depth: number
  readonly parentSlot: number
  readonly childSlots: readonly number[]
}

export interface UnitChart {
  readonly nodes: readonly UnitChartNode[]
  readonly families: readonly UnitChartFamily[]
  /** Slots across the widest row. */
  readonly slots: number
  /** Rows, deepest included. */
  readonly depths: number
}

/** The visible units laid out as a chart, in tree order. A unit whose parent is out of sight is a root (D-053). */
export function unitChart(units: readonly Unit[]): UnitChart {
  const rows = unitTreeRows(units)
  // Tree order lists each unit's subtree right after it, so a row's children are the following rows one deeper,
  // up to the next row at its own depth or shallower.
  const childrenAt = rows.map((row, index) => {
    const children: number[] = []
    for (let next = index + 1; next < rows.length; next += 1) {
      const candidate = rows[next]
      if (candidate === undefined || candidate.depth <= row.depth) break
      if (candidate.depth === row.depth + 1) children.push(next)
    }
    return children
  })
  const slotAt: number[] = rows.map(() => 0)
  let nextLeaf = 0
  // Leaves take slots in tree order; then, walking back, every parent comes after its children are placed.
  childrenAt.forEach((children, index) => {
    if (children.length > 0) return
    slotAt[index] = nextLeaf
    nextLeaf += 1
  })
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const children = childrenAt[index] ?? []
    const first = children[0]
    const last = children[children.length - 1]
    if (first !== undefined && last !== undefined) slotAt[index] = ((slotAt[first] ?? 0) + (slotAt[last] ?? 0)) / 2
  }
  const nodes = rows.map((row, index) => ({ unit: row.unit, depth: row.depth, slot: slotAt[index] ?? 0 }))
  const families = rows.flatMap((row, index) => {
    const children = childrenAt[index] ?? []
    if (children.length === 0) return []
    return [{ depth: row.depth, parentSlot: slotAt[index] ?? 0, childSlots: children.map((child) => slotAt[child] ?? 0) }]
  })
  return {
    nodes,
    families,
    slots: nextLeaf,
    depths: rows.reduce((deepest, row) => Math.max(deepest, row.depth + 1), 0),
  }
}
