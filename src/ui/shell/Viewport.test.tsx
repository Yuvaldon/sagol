import { dictionary as he } from '@i18n'
import { LogicProvider, WorkspaceSearch, type LogicPorts } from '@logic'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Viewport } from './Viewport'

// The viewport's notice says the soldier has no board (D-151, D-160). A board that is still loading is not that, so it
// shows that it loads (D-330). Fake ports, test data only.

const NO_STORE = { read: () => null, write: () => undefined }
const NOW = '2026-11-13T02:08:00.000Z'
const NEVER = () => new Promise<never>(() => undefined)
const EMPTY = () => Promise.resolve({ ok: true, value: [] })

function portsWith(organization: () => Promise<unknown>, deployments: () => Promise<unknown>) {
  return {
    data: {
      session: {
        current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }),
        subscribe: () => () => undefined,
        can: (checks: readonly unknown[]) => Promise.resolve({ ok: true, value: checks.map(() => true) }),
      },
      repositories: {
        organizations: { current: organization },
        deployments: { list: deployments },
        units: { list: EMPTY },
        soldiers: { list: EMPTY },
      },
      commands: {},
      changes: { subscribe: () => () => undefined },
    },
    auth: {},
    time: { now: () => NOW },
    device: { local: NO_STORE, session: NO_STORE },
  } as unknown as LogicPorts
}

async function renderViewport(ports: LogicPorts) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Viewport, validateSearch: WorkspaceSearch })
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <LogicProvider ports={ports}>
      <RouterProvider router={router as never} />
    </LogicProvider>,
  )
  await router.load()
}

const organization = () => Promise.resolve({ ok: true, value: { timezone: 'Asia/Jerusalem' } })
const noOrganization = () => Promise.resolve({ ok: false, error: { code: 'not_found' } })

describe('viewport: no board, or a board that loads', () => {
  it('shows that the board loads while the rotations it opens on still load (D-330)', async () => {
    await renderViewport(portsWith(organization, NEVER))
    expect((await screen.findByRole('status')).textContent).toBe(he.app.loading)
    expect(screen.queryByText(he.timeline.noDayTitle)).toBeNull()
  })

  it('says there is no board to a soldier who may not view the organization and reads no soldier (D-151, D-160)', async () => {
    await renderViewport(portsWith(noOrganization, EMPTY))
    expect(await screen.findByText(he.timeline.noDayTitle)).toBeTruthy()
  })
})
