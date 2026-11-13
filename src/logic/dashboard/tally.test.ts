import {
  DeploymentId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  UnitId,
  type CalendarDate,
  type Leave,
  type LeaveType,
  type LeaveTypeGroup,
  type Soldier,
} from '@contracts'
import { eachDay } from '@domain'
import { describe, expect, it } from 'vitest'
import { countedDays, dashboardTally, distributionOf, planTally, type DashboardRowInput, type DashboardTallyInput } from './tally'

// Sample rows, test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }
const SQUAD_A = UnitId.parse(uuid(11))
const SQUAD_B = UnitId.parse(uuid(12))
const ROTATION_GROUP: LeaveTypeGroup = {
  id: LeaveTypeGroupId.parse(uuid(60)),
  organization_id: ORGANIZATION,
  name: 'סבב יציאות',
  is_rotation_leave: true,
  sort_order: 0,
  ...audit,
}

function type(n: number, name: string, group: LeaveTypeGroup | null, sort: number): LeaveType {
  return {
    id: LeaveTypeId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    group_id: group?.id ?? null,
    name,
    color_key: 'blue',
    icon_key: null,
    availability_effect: 'unavailable',
    requires_reason: false,
    sort_order: sort,
    ...audit,
  }
}
const HOME = type(70, 'בית', ROTATION_GROUP, 0)
const SHORT = type(71, 'קצרה', ROTATION_GROUP, 1)
const SICK = type(72, 'מחלה', null, 2)

function soldier(n: number): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name: `F${n}`,
    last_name: `L${n}`,
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
  }
}

