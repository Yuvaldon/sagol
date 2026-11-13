import { PANEL_IDS } from '@config'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOverlayEntry, useOverlayHistory, type OverlayEntry } from './history'
import { usePanel, type PanelState } from './panel'
import { WorkspaceSearch, useChangeSearch, useWorkspaceSearch } from './search'

// The back button leaves the current state and never replays the actions that led to it (D-332).

interface Handles {
  panel: PanelState
  change: ReturnType<typeof useChangeSearch>
  search: WorkspaceSearch
  entry: OverlayEntry
}

async function renderAt(url: string, onBack: () => void = () => undefined) {
  const handles: Partial<Handles> = {}
  function Probe() {
    useOverlayHistory()
    handles.panel = usePanel()
    handles.change = useChangeSearch()
    handles.search = useWorkspaceSearch()
    handles.entry = useOverlayEntry(onBack)
    return <div data-testid="search">{JSON.stringify(handles.search)}</div>
  }
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  render(<RouterProvider router={router as never} />)
  await screen.findByTestId('search')
  return { history, handles: handles as Handles }
}

const position = (history: RouterHistory) => history.location.state.__TSR_index
const shown = () => JSON.parse(screen.getByTestId('search').textContent) as WorkspaceSearch

async function step(run: () => void) {
  await act(async () => {
    run()
    await Promise.resolve()
  })
}

describe('history entries (D-332)', () => {
  it('a view, window or filter change replaces the entry it happens on', async () => {
    const { history, handles } = await renderAt('/?view=table')
    const start = position(history)
    await step(() => {
      handles.change({ view: 'timeline' })
    })
    await step(() => {
      handles.change({ from: '2026-11-15' })
    })
    expect(shown()).toMatchObject({ view: 'timeline', from: '2026-11-15' })
    expect(position(history)).toBe(start)
  })

  it('a panel adds one entry, which the back button consumes by closing it', async () => {
    const { history, handles } = await renderAt('/?view=table')
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    await step(() => {
      handles.panel.open(PANEL_IDS.units)
    })
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('a panel closed by its own button takes its entry back, with what changed while it was open', async () => {
    const { history, handles } = await renderAt('/?view=table')
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    await step(() => {
      handles.change({ from: '2026-11-15' })
    })
    await step(() => {
      handles.panel.close()
    })
    expect(shown()).toMatchObject({ view: 'table', from: '2026-11-15' })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('a panel opened by a link closes in place, with no entry of its own', async () => {
    const { history, handles } = await renderAt('/?panel=soldiers')
    const start = position(history)
    await step(() => {
      handles.panel.close()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('an overlay outside the URL holds one entry: the back button closes it, its own close takes it back', async () => {
    const onBack = vi.fn()
    const { history, handles } = await renderAt('/?view=table', onBack)
    const start = position(history)
    await step(() => {
      handles.entry.enter()
    })
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(onBack).toHaveBeenCalledOnce()
    expect(position(history)).toBe(start)

    await step(() => {
      handles.entry.enter()
    })
    await step(() => {
      handles.entry.leave()
    })
    expect(position(history)).toBe(start)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('a module chosen in the overlay opens on its entry, so one back press closes it', async () => {
    const onBack = vi.fn()
    const { history, handles } = await renderAt('/?view=table', onBack)
    const start = position(history)
    await step(() => {
      handles.entry.enter()
    })
    await step(() => {
      handles.entry.handOff(() => {
        handles.panel.open(PANEL_IDS.soldiers)
      })
    })
    expect(shown().panel).toBe(PANEL_IDS.soldiers)
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('a choice in the overlay that opens no panel takes the overlay entry back', async () => {
    const { history, handles } = await renderAt('/?view=table')
    const start = position(history)
    await step(() => {
      handles.entry.enter()
    })
    await step(() => {
      handles.entry.handOff(() => {
        handles.change({ view: 'timeline' })
      })
    })
    expect(shown().view).toBe('timeline')
    expect(position(history)).toBe(start)
  })

  it('a panel closed twice before the history answers leaves only its own entry', async () => {
    const { history, handles } = await renderAt('/?view=table')
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    const start = position(history) - 1
    const back = vi.spyOn(history, 'back')
    await step(() => {
      handles.panel.close()
      handles.panel.close()
    })
    expect(back).toHaveBeenCalledOnce()
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('an overlay keeps its entry when a change replaces it while open', async () => {
    const onBack = vi.fn()
    const { history, handles } = await renderAt('/?view=table', onBack)
    const start = position(history)
    await step(() => {
      handles.entry.enter()
    })
    await step(() => {
      handles.change({ from: '2026-11-15' })
    })
    await step(() => {
      handles.entry.leave()
    })
    expect(position(history)).toBe(start)
    expect(shown().from).toBe('2026-11-15')
    expect(onBack).not.toHaveBeenCalled()
  })

  it('a panel that hands over to an overlay leaves it its entry, so one back press closes both', async () => {
    const onBack = vi.fn()
    const { history, handles } = await renderAt('/?view=table', onBack)
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.setup)
    })
    await step(() => {
      handles.panel.handOver()
      handles.entry.enter()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(onBack).toHaveBeenCalledOnce()
    expect(position(history)).toBe(start)
  })
})
