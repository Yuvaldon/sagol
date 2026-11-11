import { NEW_ENTITY, PANEL_IDS } from '@config'
import {
  OrganizationId,
  UnitId,
  UnitLevelId,
  type PermissionCheck,
  type Result,
  type Unit,
} from '@contracts'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, renderHook, screen, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCan, useModuleAccess } from '../permissions/hooks'
import { fakePorts as portsOf, wrapperOf } from '../testing/ports'
import { usePanel } from '../view-state/panel'
import { WorkspaceSearch } from '../view-state/search'
import {
  formFieldIssues,
  toCreateUnitInput,
  toUpdateUnitInput,
  unitFormIssues,
  unitLevelFormIssues,
} from './forms'
import { useUnitCommands, useUnitPermissions, useUnits } from './hooks'
import { dropZoneAt, moveCandidates, planUnitDrop, siblingsUnder, steppedOrder, unitTreeRows } from './tree'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'

function unit(n: number, parent: number | null, sort_order: number, version = 1): Unit {
  return {
    id: UnitId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name: `U${n}`,
    code: null,
    parent_id: parent === null ? null : UnitId.parse(uuid(parent)),
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version,
    archived_at: null,
  }
}

// 1 > (2 > 4, 3); 5
const COMPANY = unit(1, null, 0)
const PLATOON_A = unit(2, 1, 0)
const PLATOON_B = unit(3, 1, 1)
const SQUAD = unit(4, 2, 0)
const OTHER = unit(5, null, 1)
const ALL = [OTHER, SQUAD, PLATOON_B, COMPANY, PLATOON_A]

const names = (rows: readonly { name: string }[]) => rows.map((row) => row.name)

describe('the tree as rows', () => {
  it('walks in tree order, with depth', () => {
    expect(unitTreeRows(ALL).map((row) => [row.unit.name, row.depth])).toEqual([
      ['U1', 0],
      ['U2', 1],
      ['U4', 2],
      ['U3', 1],
      ['U5', 0],
    ])
  })

  it('shows a unit whose parent is out of sight at the top (D-053)', () => {
    expect(unitTreeRows([SQUAD, OTHER]).map((row) => [row.unit.name, row.depth])).toEqual([
      ['U4', 0],
      ['U5', 0],
    ])
  })

  it('survives a cycle in stored data, without looping', () => {
    const a = { ...unit(1, 2, 0) }
    const b = { ...unit(2, 1, 0) }
    expect(unitTreeRows([a, b])).toEqual([])
  })

  it('offers every place but the unit and its subtree (D-009)', () => {
    expect(moveCandidates(ALL, PLATOON_A).map((row) => row.unit.name)).toEqual(['U1', 'U3', 'U5'])
  })
})

describe('steps in a list', () => {
  it('swaps with the neighbor, and answers NULL at the ends', () => {
    expect(names(steppedOrder([PLATOON_A, PLATOON_B], PLATOON_B.id, -1) ?? [])).toEqual(['U3', 'U2'])
    expect(steppedOrder([PLATOON_A, PLATOON_B], PLATOON_A.id, -1)).toBeNull()
    expect(steppedOrder([PLATOON_A, PLATOON_B], PLATOON_B.id, 1)).toBeNull()
  })
})

