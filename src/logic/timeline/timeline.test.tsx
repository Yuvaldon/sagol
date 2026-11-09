import { PANEL_IDS } from '@config'
import {
  CommandRankId,
  OrganizationId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type CommandRank,
  type PermissionCheck,
  type Result,
  type Soldier,
  type Unit,
  type UnitMembership,
} from '@contracts'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useCan } from '../permissions/hooks'
import type { LogicPorts } from '../ports'
import { soldierRows, unitStateOn } from '../roster/roster'
import { LogicProvider } from '../runtime/LogicProvider'
import { useToday } from '../session/today'
import { filterUnitOf, unitFilterOf, useViewFilter } from '../view-state/filter'
import { usePanel } from '../view-state/panel'
import { WorkspaceSearch, useWorkspaceSearch } from '../view-state/search'
import { useActiveView } from '../view-state/view'
import { dateWindowOf, shiftedWindow, useDateWindow } from '../view-state/window'
import { timelineItems, type TimelineInput, type TimelineItem } from './rows'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

function soldier(n: number, first_name: string, last_name: string, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name,
    last_name,
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
    ...overrides,
  }
}

function rank(n: number, seniority: number): CommandRank {
  return {
    id: CommandRankId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    title: `R${n}`,
    short_title: null,
    seniority,
    color_key: null,
    ...audit,
  }
}

function unit(n: number, name: string, parent: number | null, sort_order = 0): Unit {
  return {
    id: UnitId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name,
    code: null,
    parent_id: parent === null ? null : UnitId.parse(uuid(parent)),
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order,
    properties: {},
    ...audit,
  }
}

function membership(n: number, soldierN: number, unitN: number, valid_from: string, valid_to: string | null): UnitMembership {
  return {
    id: UnitMembershipId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    unit_id: UnitId.parse(uuid(unitN)),
    membership_type: 'primary',
    valid_from,
    valid_to,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }
}

// Wednesday, in the week of Sunday 2026-11-08.
const TODAY = '2026-11-11'
const WEEK = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

describe('the date window (D-103)', () => {
  it('is the week that holds today when the URL has none, and follows it', () => {
    const window = dateWindowOf({}, TODAY)
    expect(window).toMatchObject({ from: '2026-11-08', to: '2026-11-14', followsToday: true, holdsToday: true })
    expect(window.days).toEqual(WEEK)
    expect(dateWindowOf({}, '2026-11-15').from).toBe('2026-11-15')
  })

  it('takes a valid pair from a link, of any length up to the limit', () => {
    expect(dateWindowOf({ from: '2026-12-01', to: '2026-12-03' }, TODAY)).toMatchObject({
      days: ['2026-12-01', '2026-12-02', '2026-12-03'],
      followsToday: false,
      holdsToday: false,
    })
    expect(dateWindowOf({ from: TODAY, to: TODAY }, TODAY).days).toEqual([TODAY])
  })

  it('counts a pair with one side, inverted or too long as absent', () => {
    for (const params of [{ from: '2026-12-01' }, { from: '2026-12-03', to: '2026-12-01' }, { from: '2026-01-01', to: '2026-12-31' }]) {
      expect(dateWindowOf(params, TODAY)).toMatchObject({ from: '2026-11-08', followsToday: true })
    }
  })

  it('moves by its own length', () => {
    expect(shiftedWindow({ from: '2026-11-08', to: '2026-11-14' }, 1)).toEqual({ from: '2026-11-15', to: '2026-11-21' })
    expect(shiftedWindow({ from: '2026-11-08', to: '2026-11-14' }, -1)).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(shiftedWindow({ from: '2026-12-01', to: '2026-12-03' }, 1)).toEqual({ from: '2026-12-04', to: '2026-12-06' })
  })
})

