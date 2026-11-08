// Names of the typed URL search params that hold all view state (D-023). Values are typed
// and validated by `logic` (view state); only the names live here.

export const SEARCH_PARAMS = {
  /** Active view id (`ViewId`). */
  view: 'view',
  /** First day of the visible date window (ISO calendar date). */
  from: 'from',
  /** Last day of the visible date window (ISO calendar date). */
  to: 'to',
  /** Active filter (a serialized `FilterExpression`). */
  filter: 'filter',
  /** Open drawer or sheet module. */
  panel: 'panel',
  /** Row opened inside that panel, or `NEW_ENTITY`. */
  entity: 'entity',
  /** Parent of a new unit (D-092). */
  parent: 'parent',
} as const

export type SearchParamName = (typeof SEARCH_PARAMS)[keyof typeof SEARCH_PARAMS]