describe('what a drop means (D-092)', () => {
  it('reads the middle of a row as into, and its edges as before and after', () => {
    expect(dropZoneAt(100, 100, 40)).toBe('before')
    expect(dropZoneAt(109, 100, 40)).toBe('before')
    expect(dropZoneAt(120, 100, 40)).toBe('into')
    expect(dropZoneAt(131, 100, 40)).toBe('after')
  })

  it('moves into a unit with one command: the unit lands last (D-087)', () => {
    expect(planUnitDrop(ALL, OTHER.id, PLATOON_A.id, 'into')).toEqual({ move: { parent_id: PLATOON_A.id }, order: null })
  })

  it('moves before or after a unit of another parent, and then places it', () => {
    const before = planUnitDrop(ALL, SQUAD.id, PLATOON_B.id, 'before')
    expect(before?.move).toEqual({ parent_id: COMPANY.id })
    expect(names(before?.order ?? [])).toEqual(['U2', 'U4', 'U3'])
  })

  it('needs no reorder when the drop lands last anyway', () => {
    expect(planUnitDrop(ALL, SQUAD.id, PLATOON_B.id, 'after')).toEqual({ move: { parent_id: COMPANY.id }, order: null })
  })

  it('moves to the top level by dropping beside a top-level unit', () => {
    const plan = planUnitDrop(ALL, PLATOON_A.id, COMPANY.id, 'before')
    expect(plan?.move).toEqual({ parent_id: null })
    expect(names(plan?.order ?? [])).toEqual(['U2', 'U1', 'U5'])
  })

  it('only reorders inside one parent', () => {
    const plan = planUnitDrop(ALL, PLATOON_B.id, PLATOON_A.id, 'before')
    expect(plan?.move).toBeNull()
    expect(names(plan?.order ?? [])).toEqual(['U3', 'U2'])
  })

  it('reads into the parent it already has as "go last"', () => {
    const plan = planUnitDrop(ALL, PLATOON_A.id, COMPANY.id, 'into')
    expect(plan?.move).toBeNull()
    expect(names(plan?.order ?? [])).toEqual(['U3', 'U2'])
  })

  it('answers NULL when nothing changes', () => {
    expect(planUnitDrop(ALL, PLATOON_A.id, PLATOON_A.id, 'into')).toBeNull()
    expect(planUnitDrop(ALL, PLATOON_A.id, PLATOON_B.id, 'before')).toBeNull()
    expect(planUnitDrop(ALL, PLATOON_B.id, PLATOON_A.id, 'after')).toBeNull()
    expect(planUnitDrop(ALL, PLATOON_B.id, COMPANY.id, 'into')).toBeNull()
  })

  it('plans a cycle like any other drop: the adapter refuses it', () => {
    expect(planUnitDrop(ALL, COMPANY.id, SQUAD.id, 'into')).toEqual({ move: { parent_id: SQUAD.id }, order: null })
  })
})

describe('form values and inputs', () => {
  const values = { name: 'New', unit_level_id: null, color_key: 'teal' }

  it('creates a unit after its siblings, with new ids and default columns (D-044, D-092)', () => {
    const first = toCreateUnitInput(values, COMPANY.id, ALL)
    const second = toCreateUnitInput(values, COMPANY.id, ALL)
    expect(first).toMatchObject({ parent_id: COMPANY.id, sort_order: 2, code: null, kind: 'standing', properties: {} })
    expect(first.id).not.toBe(second.id)
    expect(toCreateUnitInput(values, SQUAD.id, ALL).sort_order).toBe(0)
  })

  it('sends only what changed, at the version the form opened on', () => {
    const before = { ...PLATOON_A, name: 'Old', color_key: 'teal' }
    expect(toUpdateUnitInput(before, 1, { name: 'Old', unit_level_id: null, color_key: 'teal' })).toBeNull()
    expect(toUpdateUnitInput(before, 3, { name: 'New', unit_level_id: null, color_key: 'teal' })).toEqual({
      id: before.id,
      expected_version: 3,
      changes: { name: 'New' },
    })
    const level = UnitLevelId.parse(uuid(700))
    expect(toUpdateUnitInput(before, 3, { name: 'Old', unit_level_id: level, color_key: null })?.changes).toEqual({
      unit_level_id: level,
      color_key: null,
    })
  })

  it('reports the same codes as the adapter (D-068)', () => {
    expect(unitFormIssues(values)).toEqual([])
    expect(unitFormIssues({ ...values, name: '  ' })).toEqual([{ path: ['name'], code: 'required' }])
    expect(unitFormIssues({ ...values, name: 'x'.repeat(101) })).toEqual([{ path: ['name'], code: 'too_long' }])
    expect(unitLevelFormIssues('')).toEqual([{ path: ['name'], code: 'required' }])
  })

  it('maps an update answer to the fields of the form', () => {
    expect(
      formFieldIssues([
        { path: ['changes', 'name'], code: 'required' },
        { path: [], code: 'archived' },
      ]),
    ).toEqual([
      { path: ['name'], code: 'required' },
      { path: [], code: 'archived' },
    ])
  })

  it('knows the live children of a parent, in order', () => {
    expect(names(siblingsUnder(ALL, COMPANY.id))).toEqual(['U2', 'U3'])
    expect(names(siblingsUnder(ALL, null))).toEqual(['U1', 'U5'])
  })
})

// ------------------------------------------------------------ hooks over fake ports