describe('the unit filter (D-104)', () => {
  const PLATOON = UnitId.parse(uuid(11))

  it('writes one unit with its sub-units, and nothing for the whole organization', () => {
    expect(unitFilterOf(PLATOON)).toEqual({ where: { kind: 'unit', unit_ids: [PLATOON], include_descendants: true } })
    expect(unitFilterOf(null)).toBeUndefined()
  })

  it('reads back what it wrote, and anything else as another filter', () => {
    expect(filterUnitOf(unitFilterOf(PLATOON) ?? null)).toEqual({ kind: 'unit', unitId: PLATOON })
    expect(filterUnitOf(null)).toEqual({ kind: 'organization' })
    expect(filterUnitOf({})).toEqual({ kind: 'organization' })
    expect(filterUnitOf({ where: { kind: 'unit', unit_ids: [PLATOON], include_descendants: false } })).toEqual({ kind: 'other' })
    expect(filterUnitOf({ where: { kind: 'soldier_status', statuses: ['active'] } })).toEqual({ kind: 'other' })
  })
})

describe('what a row knows about its unit (D-106, OI-048)', () => {
  const units = new Map([[UnitId.parse(uuid(10)), unit(10, 'פלוגה', null)]])
  const dana = SoldierId.parse(uuid(1))
  const placed = [membership(70, 1, 10, '2026-01-01', null)]
  const elsewhere = [membership(70, 1, 99, '2026-01-01', null)]

  it('tells a visible unit, no unit, another unit and unknown apart', () => {
    expect(unitStateOn(placed, units, dana, TODAY, true)).toMatchObject({ kind: 'unit', unit: { name: 'פלוגה' } })
    expect(unitStateOn([], units, dana, TODAY, true)).toEqual({ kind: 'none' })
    expect(unitStateOn(elsewhere, units, dana, TODAY, true)).toEqual({ kind: 'other' })
    expect(unitStateOn([], units, dana, TODAY, false)).toEqual({ kind: 'unknown' })
    expect(unitStateOn(placed, units, dana, null, true)).toEqual({ kind: 'unknown' })
  })

  it('knows "no unit" from rows it read, whatever the hint says', () => {
    expect(unitStateOn([membership(70, 1, 10, '2026-01-01', '2026-02-01')], units, dana, TODAY, false)).toEqual({ kind: 'none' })
  })

  it('reaches the soldiers list', () => {
    const [row] = soldierRows([soldier(1, 'דנה', 'לוי')], [], [...units.values()], [], TODAY, () => false)
    expect(row?.unitState).toEqual({ kind: 'unknown' })
  })
})

