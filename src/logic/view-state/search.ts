import { BarColorMode, BoardSortKey, DEFAULT_SORT_ORDER, NEW_ENTITY, PanelId, QUICK_ENTRY, ROUTES, RangeKind, SEARCH_PARAMS, SortOrder, TableSortKey, ViewId } from '@config'
import { CalendarDate, DeploymentId, FilterExpression, SavedViewId, UnitId } from '@contracts'
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'
import { LeaveConditions } from './conditions'
import { NewLeaveDraft } from './draft'
import { isOverlayEntry, overlayState } from './overlay'
import { SortRules, isDefaultSort } from './sort-rules'

// All view state lives in the URL (D-023): the view, the date window and its kind (D-211), the sort rules (D-313) and the table's sort (D-214), the
// filter and the board's own conditions (D-132, D-133), the bar colors, the open panel, the presence day and the report's last day (D-134, D-193), a new leave's draft (D-143), the dashboard's unit and planned days (D-349) and the saved view the board came from (D-442). A
// value that is not valid here counts as absent: a URL never breaks the workspace, and it never gets
// anyone past the adapter.

const WorkspaceSearchFields = z.object({
  [SEARCH_PARAMS.view]: ViewId.optional().catch(undefined),
  [SEARCH_PARAMS.from]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.to]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.range]: RangeKind.optional().catch(undefined),
  [SEARCH_PARAMS.rotation]: DeploymentId.optional().catch(undefined),
  [SEARCH_PARAMS.sorts]: SortRules.optional().catch(undefined),
  // A board key here is a link from before D-313; it is read as the sort rules below (OI-264).
  [SEARCH_PARAMS.sort]: z.union([TableSortKey, BoardSortKey]).optional().catch(undefined),
  [SEARCH_PARAMS.order]: SortOrder.optional().catch(undefined),
  [SEARCH_PARAMS.filter]: FilterExpression.optional().catch(undefined),
  [SEARCH_PARAMS.panel]: PanelId.optional().catch(undefined),
  [SEARCH_PARAMS.entity]: z
    .union([z.literal(NEW_ENTITY), z.literal(QUICK_ENTRY), z.uuid()])
    .optional()
    .catch(undefined),
  [SEARCH_PARAMS.parent]: UnitId.optional().catch(undefined),
  [SEARCH_PARAMS.colors]: BarColorMode.optional().catch(undefined),
  [SEARCH_PARAMS.leaves]: LeaveConditions.optional().catch(undefined),
  [SEARCH_PARAMS.missing]: z.literal(true).optional().catch(undefined),
  [SEARCH_PARAMS.day]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.until]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.draft]: NewLeaveDraft.optional().catch(undefined),
  // The dashboard's unit and "כולל מתוכנן" (D-349); its span is the window above.
  [SEARCH_PARAMS.unit]: UnitId.optional().catch(undefined),
  [SEARCH_PARAMS.planned]: z.literal(true).optional().catch(undefined),
  // The saved view the board was last put in (D-442); one the soldier does not hold is ignored where it is read.
  [SEARCH_PARAMS.saved]: SavedViewId.optional().catch(undefined),
})
type WorkspaceSearchFields = z.infer<typeof WorkspaceSearchFields>

/**
 * `sort` holds a leave column of the table. A link from before D-313 held a board key there, which is the board's one
 * sort rule, read so when the link names no `sorts` (D-324).
 */
function withBoardSort(search: WorkspaceSearchFields): Omit<WorkspaceSearchFields, 'sort'> & { sort?: TableSortKey | undefined } {
  const { sort, ...rest } = search
  const table = TableSortKey.safeParse(sort)
  if (table.success) return { ...rest, sort: table.data }
  const { order, ...others } = rest
  const board = BoardSortKey.safeParse(sort)
  if (!board.success || rest.sorts !== undefined) return board.success ? others : rest
  const sorts = [{ key: board.data, order: order ?? DEFAULT_SORT_ORDER[board.data] }]
  return isDefaultSort(sorts) ? others : { ...others, sorts }
}

/** The search params of the workspace route. `app` hands this to the router. */
export const WorkspaceSearch = WorkspaceSearchFields.transform(withBoardSort)
export type WorkspaceSearch = z.infer<typeof WorkspaceSearch>

/** The workspace search as it is now, validated. */
export function useWorkspaceSearch(): WorkspaceSearch {
  const raw = useSearch({ strict: false })
  return useMemo(() => WorkspaceSearch.parse(raw), [raw])
}

/** A change of the search: the params to set, or a function of the search as it is when the change is written. */
export type SearchChange = Partial<WorkspaceSearch> | ((current: WorkspaceSearch) => Partial<WorkspaceSearch>)

/**
 * Changes some params and keeps the others, in place of the current history entry: the back button leaves the
 * screen, it does not replay its view changes (D-332). Opening a panel where none is open is the one change that adds
 * an entry, the overlay's, which the back button consumes by closing it; an overlay's entry keeps its mark through the
 * changes made on it. A key set to `undefined` is removed.
 *
 * Each change is written over the router's search as it is when the change is made, never over the search this
 * render read: two changes in one gesture both land (OI-330, D-440).
 */
export function useChangeSearch(): (change: SearchChange) => void {
  const navigate = useNavigate()
  const router = useRouter()
  return useCallback(
    (change) => {
      const current = WorkspaceSearch.parse(router.latestLocation.search)
      const changes = typeof change === 'function' ? change(current) : change
      const next: WorkspaceSearch = { ...current, ...changes }
      const opens = current.panel === undefined && next.panel !== undefined && !isOverlayEntry(router.history.location)
      void navigate({ to: ROUTES.workspace, search: next, replace: !opens, state: opens ? overlayState() : true })
    },
    [navigate, router],
  )
}
