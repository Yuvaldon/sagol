import {
  OrganizationId,
  SavedViewId,
  SoldierId,
  SoldierPreferences,
  type Result,
  type SoldierPreferencesRecord,
  type UpdateMyPreferencesInput,
} from '@contracts'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { allowEverything, fakePorts, wrapperOf } from '../testing/ports'
import { useSavedViews, useStartView, type SavedViewsState, type StartView } from './savedViewsState'
import { WorkspaceSearch, useWorkspaceSearch } from './search'

// Sample values, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const AT = '2026-11-13T10:00:00.000Z'

/** A store with one row that answers `stale_version` at the wrong version, as the adapters do. */
function storeOf() {
  let row: SoldierPreferencesRecord | null = null
  const write = (preferences: unknown) => {
    row = {
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences: SoldierPreferences.parse(preferences),
      updated_at: AT,
      version: (row?.version ?? 0) + 1,
    }
    return row
  }
  const updateMyPreferences = vi.fn((request: UpdateMyPreferencesInput): Promise<Result<SoldierPreferencesRecord>> => {
    if (request.expected_version !== (row?.version ?? null)) return Promise.resolve({ ok: false, error: { code: 'stale_version' } })
    return Promise.resolve({ ok: true, value: write(request.preferences) })
  })
  const ports = fakePorts({
    session: {
      current: () => Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION } }),
      can: allowEverything,
    },
    repositories: { soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: row }) } },
    commands: { accounts: { updateMyPreferences } },
    now: () => AT,
  })
  /** Another device saves over the stored row. */
  const elsewhere = (change: (stored: SoldierPreferences) => Partial<SoldierPreferences>) => {
    const stored = row?.preferences ?? SoldierPreferences.parse({})
    write({ ...stored, ...change(stored) })
  }
  return { ports, updateMyPreferences, elsewhere, stored: () => row?.preferences ?? null }
}

interface Handles {
  views: SavedViewsState
  start: StartView
}

async function renderAt(entry: string, ports: ReturnType<typeof storeOf>['ports']) {
  const handles: Partial<Handles> = {}
  function Probe() {
    const search = useWorkspaceSearch()
    Object.assign(handles, { views: useSavedViews(search.view ?? 'timeline'), start: useStartView() })
    return <div data-testid="search">{JSON.stringify(search)}</div>
  }
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
  const history = createMemoryHistory({ initialEntries: [entry] })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  const Wrapper = wrapperOf(ports)
  render(
    <Wrapper>
      <RouterProvider router={router as never} />
    </Wrapper>,
  )
  await screen.findByTestId('search')
  const views = () => handles.views as SavedViewsState
  await waitFor(() => {
    expect(views().available).toBe(true)
  })
  return { views, start: () => handles.start as StartView, shown: () => WorkspaceSearch.parse(JSON.parse(screen.getByTestId('search').textContent)) }
}

describe('saved views (D-384, D-388)', () => {
  it('saves the board, finds it as the current view, and opens it again over a changed board', async () => {
    const store = storeOf()
    const { views, shown } = await renderAt('/?view=list&missing=true&from=2026-11-01', store.ports)
    expect(views().current).toBeNull()
    await act(async () => {
      await views().save('  בוקר ', true)
    })
    expect(store.stored()?.saved_views.map((view) => view.name)).toEqual(['בוקר'])
    expect(store.stored()?.start_view_id).toBe(views().views[0]?.id)
    expect(views().current?.name).toBe('בוקר')
    const saved = views().views[0]
    if (saved === undefined) throw new Error('no view')
    act(() => {
      views().apply(saved)
    })
    await waitFor(() => {
      expect(shown()).toMatchObject({ view: 'list', missing: true })
    })
    expect(shown().from).toBeUndefined()
  })

  it('moves, renames and deletes; deleting the start view leaves none', async () => {
    const store = storeOf()
    const { views } = await renderAt('/?view=list', store.ports)
    await act(async () => {
      await views().save('א', false)
      await views().save('ב', true)
    })
    const [first, second] = views().views
    if (first === undefined || second === undefined) throw new Error('no views')
    await act(async () => {
      await views().move(second.id, -1)
      await views().rename(first.id, 'ג')
    })
    expect(store.stored()?.saved_views.map((view) => view.name)).toEqual(['ב', 'ג'])
    await act(async () => {
      await views().remove(second.id)
    })
    expect(store.stored()?.saved_views.map((view) => view.name)).toEqual(['ג'])
    expect(store.stored()?.start_view_id).toBeNull()
  })

  it('computes a list change again over a change made elsewhere (D-388)', async () => {
    const store = storeOf()
    const { views } = await renderAt('/?view=list', store.ports)
    await act(async () => {
      await views().save('א', false)
    })
    store.elsewhere(() => ({ appearance: 'dark' }))
    let saved: Awaited<ReturnType<SavedViewsState['save']>> | undefined
    await act(async () => {
      saved = await views().save('ב', false)
    })
    expect(saved?.ok).toBe(true)
    expect(store.stored()).toMatchObject({ appearance: 'dark' })
    expect(store.stored()?.saved_views.map((view) => view.name)).toEqual(['א', 'ב'])
  })
})

describe('the start view (D-386)', () => {
  it('opens the start view when there is one, and answers when there is none', async () => {
    const store = storeOf()
    const { views, start, shown } = await renderAt('/', store.ports)
    expect(start().settled).toBe(true)
    expect(start().open()).toBe(false)
    store.elsewhere(() => ({ saved_views: [{ id: SavedViewId.parse(uuid(1)), name: 'בוקר', query: { view: '"calendar"', range: '"month"' } }], start_view_id: null }))
    // Saved over the row read before the change elsewhere: computed again over it (D-388).
    await act(async () => {
      await views().setStart(SavedViewId.parse(uuid(1)))
    })
    await waitFor(() => {
      expect(views().startViewId).toBe(uuid(1))
    })
    act(() => {
      start().open()
    })
    await waitFor(() => {
      expect(shown()).toMatchObject({ view: 'calendar', range: 'month' })
    })
  })
})
