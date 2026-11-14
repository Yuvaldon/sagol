import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLeaveConditions, useOnlyMissing, type LeaveConditionsState, type OnlyMissingState } from './board'
import { WorkspaceSearch, useChangeSearch, useWorkspaceSearch } from './search'

// Two URL writes in one gesture both land: each is written over the router's search as it is then (OI-330, D-440).

interface Handles {
  change: ReturnType<typeof useChangeSearch>
  leaves: LeaveConditionsState
  missing: OnlyMissingState
}

async function renderAt(url: string) {
  const handles: Partial<Handles> = {}
  function Probe() {
    handles.change = useChangeSearch()
    handles.leaves = useLeaveConditions()
    handles.missing = useOnlyMissing()
    return <div data-testid="search">{JSON.stringify(useWorkspaceSearch())}</div>
  }
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  render(<RouterProvider router={router as never} />)
  await screen.findByTestId('search')
  return handles as Handles
}

const shown = () => JSON.parse(screen.getByTestId('search').textContent) as WorkspaceSearch

describe('URL writes in one gesture (OI-330)', () => {
  it('a leave condition and "only who is missing" set in one step both land', async () => {
    const handles = await renderAt('/?view=table')
    await act(async () => {
      handles.leaves.setStatuses(['approved'])
      handles.missing.set(true)
      await Promise.resolve()
    })
    expect(shown()).toMatchObject({ view: 'table', leaves: { statuses: ['approved'] }, missing: true })
  })

  it('two parts of the leave conditions set in one step keep each other', async () => {
    const handles = await renderAt('/?view=table')
    await act(async () => {
      handles.leaves.setStatuses(['pending'])
      handles.leaves.setProperties([])
      handles.change({ from: '2026-11-15' })
      await Promise.resolve()
    })
    expect(shown()).toMatchObject({ leaves: { statuses: ['pending'] }, from: '2026-11-15' })
  })

  it('a change given as a function reads the search as the previous change left it', async () => {
    const handles = await renderAt('/?view=table')
    await act(async () => {
      handles.change({ from: '2026-11-15' })
      handles.change((current) => ({ to: current.from }))
      await Promise.resolve()
    })
    expect(shown()).toMatchObject({ from: '2026-11-15', to: '2026-11-15' })
  })
})
