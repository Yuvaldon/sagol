import {
  PermissionAction,
  type PolicyTarget,
  type RankRoleBinding,
  type SoldierId,
  type UnitId,
} from '@contracts'
import {
  ancestorAtSteps,
  ancestorOrSelfAtLevel,
  isAncestorOrSelf,
  type UnitTree,
} from '../hierarchy'

// Scope anchors (D-028) resolved for one holder, and what a resolved scope covers (D-053).

/** The scope columns shared by rank bindings and access grants. */
export type ScopeColumns = Pick<
  RankRoleBinding,
  | 'anchor_type'
  | 'anchor_unit_id'
  | 'anchor_soldier_id'
  | 'anchor_level_id'
  | 'anchor_steps'
  | 'include_descendants'
>

/** A scope after relative anchors were resolved against the holder's home unit. */
export type ResolvedScope =
  | { kind: 'organization' }
  /** `self` (the holder) or a `soldier` anchor. */
  | { kind: 'soldier'; soldier_id: SoldierId }
  | { kind: 'unit'; unit_id: UnitId; include_descendants: boolean }
  /** An anchor that could not be resolved: covers nothing (D-055). */
  | { kind: 'empty' }

const EMPTY: ResolvedScope = { kind: 'empty' }

function unitScope(unitId: UnitId | null, includeDescendants: boolean): ResolvedScope {
  if (unitId === null) return EMPTY
  return { kind: 'unit', unit_id: unitId, include_descendants: includeDescendants }
}

/** Resolves a scope for `holderId`, whose primary unit today is `homeUnitId` (D-054). */
export function resolveScope(
  scope: ScopeColumns,
  holderId: SoldierId,
  homeUnitId: UnitId | null,
  tree: UnitTree,
): ResolvedScope {
  const descendants = scope.include_descendants
  switch (scope.anchor_type) {
    case 'organization':
      return { kind: 'organization' }
    case 'self':
      return { kind: 'soldier', soldier_id: holderId }
    case 'soldier':
      return scope.anchor_soldier_id === null
        ? EMPTY
        : { kind: 'soldier', soldier_id: scope.anchor_soldier_id }
    case 'unit':
      return unitScope(scope.anchor_unit_id, descendants)
    case 'home_unit':
      return unitScope(homeUnitId, descendants)
    case 'home_ancestor_steps':
      if (homeUnitId === null || scope.anchor_steps === null) return EMPTY
      return unitScope(ancestorAtSteps(tree, homeUnitId, scope.anchor_steps), descendants)
    case 'home_ancestor_at_level':
      if (homeUnitId === null || scope.anchor_level_id === null) return EMPTY
      return unitScope(ancestorOrSelfAtLevel(tree, homeUnitId, scope.anchor_level_id), descendants)
    default:
      return scope.anchor_type satisfies never
  }
}

function unitCovered(
  scope: Extract<ResolvedScope, { kind: 'unit' }>,
  unitId: UnitId,
  tree: UnitTree,
): boolean {
  if (scope.unit_id === unitId) return true
  return scope.include_descendants && isAncestorOrSelf(tree, scope.unit_id, unitId)
}

/** What scope coverage needs to know about the world. */
export interface CoverageFacts {
  readonly tree: UnitTree
  /** The soldier's primary unit today (D-054). */
  unitOf(soldierId: SoldierId): UnitId | null
}

/** True when a resolved scope covers the target for this action (D-053). */
export function scopeCovers(
  scope: ResolvedScope,
  action: PermissionAction,
  target: PolicyTarget,
  facts: CoverageFacts,
): boolean {
  if (scope.kind === 'empty') return false
  if (scope.kind === 'organization') return true
  switch (target.kind) {
    case 'organization':
      return action === PermissionAction.enum.view
    case 'unit':
      return scope.kind === 'unit' && unitCovered(scope, target.unit_id, facts.tree)
    case 'soldier': {
      if (scope.kind === 'soldier') return scope.soldier_id === target.soldier_id
      const unitId = facts.unitOf(target.soldier_id)
      return unitId !== null && unitCovered(scope, unitId, facts.tree)
    }
    default:
      return target satisfies never
  }
}
