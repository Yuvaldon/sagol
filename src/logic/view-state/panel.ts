import type { PanelId } from '@config'
import type { UnitId } from '@contracts'
import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { NewLeaveDraft } from './draft'
import { layersAbove } from './layers'
import { leaveOverlayEntry } from './overlay'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The open panel lives in the URL, so a deep link reopens it and the back button closes it (D-023, D-092, D-332).
// Opening or closing it keeps the view, the window and the filter (D-103). A new leave's draft goes with the
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
  /** Closes the panel for an overlay that opens in its place, such as the navigation panel, and leaves it the entry. */
  handOver(): void
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
  const router = useRouter()
  // A panel that added its entry takes it back as it closes, so the back button never reopens it (D-332); the
  // workspace's history keeps what changed while it was open. A panel opened by a link has no entry of its own. A menu
  // or a dialog open over the panel as it closes takes its entries with it (D-336).
  const close = useCallback(() => {
    const { history } = router
    const { count, overOverlay } = layersAbove(history)
    if (overOverlay) {
      leaveOverlayEntry(history, count + 1)
      return
    }
    change({ panel: undefined, entity: undefined, parent: undefined, draft: undefined })
    if (count > 0) leaveOverlayEntry(history, count)
  }, [change, router])
  const handOver = useCallback(() => {
    change({ panel: undefined, entity: undefined, parent: undefined, draft: undefined })
  }, [change])

  return {
    panel: search.panel ?? null,
    entity: search.entity ?? null,
    parent: search.parent ?? null,
    draft: search.draft ?? null,
    open,
    close,
    handOver,
  }
}
