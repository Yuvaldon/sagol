import { PANEL_IDS } from '@config'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useOverlayEntry, useOverlayHistory, type OverlayEntry } from './history'
import { useOverlayLayer } from './layers'
import { usePanel, type PanelState } from './panel'
import { WorkspaceSearch, useChangeSearch, useWorkspaceSearch } from './search'

// A menu or a dialog inside a component holds one history entry while it is open (D-337).

interface Handles {
  panel: PanelState
  change: ReturnType<typeof useChangeSearch>
  entry: OverlayEntry
  menu: boolean
  dialog: boolean
  setMenu: (open: boolean) => void
  setDialog: (open: boolean) => void
}

async function renderAt(entries: string[], options: { strict?: boolean; onNavBack?: () => void } = {}) {
  const handles: Partial<Handles> = {}
  function Probe() {
    useOverlayHistory()
    const search = useWorkspaceSearch()
    const [menu, setMenu] = useState(false)
    const [dialog, setDialog] = useState(false)
    useOverlayLayer(menu, () => {
      setMenu(false)
    })
    useOverlayLayer(dialog, () => {
      setDialog(false)
    })
    Object.assign(handles, {
      panel: usePanel(),
      change: useChangeSearch(),
      entry: useOverlayEntry(options.onNavBack ?? (() => undefined)),
      menu,
      dialog,
      setMenu,
      setDialog,
    })
    return <div data-testid="search">{JSON.stringify(search)}</div>
  }
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
  const history = createMemoryHistory({ initialEntries: entries, initialIndex: entries.length - 1 })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  const app = <RouterProvider router={router as never} />
  render(options.strict === true ? <StrictMode>{app}</StrictMode> : app)
  await screen.findByTestId('search')
  return { history, handles: handles as Handles }
}

const position = (history: RouterHistory) => history.location.state.__TSR_index ?? 0
const shown = () => JSON.parse(screen.getByTestId('search').textContent) as WorkspaceSearch

async function step(run: () => void) {
  await act(async () => {
    run()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('local overlay entries (D-337)', () => {
  it('back closes an open menu and stays on the screen', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(handles.menu).toBe(false)
    expect(position(history)).toBe(start)
    expect(shown().view).toBe('table')
  })

  it('nested overlays close innermost first, one back press each', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      handles.setDialog(true)
    })
    expect(position(history)).toBe(start + 2)
    await step(() => {
      history.back()
    })
    expect(handles).toMatchObject({ menu: true, dialog: false })
    await step(() => {
      history.back()
    })
    expect(handles).toMatchObject({ menu: false, dialog: false })
    expect(position(history)).toBe(start)
  })

  it('an overlay closed by its own controls takes its entry back, so back then navigates normally', async () => {
    const { history, handles } = await renderAt(['/?view=calendar', '/?view=table'])
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      handles.setMenu(false)
    })
    expect(position(history)).toBe(start)
    expect(shown().view).toBe('table')
    await step(() => {
      history.back()
    })
    expect(shown().view).toBe('calendar')
    expect(position(history)).toBe(start - 1)
  })

  it('a dialog that opens as its menu closes takes over the menu entry', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      handles.setMenu(false)
      handles.setDialog(true)
    })
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(handles.dialog).toBe(false)
    expect(position(history)).toBe(start)
  })

  it('adds one entry under StrictMode', async () => {
    const { history, handles } = await renderAt(['/?view=table'], { strict: true })
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    expect(position(history)).toBe(start + 1)
    await step(() => {
      handles.setMenu(false)
    })
    expect(position(history)).toBe(start)
  })

  it('a dialog over a panel closes first, then the panel', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    await step(() => {
      handles.setDialog(true)
    })
    await step(() => {
      history.back()
    })
    expect(handles.dialog).toBe(false)
    expect(shown().panel).toBe(PANEL_IDS.soldiers)
    await step(() => {
      history.back()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('a change made while a menu is open over a panel stays when the menu closes', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    const panelEntry = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      handles.change({ from: '2026-11-15' })
      handles.setMenu(false)
    })
    expect(position(history)).toBe(panelEntry)
    expect(shown()).toMatchObject({ panel: PANEL_IDS.soldiers, from: '2026-11-15' })
  })

  it('a panel closed from a dialog over it takes the dialog entry too', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    await step(() => {
      handles.setDialog(true)
    })
    await step(() => {
      handles.setDialog(false)
      handles.panel.close()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('a panel closed while its dialog is still leaving its entry closes too', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.panel.open(PANEL_IDS.soldiers)
    })
    await step(() => {
      handles.setDialog(true)
    })
    // A browser answers a step back later, as a popstate: hold the answer until the panel has closed.
    const held: (() => void)[] = []
    const { go, back } = history
    history.go = (steps) => {
      held.push(() => {
        go(steps)
      })
    }
    history.back = () => {
      held.push(back)
    }
    await step(() => {
      handles.setDialog(false)
    })
    await step(() => {
      handles.panel.close()
    })
    history.go = go
    history.back = back
    expect(held).toHaveLength(1)
    await step(() => {
      held[0]?.()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('a panel opened from a menu takes the menu entry', async () => {
    const { history, handles } = await renderAt(['/?view=table'])
    const start = position(history)
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      handles.panel.open(PANEL_IDS.units)
      handles.setMenu(false)
    })
    expect(shown().panel).toBe(PANEL_IDS.units)
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(shown().panel).toBeUndefined()
    expect(position(history)).toBe(start)
  })

  it('back closes a menu over the navigation panel, not the panel', async () => {
    const onNavBack = vi.fn()
    const { history, handles } = await renderAt(['/?view=table'], { onNavBack })
    const start = position(history)
    await step(() => {
      handles.entry.enter()
    })
    await step(() => {
      handles.setMenu(true)
    })
    await step(() => {
      history.back()
    })
    expect(handles.menu).toBe(false)
    expect(onNavBack).not.toHaveBeenCalled()
    expect(position(history)).toBe(start + 1)
    await step(() => {
      history.back()
    })
    expect(onNavBack).toHaveBeenCalledOnce()
    expect(position(history)).toBe(start)
  })
})