describe('the rows of the timeline (D-105)', () => {
  // פלוגה › מחלקה א › כיתה 1, and מחלקה ב beside מחלקה א.
  const units = [unit(10, 'פלוגה', null), unit(11, 'מחלקה א', 10, 0), unit(12, 'מחלקה ב', 10, 1), unit(13, 'כיתה 1', 11)]
  const ranks = [rank(20, 1), rank(21, 5)]
  const PLATOON_A = UnitId.parse(uuid(11))

  const base = (overrides: Partial<TimelineInput>): TimelineInput => ({
    soldiers: [],
    ranks,
    units,
    memberships: [],
    days: WEEK,
    today: TODAY,
    filter: null,
    scopeUnitId: null,
    readsPlacements: () => true,
    ...overrides,
  })

  const describeItems = (items: readonly TimelineItem[]) =>
    items.map((item) =>
      item.kind === 'group'
        ? `# ${item.label.kind === 'unit' ? item.label.path.join(' · ') : item.label.kind} (${item.size})`
        : `${item.soldier.first_name} ${item.inScope.map((on) => (on ? '■' : '□')).join('')}`,
    )

  it('groups by unit in tree order, the most senior first, then by name', () => {
    const fighter = CommandRankId.parse(uuid(20))
    const commander = CommandRankId.parse(uuid(21))
    const items = timelineItems(
      base({
        soldiers: [
          soldier(1, 'אבי', 'כהן', { command_rank_id: fighter }),
          soldier(2, 'בני', 'אבו', { command_rank_id: fighter }),
          soldier(3, 'גיל', 'זך', { command_rank_id: commander }),
          soldier(4, 'דן', 'רז'),
          soldier(5, 'הדר', 'טל'),
        ],
        memberships: [
          membership(70, 1, 11, '2026-01-01', null),
          membership(71, 2, 11, '2026-01-01', null),
          membership(72, 3, 11, '2026-01-01', null),
          membership(73, 4, 11, '2026-01-01', null),
          membership(74, 5, 13, '2026-01-01', null),
        ],
      }),
    )
    expect(describeItems(items)).toEqual([
      '# פלוגה · מחלקה א (4)',
      'גיל ■■■■■■■',
      'בני ■■■■■■■',
      'אבי ■■■■■■■',
      'דן ■■■■■■■',
      '# פלוגה · מחלקה א · כיתה 1 (1)',
      'הדר ■■■■■■■',
    ])
  })

  it('keeps who served one day of the week, mutes the other days, and names paths below the selected unit', () => {
    const items = timelineItems(
      base({
        filter: unitFilterOf(PLATOON_A) ?? null,
        scopeUnitId: PLATOON_A,
        soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן'), soldier(3, 'גיל', 'כהן'), soldier(4, 'דן', 'כהן')],
        memberships: [
          // Leaves for מחלקה ב on Tuesday.
          membership(70, 1, 13, '2026-01-01', '2026-11-09'),
          membership(71, 1, 12, '2026-11-10', null),
          // Joins on Thursday.
          membership(72, 2, 11, '2026-11-12', null),
          // Never in it this week.
          membership(73, 3, 12, '2026-01-01', null),
          membership(74, 4, 11, '2026-01-01', null),
        ],
      }),
    )
    expect(describeItems(items)).toEqual([
      '# מחלקה א (2)',
      'בני □□□□■■■',
      'דן ■■■■■■■',
      '# כיתה 1 (1)',
      'אבי ■■□□□□□',
    ])
  })

  it('leaves out inactive and archived soldiers', () => {
    const items = timelineItems(
      base({
        soldiers: [soldier(1, 'אבי', 'כהן', { status: 'inactive' }), soldier(2, 'בני', 'כהן', { archived_at: AT }), soldier(3, 'גיל', 'כהן')],
      }),
    )
    expect(describeItems(items)).toEqual(['# none (1)', 'גיל ■■■■■■■'])
  })

  it('puts soldiers without a visible unit last, by what the actor can know', () => {
    const items = timelineItems(
      base({
        soldiers: [soldier(1, 'אבי', 'כהן'), soldier(2, 'בני', 'כהן'), soldier(3, 'גיל', 'כהן'), soldier(4, 'דן', 'כהן')],
        memberships: [membership(70, 2, 99, '2026-01-01', null), membership(71, 4, 10, '2026-01-01', null)],
        readsPlacements: (id) => id !== SoldierId.parse(uuid(3)),
      }),
    )
    expect(describeItems(items)).toEqual([
      '# פלוגה (1)',
      'דן ■■■■■■■',
      '# none (1)',
      'אבי ■■■■■■■',
      '# other (1)',
      'בני ■■■■■■■',
      '# unknown (1)',
      'גיל ■■■■■■■',
    ])
  })

  it('groups by today when the soldier is in the view today, else by the first day they are', () => {
    const memberships = [membership(70, 1, 13, '2026-01-01', '2026-11-12'), membership(71, 1, 11, '2026-11-13', null)]
    const withToday = timelineItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships }))
    expect(describeItems(withToday)[0]).toBe('# פלוגה · מחלקה א · כיתה 1 (1)')
    const later = timelineItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships, today: '2026-11-20' }))
    expect(describeItems(later)[0]).toBe('# פלוגה · מחלקה א · כיתה 1 (1)')
    const nextWeek = ['2026-11-15', '2026-11-16']
    expect(describeItems(timelineItems(base({ soldiers: [soldier(1, 'אבי', 'כהן')], memberships, days: nextWeek })))[0]).toBe(
      '# פלוגה · מחלקה א (1)',
    )
  })
})

// ------------------------------------------------------------ hooks over the URL and the clock

function portsAt(clock: { now: string }, can = vi.fn((checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(() => true) }))) {
  return {
    data: {
      session: { can, subscribe: () => () => undefined },
      repositories: { organizations: { current: () => Promise.resolve({ ok: true, value: { timezone: 'Asia/Jerusalem' } }) } },
      commands: {},
      changes: { subscribe: () => () => undefined },
    },
    auth: {},
    time: { now: () => clock.now },
  } as unknown as LogicPorts
}

