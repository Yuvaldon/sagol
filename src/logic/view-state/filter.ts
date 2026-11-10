import type {
  CommandRankId,
  FilterExpression,
  FilterNode,
  SoldierStatus,
  TagCategoryId,
  TagId,
  UnitId,
} from '@contracts'
import { useCallback, useMemo } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The view filter in the URL (D-104, D-131). It is one `FilterExpression` (D-067): the unit selector writes the
// unit, and the filter bar its chips, as one top-level `and`. Anything else is a filter the bar does not read.

/** The conditions the bar and the unit selector read and write. An empty list is a chip that is not there. */
export interface SoldierConditions {
  readonly unitId: UnitId | null
  /** One set per tag chip, each matching any of its tags. */
  readonly tagSets: readonly (readonly TagId[])[]
  readonly rankIds: readonly CommandRankId[]
  readonly statuses: readonly SoldierStatus[]
}

export const NO_CONDITIONS: SoldierConditions = { unitId: null, tagSets: [], rankIds: [], statuses: [] }

export type ReadFilter =
  | { readonly kind: 'conditions'; readonly conditions: SoldierConditions }
  /** A filter the bar does not read, as a hand-written link may hold. */
  | { readonly kind: 'other' }

const OTHER: ReadFilter = { kind: 'other' }

function nodesOf(filter: FilterExpression | null): readonly FilterNode[] {
  if (filter === null || filter.where === undefined) return []
  return filter.where.kind === 'and' ? filter.where.nodes : [filter.where]
}

export function readFilter(filter: FilterExpression | null): ReadFilter {
  let conditions: SoldierConditions = NO_CONDITIONS
  for (const node of nodesOf(filter)) {
    if (node.kind === 'unit' && node.include_descendants && node.unit_ids.length === 1 && conditions.unitId === null) {
      const [unitId] = node.unit_ids
      if (unitId !== undefined) conditions = { ...conditions, unitId }
    } else if (node.kind === 'tag' && node.match === 'any') {
      conditions = { ...conditions, tagSets: [...conditions.tagSets, node.tag_ids] }
    } else if (node.kind === 'command_rank' && conditions.rankIds.length === 0) {
      conditions = { ...conditions, rankIds: node.command_rank_ids }
    } else if (node.kind === 'soldier_status' && conditions.statuses.length === 0) {
      conditions = { ...conditions, statuses: node.statuses }
    } else {
      return OTHER
    }
  }
  return { kind: 'conditions', conditions }
}

/** One top-level `and`, a lone node unwrapped, nothing when there is no condition (D-131). */
export function writeFilter(conditions: SoldierConditions): FilterExpression | undefined {
  const nodes: FilterNode[] = [
    ...(conditions.unitId === null
      ? []
      : [{ kind: 'unit' as const, unit_ids: [conditions.unitId], include_descendants: true }]),
    ...conditions.tagSets
      .filter((tagIds) => tagIds.length > 0)
      .map((tagIds) => ({ kind: 'tag' as const, match: 'any' as const, tag_ids: [...tagIds] })),
    ...(conditions.rankIds.length === 0 ? [] : [{ kind: 'command_rank' as const, command_rank_ids: [...conditions.rankIds] }]),
    ...(conditions.statuses.length === 0 ? [] : [{ kind: 'soldier_status' as const, statuses: [...conditions.statuses] }]),
  ]
  const [first] = nodes
  if (first === undefined) return undefined
  return nodes.length === 1 ? { where: first } : { where: { kind: 'and', nodes } }
}

/** The filter of one unit and its sub-units, as the unit selector writes it (D-104). */
export function unitFilterOf(unitId: UnitId | null): FilterExpression | undefined {
  return writeFilter({ ...NO_CONDITIONS, unitId })
}

/** What the unit selector shows for the current filter. */
export type FilterUnit =
  | { readonly kind: 'organization' }
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  /** A filter the bar does not read. */
  | { readonly kind: 'other' }

export function filterUnitOf(filter: FilterExpression | null): FilterUnit {
  const read = readFilter(filter)
  if (read.kind === 'other') return { kind: 'other' }
  const { unitId } = read.conditions
  return unitId === null ? { kind: 'organization' } : { kind: 'unit', unitId }
}

/**
 * The tag chip of one category replaced by `tagIds` (D-131): the sets that hold a tag of the category give way, the
 * new set takes the place of the first of them, and an empty one removes the chip.
 */
export function withTagChip(
  conditions: SoldierConditions,
  categoryOf: (tagId: TagId) => TagCategoryId | undefined,
  categoryId: TagCategoryId,
  tagIds: readonly TagId[],
): SoldierConditions {
  const inCategory = (set: readonly TagId[]) => set.some((tagId) => categoryOf(tagId) === categoryId)
  const at = conditions.tagSets.findIndex(inCategory)
  const others = conditions.tagSets.filter((set) => !inCategory(set))
  if (tagIds.length === 0) return { ...conditions, tagSets: others }
  const position = at < 0 ? others.length : conditions.tagSets.slice(0, at).filter((set) => !inCategory(set)).length
  return { ...conditions, tagSets: [...others.slice(0, position), tagIds, ...others.slice(position)] }
}

export interface ViewFilterState {
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  readonly read: ReadFilter
  readonly unit: FilterUnit
  selectUnit(unitId: UnitId | null): void
  /** Writes the bar's conditions. */
  setConditions(conditions: SoldierConditions): void
  /** Removes every condition, the unit included. */
  clear(): void
}

export function useViewFilter(): ViewFilterState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const filter = search.filter ?? null
  const read = useMemo(() => readFilter(filter), [filter])
  const unit = useMemo(() => filterUnitOf(filter), [filter])
  const setConditions = useCallback(
    (conditions: SoldierConditions) => {
      change({ filter: writeFilter(conditions) })
    },
    [change],
  )
  const selectUnit = useCallback(
    (unitId: UnitId | null) => {
      // A filter the bar does not read gives way to the unit alone, as in V3 (D-104).
      const base = read.kind === 'conditions' ? read.conditions : NO_CONDITIONS
      setConditions({ ...base, unitId })
    },
    [read, setConditions],
  )
  const clear = useCallback(() => {
    change({ filter: undefined })
  }, [change])
  return { filter, read, unit, selectUnit, setConditions, clear }
}
