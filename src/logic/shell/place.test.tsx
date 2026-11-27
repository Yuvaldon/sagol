import { DeploymentId, OrganizationId, SoldierId, UnitId, UnitLevelId, type Deployment, type Unit, type PermissionCheck, type Result, type Soldier } from '@contracts'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogicProvider } from '../runtime/LogicProvider'
import { fakePorts, organizationIn } from '../testing/ports'
import { WorkspaceSearch } from '../view-state/search'
import { useShellAccess, useShellPlace, type ShellAccess } from './place'

// Sample ids, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const AT = '2026-11-08T10:00:00.000Z'

const ME: Soldier = {
  id: ACTOR,
  organization_id: ORGANIZATION,
  first_name: 'A',
  last_name: 'B',
  nickname: null,
  command_rank_id: null,
  status: 'active',
  properties: {},
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}
const OTHER: Soldier = { ...ME, id: SoldierId.parse(uuid(902)), first_name: 'C' }

const UNIT = UnitId.parse(uuid(10))
const ROTATION: Deployment = {
  id: DeploymentId.parse(uuid(50)),
  organization_id: ORGANIZATION,
  name: 'R',
  unit_id: UNIT,
  start_date: '2026-11-01',
  end_date: '2026-12-20',
  closed_at: null,
  closed_by: null,
  report_owner_id: null,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}
const UNITS = [{ id: UNIT, parent_id: null, unit_level_id: UnitLevelId.parse(uuid(90)) }] as unknown as Unit[]

type Allows = (check: PermissionCheck) => boolean
const own = (check: PermissionCheck) => check.target.kind === 'soldier' && check.target.soldier_id === ACTOR
const leaves = (check: PermissionCheck) => check.permission.resource === 'leaves'
/** A fighter reads and requests their own leaves only. */
const FIGHTER: Allows = (check) => leaves(check) && own(check) && check.permission.action !== 'approve'
/** A commander also reads the leaves of whoever they see. */
const COMMANDER: Allows = (check) => FIGHTER(check) || (leaves(check) && check.permission.action === 'view')
/** Who approves others without reading their own. */
const APPROVER: Allows = (check) => leaves(check) && !own(check)

async function access(allows: Allows, deployments: readonly Deployment[] = [], soldiers: readonly Soldier[] = [ME, OTHER]) {
  const ports = fakePorts({
    session: {
      current: () =>
        Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION } }),
      can: (checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(allows) }),
    },
    repositories: {
      organizations: organizationIn(),
      soldiers: { list: () => Promise.resolve<Result<Soldier[]>>({ ok: true, value: [...soldiers] }) },
      units: { list: () => Promise.resolve<Result<Unit[]>>({ ok: true, value: UNITS }) },
      deployments: { list: () => Promise.resolve<Result<Deployment[]>>({ ok: true, value: [...deployments] }) },
    },
  })
  const seen: ShellAccess[] = []
  function Probe() {
    seen.push(useShellAccess())
    return <div data-testid="access" />
  }
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  const view = render(
    <LogicProvider ports={ports}>
      <RouterProvider router={router as never} />
    </LogicProvider>,
  )
  await screen.findByTestId('access')
  await waitFor(() => expect(seen.at(-1)?.ready).toBe(true))
  view.unmount()
  return { first: seen[0], last: seen.at(-1) }
}

