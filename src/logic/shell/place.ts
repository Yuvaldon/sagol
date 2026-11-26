import { DEFAULT_TAB, PAGE_TABS, type PageId, type TabId } from '@config'
import type { PermissionCheck } from '@contracts'
import { LEAVE_PERMISSIONS } from '@domain'
import { useCallback, useMemo } from 'react'
import { useQuickAction } from '../home/quickAction'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { useSoldiers } from '../roster/hooks'
import { useSession } from '../session/hooks'
import { useRotationScope } from '../view-state/rotation'
import { useChangeSearch, useWorkspaceSearch, type WorkspaceSearch } from '../view-state/search'

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

/** What an address says of the board itself: its view, its dates, its order and its conditions. */
const BOARD_PARAMS = ['view', 'from', 'to', 'range', 'rotation', 'sorts', 'sort', 'order', 'group', 'filter', 'colors', 'leaves', 'missing', 'saved'] as const satisfies readonly (keyof WorkspaceSearch)[]

/** Whether the address names something of the board: a link to a view of it is a link to the board. */
function namesBoard(search: WorkspaceSearch): boolean {
  return BOARD_PARAMS.some((param) => search[param] !== undefined)
}

/** How a destination is written: "היום" is the address that names none, unless the address names the board. */
function tabParam(tab: TabId, search: WorkspaceSearch): TabId | undefined {
  return tab === DEFAULT_TAB && !namesBoard(search) ? undefined : tab
}

/**
 * The destination and the page (D-455, D-459). An address that names no destination shows "היום", and the board when
 * it names a view, a range or a condition of it, so a link to a board still opens it. A change replaces the history
 * entry, as every view change does (D-332).
 */
export function useShellPlace(): ShellPlace {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const tab = search.tab ?? (namesBoard(search) ? 'board' : DEFAULT_TAB)
  const page = search.page !== undefined && PAGE_TABS[search.page] === tab ? search.page : null
  const openTab = useCallback(
    (next: TabId) => {
      change((current) => ({ tab: tabParam(next, current), page: undefined }))
    },
    [change],
  )
  const openPage = useCallback(
    (next: PageId) => {
      change((current) => ({ tab: tabParam(PAGE_TABS[next], current), page: next }))
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
  /** "לוח": the actor reads the leaves of a soldier other than themself, or holds that over a unit. */
  readonly board: boolean
  /** The action circle: the actor may request a leave for themself, and a rotation that has not ended takes requests (D-266). */
  readonly requestsForSelf: boolean
}

const NO_CHECKS: readonly PermissionCheck[] = []

/** Reading the leaves of some unit (D-362): who holds it reads the leaves of others, also before another soldier exists. */
const A_UNIT: PermissionCheck = { permission: LEAVE_PERMISSIONS.view, target: { kind: 'some_unit' } }

export function useShellAccess(): ShellAccess {
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const soldiers = useSoldiers()
  const seen = soldiers.status === 'ready' ? soldiers.value : null
  const checks = useMemo(
    () =>
      seen === null
        ? NO_CHECKS
        : [A_UNIT, ...seen.filter((soldier) => soldier.id !== own).map((soldier) => checkOn(LEAVE_PERMISSIONS.view, soldier.id))],
    [seen, own],
  )
  const { can, known } = useCanAnswers(checks)
  const action = useQuickAction()
  const scope = useRotationScope()
  const ready = session.status === 'ready' && soldiers.status !== 'loading' && checks.every(known) && scope.ready
  return useMemo(
    () => ({
      ready,
      board: ready && checks.some(can),
      requestsForSelf: ready && action === 'new_leave',
    }),
    [ready, checks, can, action],
  )
}
