import type { FilterExpression, UnitId } from '@contracts'
import { useCallback, useMemo } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The view filter in the URL (D-104). It is one `FilterExpression` (D-067). In V3 only the unit selector
// writes it, with one unit and its sub-units; V6 adds the other conditions to the same parameter.

/** What the unit selector shows for the current filter. */
export type FilterUnit =
  | { readonly kind: 'organization' }
  | { readonly kind: 'unit'; readonly unitId: UnitId }
  /** Any other expression, which only a later filter bar writes. */
  | { readonly kind: 'other' }

export function unitFilterOf(unitId: UnitId | null): FilterExpression | undefined {
  return unitId === null ? undefined : { where: { kind: 'unit', unit_ids: [unitId], include_descendants: true } }
}

export function filterUnitOf(filter: FilterExpression | null): FilterUnit {
  if (filter === null || filter.where === undefined) return { kind: 'organization' }
  const { where } = filter
  if (where.kind === 'unit' && where.include_descendants && where.unit_ids.length === 1) {
    const [unitId] = where.unit_ids
    if (unitId !== undefined) return { kind: 'unit', unitId }
  }
  return { kind: 'other' }
}

export interface ViewFilterState {
  /** NULL selects everyone. */
  readonly filter: FilterExpression | null
  readonly unit: FilterUnit
  selectUnit(unitId: UnitId | null): void
}

export function useViewFilter(): ViewFilterState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const filter = search.filter ?? null
  const unit = useMemo(() => filterUnitOf(filter), [filter])
  const selectUnit = useCallback(
    (unitId: UnitId | null) => {
      change({ filter: unitFilterOf(unitId) })
    },
    [change],
  )
  return { filter, unit, selectUnit }
}
