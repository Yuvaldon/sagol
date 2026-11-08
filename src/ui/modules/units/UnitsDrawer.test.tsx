import { OrganizationId, UnitId, type PermissionCheck, type Result, type Unit } from '@contracts'
import { dictionary as he } from '@i18n'
import { LogicProvider, WorkspaceSearch, type LogicPorts } from '@logic'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UnitsDrawer } from './UnitsDrawer'

// Controls follow the hints (D-076, D-091): a soldier who may only read sees names and no actions, and
// one who may not read sees no drawer at all, even from a deep link. Sample rows, test data only.

const AT = '2026-11-08T10:00:00.000Z'
const UNIT: Unit = {
  id: UnitId.parse('00000000-0000-4000-8000-000000000001'),
  organization_id: OrganizationId.parse('00000000-0000-4000-8000-000000000900'),
  name: 'פלוגה ב',
  code: null,
  parent_id: null,
  unit_level_id: null,
  kind: 'standing',
  valid_from: null,
  valid_to: null,
  color_key: null,
  sort_order: 0,
  properties: {},
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}

function portsWith(allow: (check: PermissionCheck) => boolean) {
  const list = () => Promise.resolve({ ok: true, value: [UNIT] })
  return {
    data: {
      session: {
        current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }),
        subscribe: () => () => undefined,
        can: (checks: readonly PermissionCheck[]) =>
          Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(allow) }),
      },
      repositories: {
        units: { list },
        unit_levels: { list: () => Promise.resolve({ ok: true, value: [] }) },
      },
      commands: { units: {}, unit_levels: {} },
      changes: { subscribe: () => () => undefined },
    },
    auth: {},
  } as unknown as LogicPorts
}

async function renderDrawer(ports: LogicPorts) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: UnitsDrawer, validateSearch: WorkspaceSearch })
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/?panel=units'] }),
  })
  render(
    <LogicProvider ports={ports}>
      <RouterProvider router={router as never} />
    </LogicProvider>,
  )
  await router.load()
}

const isView = (check: PermissionCheck) => check.permission.action === 'view'

describe('units drawer: controls follow the hints', () => {
  it('shows every control to a soldier who may do everything', async () => {
    await renderDrawer(portsWith(() => true))
    const list = await screen.findByRole('list', { name: he.units.listLabel })
    expect(await within(list).findByRole('button', { name: he.common.actions })).toBeTruthy()
    expect(screen.getByRole('button', { name: he.units.new })).toBeTruthy()
    expect(screen.getByRole('button', { name: he.units.tabLevels })).toBeTruthy()
  })

  it('shows names and no action to a soldier who may only read', async () => {
    await renderDrawer(portsWith(isView))
    expect(await screen.findByText(UNIT.name)).toBeTruthy()
    expect(screen.queryByRole('button', { name: he.units.new })).toBeNull()
    expect(screen.queryByRole('button', { name: he.common.actions })).toBeNull()
    expect(screen.queryByTestId('drag-handle')).toBeNull()
    expect(screen.queryByRole('button', { name: UNIT.name })).toBeNull()
  })

  it('opens nothing for a soldier who may not read, even from a deep link (D-046)', async () => {
    await renderDrawer(portsWith(() => false))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(UNIT.name)).toBeNull()
  })
})