function fakePorts(overrides: {
  can?: (checks: readonly PermissionCheck[]) => Promise<Result<boolean[]>>
  units?: readonly Unit[]
} = {}) {
  let changeListener: ((changes: readonly { table: string; ids: readonly string[] }[]) => void) | null = null
  const list = vi.fn(() => Promise.resolve<Result<Unit[]>>({ ok: true, value: [...(overrides.units ?? ALL)] }))
  const can = vi.fn(
    overrides.can ??
      ((checks: readonly PermissionCheck[]) =>
        Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(() => true) })),
  )
  const move = vi.fn((input: { id: string; expected_version: number; parent_id: string | null }) =>
    Promise.resolve<Result<Unit>>({
      ok: true,
      value: { ...unit(5, null, 2, input.expected_version + 1), parent_id: UnitId.parse(input.parent_id ?? uuid(1)) },
    }),
  )
  const reorder = vi.fn((input: { items: readonly { id: string; expected_version: number }[] }) =>
    Promise.resolve<Result<Unit[]>>({ ok: true, value: input.items.map((_, index) => unit(index + 1, null, index)) }),
  )
  const ports = portsOf({
    session: { current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }), can },
    repositories: { units: { list } },
    commands: { units: { move, reorder } },
    changes: {
      subscribe(listener: typeof changeListener) {
        changeListener = listener
        return () => {
          changeListener = null
        }
      },
    },
  })
  return {
    ports,
    can,
    list,
    move,
    reorder,
    fireChanges(table: string) {
      changeListener?.([{ table, ids: [] }])
    },
  }
}

const VIEW: PermissionCheck = { permission: { resource: 'units', action: 'view' }, target: { kind: 'organization' } }

describe('the can hint (D-091)', () => {
  it('answers from the adapter, and "no" until it answers', async () => {
    const fake = fakePorts()
    const { result } = renderHook(() => useCan([VIEW]), { wrapper: wrapperOf(fake.ports) })
    expect(result.current(VIEW)).toBe(false)
    await waitFor(() => {
      expect(result.current(VIEW)).toBe(true)
    })
  })

  it('fails closed when the adapter refuses', async () => {
    const fake = fakePorts({ can: () => Promise.resolve({ ok: false, error: { code: 'unavailable' } }) })
    const { result } = renderHook(() => useCan([VIEW]), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(fake.can).toHaveBeenCalled()
    })
    expect(result.current(VIEW)).toBe(false)
  })

  it('asks again after any change on the feed, whatever the table', async () => {
    const fake = fakePorts()
    const { result } = renderHook(() => useCan([VIEW]), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current(VIEW)).toBe(true)
    })
    const before = fake.can.mock.calls.length
    act(() => {
      fake.fireChanges('access_grants')
    })
    await waitFor(() => {
      expect(fake.can.mock.calls.length).toBeGreaterThan(before)
    })
  })

  it('does not ask with nothing to ask', () => {
    const fake = fakePorts()
    renderHook(() => useCan([]), { wrapper: wrapperOf(fake.ports) })
    expect(fake.can).not.toHaveBeenCalled()
  })

  it('tells which modules open', async () => {
    const fake = fakePorts({
      can: (checks) =>
        Promise.resolve({
          ok: true,
          value: checks.map((check) => check.permission.resource === 'units'),
        }),
    })
    const { result } = renderHook(() => useModuleAccess(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current).toMatchObject({ units: true, unitLevels: false })
    })
  })
})

describe('unit permissions (D-089)', () => {
  it('reads each action from the adapter, and needs every sibling to reorder', async () => {
    const fake = fakePorts({
      can: (checks) =>
        Promise.resolve({
          ok: true,
          // Everything on the organization and on platoon A only.
          value: checks.map(
            (check) => check.target.kind === 'organization' || (check.target.kind === 'unit' && check.target.unit_id === PLATOON_A.id),
          ),
        }),
    })
    const { result } = renderHook(() => useUnitPermissions(ALL), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current.createUnder(null)).toBe(true)
    })
    expect(result.current.update(COMPANY)).toBe(true)
    expect(result.current.update(PLATOON_A)).toBe(true)
    expect(result.current.update(PLATOON_B)).toBe(false)
    expect(result.current.createUnder(PLATOON_A.id)).toBe(true)
    expect(result.current.createUnder(PLATOON_B.id)).toBe(false)
    expect(result.current.moveTo(PLATOON_B.id)).toBe(false)
    expect(result.current.reorderAround(PLATOON_A)).toBe(false)
    expect(result.current.reorderAround(COMPANY)).toBe(true)
  })
})

