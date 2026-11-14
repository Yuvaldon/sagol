import type { ViewId } from '@config'
import { SAVED_VIEW_LIMITS, SavedViewId, type SavedView, type SavedViewQuery, type SoldierPreferences } from '@contracts'
import { useCallback, useMemo, useState } from 'react'
import { useMyPreferences, useUpdateMyPreferences, type PreferenceSaved } from '../session/preferences'
import { applyView, captureView, matchingView, type AppliedView } from './savedViews'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The soldier's saved views (D-384 … D-388). Each change is a function of the stored list, so a save that meets a
// change from another device is computed again over it (D-388); the list shows the change at once, over the row it was
// made on only, so once the stored row moves on (the save landed, or another device saved) that row says what is true.

type ListChange = (stored: SoldierPreferences) => Pick<SoldierPreferences, 'saved_views' | 'start_view_id'>

/** A change still saving, and the stored row it was made on. */
interface Pending {
  readonly change: ListChange
  readonly over: SoldierPreferences | null
}

export interface SavedViewsState {
  /** FALSE until the preferences are read: nothing of saved views is offered before (D-076). */
  readonly available: boolean
  readonly views: readonly SavedView[]
  readonly startViewId: SavedViewId | null
  /** The saved view the board shows now (D-385). */
  readonly current: SavedView | null
  /**
   * The saved view the board was put in and has since drifted from by a change, while it still exists; NULL while the
   * board shows a saved view, or came from none (D-442).
   */
  readonly left: SavedView | null
  /** TRUE at the limit: no view is saved until one is deleted (D-387). */
  readonly full: boolean
  /** Saves the board as it is now, as a new view; `start` makes it the start view. */
  save(name: string, start: boolean): Promise<PreferenceSaved>
  /** Saves the board as it is now over the view it drifted from, under the same name (D-442). */
  overwrite(id: SavedViewId): Promise<PreferenceSaved>
  /** Puts the board in the view's state, in the current history entry (D-385). */
  apply(view: SavedView): AppliedView
  /** Stores a view's query anew: the cleaned one after a part was dropped (D-385). */
  setQuery(id: SavedViewId, query: SavedViewQuery): Promise<PreferenceSaved>
  rename(id: SavedViewId, name: string): Promise<PreferenceSaved>
  /** Moves a view one place up (-1) or down (1). */
  move(id: SavedViewId, delta: -1 | 1): Promise<PreferenceSaved>
  /** Deletes a view; the start view, deleted, leaves none (D-386). */
  remove(id: SavedViewId): Promise<PreferenceSaved>
  setStart(id: SavedViewId | null): Promise<PreferenceSaved>
}

function listOf(stored: SoldierPreferences, views: readonly SavedView[]): Pick<SoldierPreferences, 'saved_views' | 'start_view_id'> {
  const start = views.some((view) => view.id === stored.start_view_id) ? stored.start_view_id : null
  return { saved_views: [...views], start_view_id: start }
}

function moved(views: readonly SavedView[], id: SavedViewId, delta: -1 | 1): readonly SavedView[] {
  const from = views.findIndex((view) => view.id === id)
  const to = from + delta
  const target = views[to]
  const source = views[from]
  if (from < 0 || source === undefined || target === undefined) return views
  const next = [...views]
  next[to] = source
  next[from] = target
  return next
}

/** `view` is the view the board shows, the device's default included, as `useActiveView` answers it. */
export function useSavedViews(view: ViewId): SavedViewsState {
  const preferences = useMyPreferences()
  const update = useUpdateMyPreferences()
  const search = useWorkspaceSearch()
  const changeSearch = useChangeSearch()
  const [pending, setPending] = useState<readonly Pending[]>([])
  const stored = preferences.status === 'ready' ? preferences.value : null
  const shown = useMemo(
    () =>
      stored === null
        ? null
        : pending
            .filter((item) => item.over === stored)
            .reduce<SoldierPreferences>((list, item) => ({ ...list, ...item.change(list) }), stored),
    [stored, pending],
  )
  const views = useMemo(() => shown?.saved_views ?? [], [shown])
  const current = useMemo(() => matchingView(views, search, view), [views, search, view])
  const left = useMemo(
    () => (current === null ? (views.find((saved) => saved.id === search.saved) ?? null) : null),
    [current, views, search.saved],
  )

  const { run } = update
  const change = useCallback(
    async (next: ListChange): Promise<PreferenceSaved> => {
      const item: Pending = { change: next, over: stored }
      setPending((list) => [...list, item])
      try {
        return await run(next)
      } finally {
        setPending((list) => list.filter((other) => other !== item))
      }
    },
    [run, stored],
  )

  const save = useCallback(
    (name: string, start: boolean) => {
      const id = SavedViewId.parse(crypto.randomUUID())
      const query = captureView(search, view)
      // The board now shows the new view, so a later change is saved over it (D-442).
      changeSearch({ saved: id })
      return change((list) => ({
        saved_views: [...list.saved_views, { id, name: name.trim(), query }],
        start_view_id: start ? id : list.start_view_id,
      }))
    },
    [change, changeSearch, search, view],
  )
  const apply = useCallback(
    (saved: SavedView) => {
      const applied = applyView(saved.query)
      changeSearch({ ...applied.search, saved: saved.id })
      return applied
    },
    [changeSearch],
  )
  const edit = useCallback(
    (id: SavedViewId, edited: (saved: SavedView) => SavedView) =>
      change((list) => listOf(list, list.saved_views.map((saved) => (saved.id === id ? edited(saved) : saved)))),
    [change],
  )
  const setQuery = useCallback((id: SavedViewId, query: SavedViewQuery) => edit(id, (saved) => ({ ...saved, query })), [edit])
  const overwrite = useCallback((id: SavedViewId) => setQuery(id, captureView(search, view)), [setQuery, search, view])
  const rename = useCallback((id: SavedViewId, name: string) => edit(id, (saved) => ({ ...saved, name: name.trim() })), [edit])
  const move = useCallback(
    (id: SavedViewId, delta: -1 | 1) => change((list) => listOf(list, moved(list.saved_views, id, delta))),
    [change],
  )
  const remove = useCallback(
    (id: SavedViewId) => change((list) => listOf(list, list.saved_views.filter((saved) => saved.id !== id))),
    [change],
  )
  const setStart = useCallback(
    (id: SavedViewId | null) => change((list) => ({ saved_views: list.saved_views, start_view_id: id })),
    [change],
  )

  return {
    available: shown !== null,
    views,
    startViewId: shown?.start_view_id ?? null,
    current,
    left,
    full: views.length >= SAVED_VIEW_LIMITS.max,
    save,
    apply,
    overwrite,
    setQuery,
    rename,
    move,
    remove,
    setStart,
  }
}

export interface StartView {
  /** TRUE once the preferences answered, read or failed: until then a bare open waits for its start view (D-386). */
  readonly settled: boolean
  /** Puts the board in the start view's state, when there is one; answers whether there was. */
  open(): boolean
}

/** The start view a bare open of the board starts on (D-386). */
export function useStartView(): StartView {
  const preferences = useMyPreferences()
  const changeSearch = useChangeSearch()
  const stored = preferences.status === 'ready' ? preferences.value : null
  const start = stored?.saved_views.find((saved) => saved.id === stored.start_view_id) ?? null
  const open = useCallback(() => {
    if (start === null) return false
    changeSearch({ ...applyView(start.query).search, saved: start.id })
    return true
  }, [start, changeSearch])
  return { settled: preferences.status !== 'loading', open }
}
