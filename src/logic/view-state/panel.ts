import type { PanelId } from '@config'
import type { UnitId } from '@contracts'
import { useCallback } from 'react'
import type { NewLeaveDraft } from './draft'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The open panel lives in the URL, so a deep link reopens it and the back button works (D-023,
// D-092). Opening or closing it keeps the view, the window and the filter (D-103). A new leave's draft goes with the
// panel that opens with it, and leaves with any other (D-143).

export interface PanelTarget {
  readonly entity?: string
  readonly parent?: UnitId
  /** The soldier and days a drag marked, for the new-leave form (D-143). */
  readonly draft?: NewLeaveDraft
}

export interface PanelState {
  readonly panel: PanelId | null
  /** A row id or `NEW_ENTITY`. NULL shows the panel's list. */
  readonly entity: string | null
  /** The parent chosen for a new unit. */
  readonly parent: UnitId | null
  /** What the new-leave form starts from, when a drag opened it (D-143). */
  readonly draft: NewLeaveDraft | null
  open(panel: PanelId, target?: PanelTarget): void
  close(): void
}

export function usePanel(): PanelState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()

  const open = useCallback(
    (panel: PanelId, target: PanelTarget = {}) => {
      change({ panel, entity: target.entity, parent: target.parent, draft: target.draft })
    },
    [change],
  )
  const close = useCallback(() => {
    change({ panel: undefined, entity: undefined, parent: undefined, draft: undefined })
  }, [change])

  return {
    panel: search.panel ?? null,
    entity: search.entity ?? null,
    parent: search.parent ?? null,
    draft: search.draft ?? null,
    open,
    close,
  }
}