describe('today turns at midnight (D-107, OI-057)', () => {
  it('moves to the new day with the screen open, and asks the hints again', async () => {
    // 23:59:59.7 in Jerusalem.
    const clock = { now: '2026-11-11T21:59:59.700Z' }
    const ports = portsAt(clock)
    const check: PermissionCheck = { permission: { resource: 'soldiers', action: 'view' }, target: { kind: 'organization' } }
    const checks = [check]
    const { result } = renderHook(() => ({ today: useToday(), can: useCan(checks) }), {
      wrapper: ({ children }: { children: ReactNode }) => <LogicProvider ports={ports}>{children}</LogicProvider>,
    })
    await waitFor(() => {
      expect(result.current.today).toBe('2026-11-11')
    })
    const asked = vi.mocked(ports.data.session.can).mock.calls.length
    clock.now = '2026-11-11T22:00:00.100Z'
    await waitFor(
      () => {
        expect(result.current.today).toBe('2026-11-12')
      },
      { timeout: 3000 },
    )
    await waitFor(() => {
      expect(vi.mocked(ports.data.session.can).mock.calls.length).toBeGreaterThan(asked)
    })
  })
})

describe('view state in the URL (D-103, D-104)', () => {
  const rootRoute = createRootRoute()
  const PLATOON = UnitId.parse(uuid(11))

  function Probe() {
    const search = useWorkspaceSearch()
    const panel = usePanel()
    const window = useDateWindow()
    const filter = useViewFilter()
    const view = useActiveView(['timeline'])
    return (
      <div>
        <p data-testid="search">{JSON.stringify(search)}</p>
        <p data-testid="window">{JSON.stringify([window.window?.from, window.window?.to, view.view, filter.unit.kind])}</p>
        <button type="button" data-testid="open" onClick={() => { panel.open(PANEL_IDS.soldiers) }} />
        <button type="button" data-testid="close" onClick={panel.close} />
        <button type="button" data-testid="next" onClick={() => { window.shift(1) }} />
        <button type="button" data-testid="today" onClick={window.goToToday} />
        <button type="button" data-testid="unit" onClick={() => { filter.selectUnit(PLATOON) }} />
      </div>
    )
  }

  async function renderAt(url: string) {
    const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Probe, validateSearch: WorkspaceSearch })
    const history = createMemoryHistory({ initialEntries: [url] })
    const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
    const ports = portsAt({ now: '2026-11-11T10:00:00.000Z' })
    render(
      <LogicProvider ports={ports}>
        <RouterProvider router={router as never} />
      </LogicProvider>,
    )
    await screen.findByTestId('search')
    return { history }
  }

  const read = (id: string) => JSON.parse(screen.getByTestId(id).textContent) as unknown
  const press = (id: string) => {
    act(() => {
      screen.getByTestId(id).click()
    })
  }

  it('moves the week, returns to today, and the back button undoes each step', async () => {
    const { history } = await renderAt('/')
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-11-08', '2026-11-14', 'timeline', 'organization'])
    })
    press('next')
    await waitFor(() => {
      expect(read('search')).toEqual({ from: '2026-11-15', to: '2026-11-21' })
    })
    press('today')
    await waitFor(() => {
      expect(read('search')).toEqual({})
    })
    act(() => {
      history.back()
    })
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-11-15', '2026-11-21', 'timeline', 'organization'])
    })
  })

  it('keeps the window and the filter when a panel opens and closes', async () => {
    await renderAt('/?from=2026-12-06&to=2026-12-12')
    press('unit')
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-12-06', '2026-12-12', 'timeline', 'unit'])
    })
    press('open')
    await waitFor(() => {
      expect(read('search')).toMatchObject({ panel: 'soldiers', from: '2026-12-06', filter: unitFilterOf(PLATOON) })
    })
    press('close')
    await waitFor(() => {
      expect(read('search')).toEqual({ from: '2026-12-06', to: '2026-12-12', filter: unitFilterOf(PLATOON) })
    })
  })

  it('counts an invalid view, window or filter as absent', async () => {
    await renderAt('/?view=calendar&from=nope&to=2026-12-12&filter=%7B%22where%22%3A1%7D')
    await waitFor(() => {
      expect(read('window')).toEqual(['2026-11-08', '2026-11-14', 'timeline', 'organization'])
    })
  })
})
