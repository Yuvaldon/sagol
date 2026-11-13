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
  /** The board's sort rules, in order: a key or a soldier property, each with its direction (D-313). */
  sorts: 'sorts',
  /** A column of the table's leaves it is sorted by (`TableSortKey`, D-214, D-313). */
  sort: 'sort',
  /** The direction of that column's sort (`SortOrder`, D-214). */
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
  /** The last day of the day report's span (D-193). Absent: the report is of one day. */
  until: 'until',
  /** The dashboard's unit (D-349). Absent: the actor's own unit, or the first they may read. */
  unit: 'unit',
  /** The dashboard's "כולל מתוכנן" (D-349): count the whole span, approved future leaves included. */
  planned: 'planned',
  /** The soldier and days a drag on the timeline marked for a new leave (D-143). */
  draft: 'draft',
} as const

export type SearchParamName = (typeof SEARCH_PARAMS)[keyof typeof SEARCH_PARAMS]

/** The history entry an open overlay pushed carries this key in its state, so the back button closes the overlay (D-332). */
export const OVERLAY_HISTORY_KEY = 'overlay'