describe('the destinations follow the permissions (D-455)', () => {
  it('opens "לוח" to who reads the leaves of someone else, and to nobody else', async () => {
    expect((await access(COMMANDER)).last?.board).toBe(true)
    expect((await access(FIGHTER)).last?.board).toBe(false)
  })

  it('opens "לוח" to who reads the leaves of a unit, before another soldier exists', async () => {
    const overUnit: Allows = (check) => leaves(check) && check.permission.action === 'view' && check.target.kind === 'some_unit'
    expect((await access(overUnit, [], [ME])).last?.board).toBe(true)
    expect((await access(FIGHTER, [], [ME])).last?.board).toBe(false)
  })

  it('shows nothing optional before the answers arrive', async () => {
    expect((await access(COMMANDER, [ROTATION])).first).toEqual({ ready: false, board: false, requestsForSelf: false, approvals: false })
  })

  it('opens "בקשות לאישור" to who approves someone else while a rotation takes requests, and to nobody else', async () => {
    expect((await access(APPROVER, [ROTATION])).last?.approvals).toBe(true)
    expect((await access(APPROVER)).last?.approvals).toBe(false)
    expect((await access(FIGHTER, [ROTATION])).last?.approvals).toBe(false)
  })

  it('is not ready before the answers behind the rows of "ניהול" arrive', async () => {
    const { first, last } = await access(COMMANDER, [ROTATION])
    expect(first?.ready).toBe(false)
    expect(last).toMatchObject({ ready: true, board: true })
  })

  it('offers a request for oneself while a rotation takes requests, to who may create their own', async () => {
    expect((await access(FIGHTER, [ROTATION])).last?.requestsForSelf).toBe(true)
    expect((await access(FIGHTER)).last?.requestsForSelf).toBe(false)
    expect((await access(APPROVER, [ROTATION])).last?.requestsForSelf).toBe(false)
  })
})

function PlaceProbe() {
  const place = useShellPlace()
  const shown = `${place.tab}/${place.page ?? '-'}`
  return (
    <div>
      <div data-testid="place">{shown}</div>
      <button type="button" data-testid="page" onClick={() => place.openPage('requests')} />
      <button type="button" data-testid="me" onClick={() => place.openTab('me')} />
      <button type="button" data-testid="today" onClick={() => place.openTab('today')} />
    </div>
  )
}

async function placeAt(url: string) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: PlaceProbe, validateSearch: WorkspaceSearch })
  const history = createMemoryHistory({ initialEntries: [url] })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  const view = render(<RouterProvider router={router as never} />)
  await screen.findByTestId('place')
  const press = async (id: string) => {
    await act(async () => {
      screen.getByTestId(id).click()
      await Promise.resolve()
    })
  }
  return { shown: () => screen.getByTestId('place').textContent, history, press, unmount: view.unmount }
}

describe('the destination and its page live in the URL (D-455, D-459)', () => {
  it('lands a bare address, and one that names no destination, on "היום"', async () => {
    expect((await placeAt('/')).shown()).toBe('today/-')
  })

  it('reads a destination, and ignores one it does not know', async () => {
    const known = await placeAt('/?tab=manage')
    expect(known.shown()).toBe('manage/-')
    known.unmount()
    expect((await placeAt('/?tab=nowhere')).shown()).toBe('today/-')
  })

  it('opens the board on an address that names a view of it, and still reaches "היום" from there', async () => {
    const { shown, history, press } = await placeAt('/?view=table')
    expect(shown()).toBe('board/-')
    await press('today')
    await waitFor(() => expect(shown()).toBe('today/-'))
    expect(history.location.search).toBe('?view=table&tab=today')
    await press('page')
    await waitFor(() => expect(shown()).toBe('today/requests'))
  })

  it('shows a page only on the destination it belongs to', async () => {
    const owned = await placeAt('/?page=requests')
    expect(owned.shown()).toBe('today/requests')
    owned.unmount()
    expect((await placeAt('/?tab=me&page=requests')).shown()).toBe('me/-')
  })

  it('moves between destinations in place, leaving the page behind', async () => {
    const { shown, history, press } = await placeAt('/')
    await press('page')
    await waitFor(() => expect(shown()).toBe('today/requests'))
    await press('me')
    await waitFor(() => expect(shown()).toBe('me/-'))
    expect(history.location.search).toBe('?tab=me')
    await press('today')
    await waitFor(() => expect(shown()).toBe('today/-'))
    expect(history.location.search).toBe('')
    expect(history.length).toBe(1)
  })
})
