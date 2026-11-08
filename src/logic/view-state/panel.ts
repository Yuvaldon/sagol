import { NEW_ENTITY, PanelId, ROUTES, SEARCH_PARAMS } from '@config'
import { UnitId } from '@contracts'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'

// The open panel lives in the URL, so a deep link reopens it and the back button works (D-023,
// D-092). A value that is not valid here counts as absent: a URL never breaks the workspace, and it
// never gets anyone past the adapter.

/** The search params of the workspace route. `app` hands this to the router. */
export const WorkspaceSearch = z.object({
  [SEARCH_PARAMS.panel]: PanelId.optional().catch(undefined),
  [SEARCH_PARAMS.entity]: z
    .union([z.literal(NEW_ENTITY), z.uuid()])
    .optional()
    .catch(undefined),
  [SEARCH_PARAMS.parent]: UnitId.optional().catch(undefined),
})
export type WorkspaceSearch = z.infer<typeof WorkspaceSearch>

export interface PanelTarget {
  readonly entity?: string
  readonly parent?: UnitId
}

export interface PanelState {
  readonly panel: PanelId | null
  /** A row id or `NEW_ENTITY`. NULL shows the panel's list. */
  readonly entity: string | null
  /** The parent chosen for a new unit. */
  readonly parent: UnitId | null
  open(panel: PanelId, target?: PanelTarget): void
  close(): void
}

export function usePanel(): PanelState {
  const raw = useSearch({ strict: false })
  const navigate = useNavigate()
  const search = useMemo(() => WorkspaceSearch.parse(raw), [raw])

  const open = useCallback(
    (panel: PanelId, target: PanelTarget = {}) => {
      const next: WorkspaceSearch = { panel, entity: target.entity, parent: target.parent }
      void navigate({ to: ROUTES.workspace, search: next })
    },
    [navigate],
  )
  const close = useCallback(() => {
    const next: WorkspaceSearch = {}
    void navigate({ to: ROUTES.workspace, search: next })
  }, [navigate])

  return {
    panel: search.panel ?? null,
    entity: search.entity ?? null,
    parent: search.parent ?? null,
    open,
    close,
  }
}
