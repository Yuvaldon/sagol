import { UnitId, type Leave } from '@contracts'
import { describe, expect, it } from 'vitest'
import { DASHBOARD_CATALOGUE, moduleState, outstandingOf, type Dashboard, type DashboardRules } from './hooks'
import { dashboardTally } from './tally'

// Sample rows, test data only.
const UNIT = UnitId.parse('00000000-0000-4000-8000-000000000010')
const DAYS = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
const TALLY = dashboardTally({ days: DAYS, today: '2026-11-13', planned: false, rows: [], subUnitIds: [], leaves: [], types: [], groups: [] })
const RULES: DashboardRules = { belowDays: 0, nextBelow: '2026-11-20', days: new Map(), ahead: ['2026-11-20', '2026-11-21'], today: new Map() }

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  scope: {
    units: [],
    unitId: UNIT,
    subUnitIds: [],
    window: { kind: 'custom', from: DAYS[0] ?? '', to: '2026-11-13', days: DAYS, rotationId: null, followsToday: true, holdsToday: true },
    rotation: null,
    today: '2026-11-13',
    planned: false,
    rows: [],
  },
  tally: TALLY,
  plan: null,
  rules: { status: 'ready', value: null },
  approver: false,
  requests: { status: 'ready', value: [] },
  report: { status: 'ready', value: null },
  ...overrides,
})

describe('moduleState (D-349)', () => {
  it('hides what has nothing to show and keeps the always-drawn ones', () => {
    const board = dashboard()
    expect(moduleState({ module: 'upcoming' }, board)).toBe('ready')
    expect(moduleState({ module: 'stat', metric: 'serving' }, board)).toBe('ready')
    expect(moduleState({ module: 'heat_map' }, board)).toBe('hidden')
    expect(moduleState({ module: 'plan_vs_actual' }, board)).toBe('hidden')
    expect(moduleState({ module: 'report_status' }, board)).toBe('hidden')
    expect(moduleState({ module: 'outstanding' }, board)).toBe('hidden')
    expect(moduleState({ module: 'stat', metric: 'awaiting_me' }, board)).toBe('hidden')
  })

  it('shows the rule modules once a rule concerns the unit, loading while it is read', () => {
    expect(moduleState({ module: 'outstanding' }, dashboard({ rules: { status: 'ready', value: RULES } }))).toBe('ready')
    expect(moduleState({ module: 'stat', metric: 'below_minimum_days' }, dashboard({ rules: { status: 'loading' } }))).toBe('loading')
  })

  it('lists every module and every metric once', () => {
    expect(DASHBOARD_CATALOGUE).toHaveLength(10 + 9)
  })
})

describe('outstandingOf (D-349)', () => {
  const leave = (created_at: string): Leave => ({ created_at }) as never
  it('puts requests before rule days and only an approver sees requests', () => {
    const requests = { status: 'ready' as const, value: [leave('a')] }
    const rules = { status: 'ready' as const, value: RULES }
    const approver = outstandingOf(dashboard({ approver: true, requests, rules }))
    expect(approver.status === 'ready' && approver.value.items.map((item) => item.kind)).toEqual(['request', 'rule', 'rule'])
    const viewer = outstandingOf(dashboard({ requests, rules }))
    expect(viewer.status === 'ready' && viewer.value.total).toBe(2)
  })
})
