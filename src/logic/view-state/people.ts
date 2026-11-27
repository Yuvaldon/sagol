import { useCallback, useMemo } from 'react'
import type { BoardGrouping } from './grouping'
import { PeopleOptions, type PeopleSort } from './peopleOptions'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The options of the list of "חיילים" (D-482), in the URL like every view's (D-023): the order, the grouping, whether the
// inactive soldiers show, and whether each row shows its next days. Each holds only what differs from the default, so a
// plain list leaves the address bare.

export interface PeopleView {
  readonly sort: PeopleSort
  /** The grouping asked for; absent, the list's default for what it covers. */
  readonly group: BoardGrouping | undefined
  readonly inactive: boolean
  /** Whether each row shows its next days. */
  readonly days: boolean
}

export interface PeopleViewState extends PeopleView {
  setSort(sort: PeopleSort): void
  setGroup(group: BoardGrouping): void
  setInactive(inactive: boolean): void
  setDays(days: boolean): void
}

/** The list's options as the URL holds them, and their setters. */
export function usePeopleView(): PeopleViewState {
  const held = useWorkspaceSearch().people
  const change = useChangeSearch()
  const write = useCallback(
    (next: Partial<PeopleOptions>) => {
      change((current) => {
        const merged: Record<string, unknown> = { ...current.people, ...next }
        const kept = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined))
        return { people: Object.keys(kept).length === 0 ? undefined : PeopleOptions.parse(kept) }
      })
    },
    [change],
  )
  return useMemo(
    () => ({
      sort: held?.sort ?? 'rank',
      group: held?.group,
      inactive: held?.inactive === true,
      days: held?.days !== false,
      setSort: (sort: PeopleSort) => {
        write({ sort: sort === 'name' ? 'name' : undefined })
      },
      setGroup: (group: BoardGrouping) => {
        write({ group })
      },
      setInactive: (inactive: boolean) => {
        write({ inactive: inactive ? true : undefined })
      },
      setDays: (days: boolean) => {
        write({ days: days ? undefined : false })
      },
    }),
    [held, write],
  )
}
