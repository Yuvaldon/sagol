import { DEFAULT_TAB, PAGE_TABS, type PageId, type TabId } from '@config'
import type { PermissionCheck } from '@contracts'
import { LEAVE_PERMISSIONS } from '@domain'
import { useCallback, useMemo } from 'react'
import { useMyLeavesAccess } from '../leaves/workflowHooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { useSoldiers } from '../roster/hooks'
import { useSession } from '../session/hooks'
import { useRotationScope } from '../view-state/rotation'
import { useChangeSearch, useWorkspaceSearch } from '../view-state/search'

// The shell of the new interface (D-455): where the actor is among its destinations, and which of them their
// permissions open. No role's name is read: "לוח" is for who reads the leaves of a soldier other than themself, and the
// action circle is for who may request a leave for themself while a rotation takes requests (D-218).

export interface ShellPlace {
  /** The destination in the URL; "היום" when it names none. */
  readonly tab: TabId
  /** The page open over the destination; NULL with none, and for a page of another destination. */
  readonly page: PageId | null
  /** Moves to a destination, on its first screen. */
  openTab(tab: TabId): void
  /** Opens a page, on the destination it belongs to. */
  openPage(page: PageId): void
  closePage(): void
}

/** The destination and the page (D-455, D-459). A change replaces the history entry, as every view change does (D-332). */
export function useShellPlace(): ShellPlace {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const tab = search.tab ?? DEFAULT_TAB
  const page = search.page !== undefined && PAGE_TABS[search.page] === tab ? search.page : null
  const openTab = useCallback(
    (next: TabId) => {
      change({ tab: next === DEFAULT_TAB ? undefined : next, page: undefined })
    },
    [change],
  )
  const openPage = useCallback(
    (next: PageId) => {
      const owner = PAGE_TABS[next]
      change({ tab: owner === DEFAULT_TAB ? undefined : owner, page: next })
    },
    [change],
  )
  const closePage = useCallback(() => {
    change({ page: undefined })
  }, [change])
  return useMemo(() => ({ tab, page, openTab, openPage, closePage }), [tab, page, openTab, openPage, closePage])
}

export interface ShellAccess {
  /** Whether every answer has arrived; until then no optional destination shows. */
  readonly ready: boolean
  /** "לוח": the actor reads the leaves of at least one soldier other than themself. */
  readonly board: boolean
  /** The action circle: the actor may request a leave for themself, and a rotation takes requests. */
  readonly requestsForSelf: boolean
}

const NO_CHECKS: readonly PermissionCheck[] = []

export function useShellAccess(): ShellAccess {
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const soldiers = useSoldiers()
  const seen = soldiers.status === 'ready' ? soldiers.value : null
  const checks = useMemo(
    () =>
      seen === null
        ? NO_CHECKS
        : seen.filter((soldier) => soldier.id !== own).map((soldier) => checkOn(LEAVE_PERMISSIONS.view, soldier.id)),
    [seen, own],
  )
  const { can, known } = useCanAnswers(checks)
  const mine = useMyLeavesAccess()
  const scope = useRotationScope()
  const ready = session.status === 'ready' && soldiers.status !== 'loading' && checks.every(known) && scope.ready
  return useMemo(
    () => ({
      ready,
      board: ready && checks.some(can),
      requestsForSelf: ready && mine?.create === true && scope.requests,
    }),
    [ready, checks, can, mine, scope.requests],
  )
}
