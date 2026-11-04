import { IssueCode, type Issue, type Unit, type UnitId, type UnitLevelId } from '@contracts'

// Unit ancestry derived from `units.parent_id`, the only source of truth (D-009).
// Every walk stops on a missing parent or on a cycle, so corrupt data cannot loop.

/** The columns the hierarchy reads. Full `Unit` rows fit. */
export type UnitNode = Pick<Unit, 'id' | 'parent_id' | 'unit_level_id'>

export interface UnitTree {
  readonly nodes: ReadonlyMap<UnitId, UnitNode>
  readonly children: ReadonlyMap<UnitId, readonly UnitId[]>
}

/** Indexes units by id and by parent. Archived units stay in the tree (D-017). */
export function buildUnitTree(units: Iterable<UnitNode>): UnitTree {
  const nodes = new Map<UnitId, UnitNode>()
  for (const unit of units) nodes.set(unit.id, unit)
  const children = new Map<UnitId, UnitId[]>()
  for (const unit of nodes.values()) {
    if (unit.parent_id === null) continue
    const siblings = children.get(unit.parent_id)
    if (siblings === undefined) children.set(unit.parent_id, [unit.id])
    else siblings.push(unit.id)
  }
  return { nodes, children }
}

/** Ancestors of a unit, nearest first, without the unit itself. */
export function ancestorsOf(tree: UnitTree, unitId: UnitId): UnitId[] {
  const ancestors: UnitId[] = []
  const seen = new Set<UnitId>([unitId])
  let parent = tree.nodes.get(unitId)?.parent_id ?? null
  while (parent !== null && !seen.has(parent)) {
    ancestors.push(parent)
    seen.add(parent)
    parent = tree.nodes.get(parent)?.parent_id ?? null
  }
  return ancestors
}

/** Descendants of a unit in breadth-first order, without the unit itself. */
export function descendantsOf(tree: UnitTree, unitId: UnitId): UnitId[] {
  const descendants: UnitId[] = []
  const seen = new Set<UnitId>([unitId])
  const queue: UnitId[] = [unitId]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current === undefined) break
    for (const child of tree.children.get(current) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      descendants.push(child)
      queue.push(child)
    }
  }
  return descendants
}

/** Number of ancestors: 0 for a top-level unit. */
export function depthOf(tree: UnitTree, unitId: UnitId): number {
  return ancestorsOf(tree, unitId).length
}

/** True when `ancestorId` is `unitId` or one of its ancestors. */
export function isAncestorOrSelf(tree: UnitTree, ancestorId: UnitId, unitId: UnitId): boolean {
  return ancestorId === unitId || ancestorsOf(tree, unitId).includes(ancestorId)
}

/** The ancestor `steps` levels up (1 = parent), or NULL past the top (D-055). */
export function ancestorAtSteps(tree: UnitTree, unitId: UnitId, steps: number): UnitId | null {
  if (steps < 1) return null
  return ancestorsOf(tree, unitId)[steps - 1] ?? null
}

/** The nearest unit at `levelId`, starting with the unit itself (D-055), or NULL. */
export function ancestorOrSelfAtLevel(
  tree: UnitTree,
  unitId: UnitId,
  levelId: UnitLevelId,
): UnitId | null {
  if (!tree.nodes.has(unitId)) return null
  for (const candidate of [unitId, ...ancestorsOf(tree, unitId)]) {
    if (tree.nodes.get(candidate)?.unit_level_id === levelId) return candidate
  }
  return null
}

/** `moveUnit` check: the new parent may not be the unit or one of its descendants (D-009). */
export function moveUnitIssues(
  tree: UnitTree,
  unitId: UnitId,
  newParentId: UnitId | null,
): Issue[] {
  if (newParentId === null) return []
  if (!isAncestorOrSelf(tree, unitId, newParentId)) return []
  return [{ path: ['parent_id'], code: IssueCode.enum.unit_cycle }]
}
