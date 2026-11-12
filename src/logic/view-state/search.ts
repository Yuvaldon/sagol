import { BarColorMode, NEW_ENTITY, PanelId, QUICK_ENTRY, ROUTES, RangeKind, SEARCH_PARAMS, SortKey, SortOrder, ViewId } from '@config'
import { CalendarDate, DeploymentId, FilterExpression, UnitId } from '@contracts'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'
import { LeaveConditions } from './conditions'
import { NewLeaveDraft } from './draft'
import { SortRules } from './sort-rules'

// All view state lives in the URL (D-023): the view, the date window and its kind (D-211), the sort rules (D-313) and the table's sort (D-214), the
// filter and the board's own conditions (D-132, D-133), the bar colors, the open panel, the presence day and the report's last day (D-134, D-193) and a new leave's draft (D-143). A
// value that is not valid here counts as absent: a URL never breaks the workspace, and it never gets
// anyone past the adapter.

/** The search params of the workspace route. `app` hands this to the router. */
export const WorkspaceSearch = z.object({
  [SEARCH_PARAMS.view]: ViewId.optional().catch(undefined),
  [SEARCH_PARAMS.from]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.to]: CalendarDate.optional().catch(undefined),
  [SEARCH_PARAMS.range]: RangeKind.optional().catch(undefined),
  [SEARCH_PARAMS.rotation]: DeploymentId.optional().catch(undefined),
  [SEARCH_PARAMS.sorts]: SortRules.optional().catch(undefined),
  [SEARCH_PARAMS.sort]: SortKey.optional().catch(undefined),
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
})
export type WorkspaceSearch = z.infer<typeof WorkspaceSearch>

/** The workspace search as it is now, validated. */
export function useWorkspaceSearch(): WorkspaceSearch {
  const raw = useSearch({ strict: false })
  return useMemo(() => WorkspaceSearch.parse(raw), [raw])
}

/**
 * Changes some params and keeps the others, as a new history entry, so the back button undoes it. A key
 * set to `undefined` is removed.
 */
export function useChangeSearch(): (changes: Partial<WorkspaceSearch>) => void {
  const current = useWorkspaceSearch()
  const navigate = useNavigate()
  return useCallback(
    (changes) => {
      const next: WorkspaceSearch = { ...current, ...changes }
      void navigate({ to: ROUTES.workspace, search: next })
    },
    [current, navigate],
  )
}