describe('unit reads and commands', () => {
  it('re-reads units when the feed names the table', async () => {
    const fake = fakePorts()
    const { result } = renderHook(() => useUnits(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(fake.list).toHaveBeenCalledTimes(1)
    act(() => {
      fake.fireChanges('tags')
    })
    expect(fake.list).toHaveBeenCalledTimes(1)
    act(() => {
      fake.fireChanges('units')
    })
    await waitFor(() => {
      expect(fake.list).toHaveBeenCalledTimes(2)
    })
  })

  it('applies a drop as a move, then the order, with the version the move returned', async () => {
    const fake = fakePorts()
    const { result } = renderHook(() => useUnitCommands(), { wrapper: wrapperOf(fake.ports) })
    const answer = await act(() =>
      result.current.drop.run({
        unit: OTHER,
        plan: { move: { parent_id: COMPANY.id }, order: [OTHER, PLATOON_A, PLATOON_B] },
      }),
    )
    expect(answer.ok).toBe(true)
    expect(fake.move).toHaveBeenCalledWith({ id: OTHER.id, expected_version: 1, parent_id: COMPANY.id })
    expect(fake.reorder).toHaveBeenCalledWith({
      items: [
        { id: OTHER.id, expected_version: 2 },
        { id: PLATOON_A.id, expected_version: 1 },
        { id: PLATOON_B.id, expected_version: 1 },
      ],
    })
  })

  it('stops a drop at a refused move, and hands back the refusal', async () => {
    const fake = fakePorts()
    const refusal: Result<Unit> = {
      ok: false,
      error: { code: 'validation_failed', issues: [{ path: ['parent_id'], code: 'unit_cycle' }] },
    }
    fake.move.mockResolvedValueOnce(refusal)
    const { result } = renderHook(() => useUnitCommands(), { wrapper: wrapperOf(fake.ports) })
    const answer = await act(() =>
      result.current.drop.run({ unit: COMPANY, plan: { move: { parent_id: SQUAD.id }, order: null } }),
    )
    expect(answer).toEqual(refusal)
    expect(fake.reorder).not.toHaveBeenCalled()
  })

  it('steps a unit among its siblings, and does nothing at the end of the list', async () => {
    const fake = fakePorts()
    const { result } = renderHook(() => useUnitCommands(), { wrapper: wrapperOf(fake.ports) })
    await act(() => result.current.step.run({ unit: PLATOON_B, direction: -1, all: ALL }))
    expect(fake.reorder).toHaveBeenCalledWith({
      items: [
        { id: PLATOON_B.id, expected_version: 1 },
        { id: PLATOON_A.id, expected_version: 1 },
      ],
    })
    fake.reorder.mockClear()
    await act(() => result.current.step.run({ unit: PLATOON_B, direction: 1, all: ALL }))
    expect(fake.reorder).not.toHaveBeenCalled()
  })
})

describe('panel state in the URL (D-023, D-092)', () => {
  const rootRoute = createRootRoute()

  function Probe() {
    const panel = usePanel()
    return (
      <div>
        <p data-testid="state">{JSON.stringify([panel.panel, panel.entity, panel.parent])}</p>
        <button
          type="button"
          data-testid="open"
          onClick={() => {
            panel.open(PANEL_IDS.units, { entity: NEW_ENTITY, parent: COMPANY.id })
          }}
        />
        <button type="button" data-testid="close" onClick={panel.close} />
      </div>
    )
  }

  async function renderAt(url: string) {
    const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
    const history = createMemoryHistory({ initialEntries: [url] })
    const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
    render(<RouterProvider router={router as never} />)
    await screen.findByTestId('state')
    return { history }
  }

  const state = () => JSON.parse(screen.getByTestId('state').textContent) as unknown

  it('reads a deep link', async () => {
    await renderAt(`/?panel=units&entity=${uuid(1)}`)
    expect(state()).toEqual(['units', uuid(1), null])
  })

  it('counts an invalid value as absent', async () => {
    await renderAt('/?panel=nothing&entity=x&parent=y')
    expect(state()).toEqual([null, null, null])
  })

  it('opens and closes through the URL, and the back button returns', async () => {
    const { history } = await renderAt('/')
    expect(state()).toEqual([null, null, null])
    act(() => {
      screen.getByTestId('open').click()
    })
    await waitFor(() => {
      expect(state()).toEqual(['units', 'new', COMPANY.id])
    })
    act(() => {
      screen.getByTestId('close').click()
    })
    await waitFor(() => {
      expect(state()).toEqual([null, null, null])
    })
    act(() => {
      history.back()
    })
    await waitFor(() => {
      expect(state()).toEqual(['units', 'new', COMPANY.id])
    })
  })
})
