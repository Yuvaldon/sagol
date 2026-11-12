// Names of the typed URL search params that hold all view state (D-023). Values are typed
// and validated by `logic` (view state); only the names live here.

export const SEARCH_PARAMS = {
  /** Active view id (`ViewId`). */
  view: 'view',
  /** First day of the visible date window, or the day a range kind is anchored on (ISO calendar date). */
  from: 'from',
  /** Last day of a free date window from an older link (ISO calendar date); a range kind ignores it (D-211). */
  to: 'to',
  /** The kind of the date window (`RangeKind`, D-211): a day, a week, a month or a whole rotation. */
  range: 'range',
  /** The rotation (a deployment id) of the "whole rotation" range (D-211). */
  rotation: 'rotation',
  /** The key the board's rows are sorted by (`BoardSortKey`, D-214), or a column of the table. */
  sort: 'sort',
  /** The direction of that sort (`SortOrder`, D-214). */
  order: 'order',
  /** Active filter (a serialized `FilterExpression`). */
  filter: 'filter',
  /** Open drawer or sheet module. */
  panel: 'panel',
  /** Row opened inside that panel, or `NEW_ENTITY`. */
  entity: 'entity',
  /** Parent of a new unit (D-092). */
  parent: 'parent',
  /** What a timeline bar's color means (`BarColorMode`, D-112). */
  colors: 'colors',
  /** The board's leave conditions: statuses and types (D-132). */
  leaves: 'leaves',
  /** "Only who is missing" (D-133). */
  missing: 'missing',
  /** The day of the present and absent lists (D-134), and of the broken rules in the rules panel (D-141). */
  day: 'day',
  /** The soldier and days a drag on the timeline marked for a new leave (D-143). */
  draft: 'draft',
} as const

export type SearchParamName = (typeof SEARCH_PARAMS)[keyof typeof SEARCH_PARAMS]
