import type { PanelId } from '@config'
import type { UnitId } from '@contracts'
import { useCallback } from 'react'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The open panel lives in the URL, so a deep link reopens it and the back button works (D-023,
// D-092). Opening or closing it keeps the view, the window and the filter (D-103).

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
  const search = useWorkspaceSearch()
  const change = useChangeSearch()

  const open = useCallback(
    (panel: PanelId, target: PanelTarget = {}) => {
      change({ panel, entity: target.entity, parent: target.parent })
    },
    [change],
  )
  const close = useCallback(() => {
    change({ panel: undefined, entity: undefined, parent: undefined })
  }, [change])

  return {
    panel: search.panel ?? null,
    entity: search.entity ?? null,
    parent: search.parent ?? null,
    open,
    close,
  }
}