let nextLeave = 100
function leave(soldierN: number, start: CalendarDate, end: CalendarDate, extra: Partial<Leave> = {}): Leave {
  nextLeave += 1
  return {
    id: LeaveId.parse(uuid(nextLeave)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    leave_type_id: HOME.id,
    batch_id: null,
    deployment_id: DeploymentId.parse(uuid(90)),
    start_date: start,
    end_date: end,
    status: 'approved',
    reason: null,
    availability_effect_override: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    ...extra,
  }
}

const DAYS = eachDay({ start_date: '2026-11-01', end_date: '2026-11-14' })
const TODAY = '2026-11-10'
const always = () => true
const row = (n: number, subUnitId: UnitId | null, serves: DashboardRowInput['serves'] = always): DashboardRowInput => ({
  soldier: soldier(n),
  subUnitId,
  serves,
})

function input(extra: Partial<DashboardTallyInput> = {}): DashboardTallyInput {
  return {
    days: DAYS,
    today: TODAY,
    planned: false,
    // 4 joins on the 5th: not full-span.
    rows: [row(1, SQUAD_A), row(2, SQUAD_A), row(3, SQUAD_B), row(4, SQUAD_B, (day) => day >= '2026-11-05')],
    subUnitIds: [SQUAD_A, SQUAD_B],
    leaves: [
      leave(1, '2026-11-02', '2026-11-03'),
      leave(1, '2026-11-03', '2026-11-04', { leave_type_id: SICK.id }),
      leave(2, '2026-11-09', '2026-11-11', { leave_type_id: SHORT.id }),
      leave(3, '2026-11-12', '2026-11-13', { status: 'pending' }),
      leave(3, '2026-11-01', '2026-11-08', { status: 'rejected' }),
    ],
    types: [HOME, SHORT, SICK],
    groups: [ROTATION_GROUP],
    ...extra,
  }
}

describe('countedDays (D-349)', () => {
  it('counts up to today, or the whole span under planned', () => {
    expect(countedDays(DAYS, TODAY, false)).toHaveLength(10)
    expect(countedDays(DAYS, TODAY, true)).toHaveLength(14)
  })
})

describe('distributionOf', () => {
  it('splits 0..most into equal whole-day bins', () => {
    expect(distributionOf([0, 3, 11])).toEqual([
      { from: 0, to: 1, soldiers: 1 },
      { from: 2, to: 3, soldiers: 1 },
      { from: 4, to: 5, soldiers: 0 },
      { from: 6, to: 7, soldiers: 0 },
      { from: 8, to: 9, soldiers: 0 },
      { from: 10, to: 11, soldiers: 1 },
    ])
    expect(distributionOf([])).toEqual([])
  })
})

describe('dashboardTally (D-349)', () => {
  const tally = dashboardTally(input())
  const of = (n: number) => tally.rows.find((r) => r.soldier.id === SoldierId.parse(uuid(n)))

  it('counts home days once over overlapping leaves', () => {
    expect(of(1)?.tally).toMatchObject({ home: 3, outside: 0 })
    expect(of(2)?.tally.home).toBe(2)
    expect(of(3)?.tally.home).toBe(0)
  })

  it('reads the median and the gap over full-span soldiers only', () => {
    expect(of(4)?.fullSpan).toBe(false)
    expect(of(4)?.gap).toBeNull()
    expect(tally.spread).toEqual({ min: 0, median: 2, max: 3 })
    expect(of(1)?.gap).toBe(1)
    expect(tally.figures).toMatchObject({ rows: 4, fullSpan: 3, beyond: 0, meanHome: 5 / 3 })
  })

  it('counts today', () => {
    expect(tally.figures).toMatchObject({ holdsToday: true, servingToday: 4, homeToday: 1, presentToday: 3 })
    expect(tally.trend.find((day) => day.date === TODAY)).toEqual({ date: TODAY, serving: 4, present: 3, future: false })
    expect(tally.trend.find((day) => day.date === '2026-11-02')?.serving).toBe(3)
  })

  it('groups the sub-units with rows', () => {
    expect(tally.subUnits.map((unit) => [unit.unitId, unit.rows, unit.presentToday])).toEqual([
      [SQUAD_A, 2, 1],
      [SQUAD_B, 2, 2],
    ])
  })

  it('merges the rotation group and gives an overlap to the first type', () => {
    expect(tally.homeByType).toEqual([
      { kind: 'group', group: ROTATION_GROUP, types: [HOME, SHORT], days: 4 },
      { kind: 'type', type: SICK, days: 1 },
    ])
  })

  it('lists who leaves and returns over the days ahead, pending ones marked', () => {
    expect(tally.upcoming).toHaveLength(7)
    expect(tally.upcoming.find((day) => day.date === '2026-11-12')?.leaving.map((item) => item.pending)).toEqual([true])
    expect(tally.upcoming.find((day) => day.date === '2026-11-12')?.returning.map((item) => item.soldier.id)).toEqual([
      SoldierId.parse(uuid(2)),
    ])
  })

  it('has no today figures on a span that does not hold today', () => {
    expect(dashboardTally(input({ today: '2026-12-01' })).figures).toMatchObject({ holdsToday: false, servingToday: 0 })
  })
})

describe('planTally (D-349)', () => {
  it('compares the planned home days against the actual ones per sub-unit', () => {
    const counted = countedDays(DAYS, TODAY, false)
    const rows = [row(1, SQUAD_A), row(2, SQUAD_B)]
    const actual = [leave(1, '2026-11-02', '2026-11-03'), leave(2, '2026-11-05', '2026-11-05')]
    const planned = [actual[0], leave(2, '2026-11-05', '2026-11-08')].flatMap((item) => (item === undefined ? [] : [item]))
    const tally = planTally({ counted, rows, subUnitIds: [SQUAD_A, SQUAD_B], planned, actual, types: [HOME] })
    expect(tally.groups).toEqual([
      { unitId: SQUAD_A, soldier: null, planned: 2, actual: 2 },
      { unitId: SQUAD_B, soldier: null, planned: 4, actual: 1 },
    ])
    expect([tally.planned, tally.actual]).toEqual([6, 3])
  })

  it('goes per soldier when the unit has no sub-unit with rows', () => {
    const tally = planTally({ counted: DAYS, rows: [row(1, null)], subUnitIds: [SQUAD_A], planned: [], actual: [], types: [HOME] })
    expect(tally.groups).toEqual([{ unitId: null, soldier: soldier(1), planned: 0, actual: 0 }])
  })
})
