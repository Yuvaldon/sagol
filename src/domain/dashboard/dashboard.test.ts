import { describe, expect, it } from 'vitest'
import { LeaveId, LeaveTypeId, SoldierId, type DashboardModule, type LeaveStatus } from '@contracts'
import {
  addModule,
  defaultTemplate,
  layoutModules,
  leaveAsOf,
  moveModule,
  myRotationFigures,
  planOf,
  removeModule,
  templateChoice,
  type DashboardTemplates,
  type PlanEvent,
  type PlanLeave,
} from './index'

// Test data only (iron rule 4).

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const SOLDIER = SoldierId.parse(uuid(1))
const OTHER = SoldierId.parse(uuid(2))
const HOME_TYPE = LeaveTypeId.parse(uuid(10))
const OTHER_TYPE = LeaveTypeId.parse(uuid(11))
const leaveId = (n: number) => LeaveId.parse(uuid(100 + n))

function leave(n: number, status: LeaveStatus, start: string, end: string): PlanLeave {
  return {
    id: leaveId(n),
    soldier_id: SOLDIER,
    leave_type_id: HOME_TYPE,
    start_date: start,
    end_date: end,
    status,
    availability_effect_override: null,
  }
}

function event(n: number, at: string, patch: Partial<PlanEvent>): PlanEvent {
  return { leave_id: leaveId(n), event_type: 'updated', to_status: null, changes: {}, created_at: at, ...patch }
}

const PLAN_AT = '2026-12-01T00:00:00Z'

describe('leaveAsOf (D-358)', () => {
  const now = leave(1, 'approved', '2026-12-10', '2026-12-12')
  const events = [
    event(1, '2026-11-20T08:00:00Z', { event_type: 'created', to_status: 'pending' }),
    event(1, '2026-11-25T08:00:00Z', { event_type: 'approved', to_status: 'approved' }),
    event(1, '2026-12-03T08:00:00Z', {
      event_type: 'rescheduled',
      changes: { start_date: { before: '2026-12-05', after: '2026-12-10' }, end_date: { before: '2026-12-07', after: '2026-12-12' } },
    }),
  ]

  it('rolls dates back through later events and keeps the status of the time', () => {
    expect(leaveAsOf(now, events, PLAN_AT)).toEqual({ ...now, start_date: '2026-12-05', end_date: '2026-12-07' })
  })

  it('has no leave before it was created', () => {
    expect(leaveAsOf(now, events, '2026-11-19T00:00:00Z')).toBeNull()
  })

  it('takes a leave with no history as it is now', () => {
    expect(leaveAsOf(now, [], PLAN_AT)).toBe(now)
  })

  it('ignores a malformed before value', () => {
    const odd = [...events.slice(0, 2), event(1, '2026-12-03T08:00:00Z', { changes: { start_date: { before: 7, after: '2026-12-10' } } })]
    expect(leaveAsOf(now, odd, PLAN_AT)?.start_date).toBe('2026-12-10')
  })
})

describe('planOf (D-349)', () => {
  it('counts added, cancelled, moved and unrecorded leaves', () => {
    const created = (n: number, status: LeaveStatus) => event(n, '2026-11-20T08:00:00Z', { event_type: 'created', to_status: status })
    const leaves = [
      leave(1, 'approved', '2026-12-10', '2026-12-12'),
      leave(2, 'cancelled', '2026-12-10', '2026-12-12'),
      leave(3, 'approved', '2026-12-14', '2026-12-15'),
      leave(4, 'approved', '2026-12-20', '2026-12-21'),
    ]
    const events = new Map([
      [leaveId(1), [created(1, 'pending'), event(1, '2026-12-02T08:00:00Z', { event_type: 'approved', to_status: 'approved' })]],
      [leaveId(2), [created(2, 'approved'), event(2, '2026-12-02T08:00:00Z', { event_type: 'cancelled', to_status: 'cancelled' })]],
      [
        leaveId(3),
        [
          created(3, 'approved'),
          event(3, '2026-12-02T08:00:00Z', { changes: { start_date: { before: '2026-12-13', after: '2026-12-14' } } }),
        ],
      ],
    ])
    const plan = planOf(leaves, events, PLAN_AT)
    expect({ ...plan, planned: plan.planned.map((row) => [row.id, row.status, row.start_date]) }).toEqual({
      planned: [
        [leaveId(1), 'pending', '2026-12-10'],
        [leaveId(2), 'approved', '2026-12-10'],
        [leaveId(3), 'approved', '2026-12-13'],
        [leaveId(4), 'approved', '2026-12-20'],
      ],
      added: 1,
      cancelled: 1,
      moved: 1,
      unrecorded: 1,
    })
  })
})

const TEMPLATES: DashboardTemplates = {
  leaves: [{ module: 'outstanding' }, { module: 'upcoming' }],
  control: [{ module: 'presence_by_unit' }],
  report: [{ module: 'stat', metric: 'present_today' }, { module: 'fairness_spread' }],
}

describe('layouts (D-349)', () => {
  it('defaults to control with enough sub-units with rows', () => {
    expect(defaultTemplate(2, 2)).toBe('control')
    expect(defaultTemplate(1, 2)).toBe('leaves')
  })

  it('draws the default, a chosen template or a custom list', () => {
    expect(layoutModules(null, 'control', TEMPLATES)).toBe(TEMPLATES.control)
    expect(layoutModules({ kind: 'template', template: 'report' }, 'control', TEMPLATES)).toBe(TEMPLATES.report)
    const custom: DashboardModule[] = [{ module: 'fairness_spread' }]
    expect(layoutModules({ kind: 'custom', modules: custom }, 'control', TEMPLATES)).toBe(custom)
  })

  it('stores nothing for the default template', () => {
    expect(templateChoice('leaves', 'leaves')).toBeNull()
    expect(templateChoice('report', 'leaves')).toEqual({ kind: 'template', template: 'report' })
  })

  it('moves, removes and adds modules', () => {
    const modules = TEMPLATES.report
    expect(moveModule(modules, 0, 1)).toEqual([{ module: 'fairness_spread' }, { module: 'stat', metric: 'present_today' }])
    expect(moveModule(modules, 0, -1)).toBe(modules)
    expect(removeModule(modules, 0)).toEqual([{ module: 'fairness_spread' }])
    expect(addModule(modules, { module: 'fairness_spread' })).toBe(modules)
    expect(addModule(modules, { module: 'stat', metric: 'home_today' })).toHaveLength(3)
  })
})

describe('myRotationFigures (D-350)', () => {
  const rotation = { start_date: '2026-12-01', end_date: '2026-12-20' }
  const served = [{ valid_from: '2026-12-01', valid_to: '2026-12-20' }]
  const homeLeaves = [
    { id: leaveId(1), leave_type_id: HOME_TYPE, start_date: '2026-12-04', end_date: '2026-12-05' },
    { id: leaveId(2), leave_type_id: HOME_TYPE, start_date: '2026-12-15', end_date: '2026-12-17' },
  ]
  const mine = (n: number, status: LeaveStatus, by = SOLDIER, type = HOME_TYPE) => ({
    id: leaveId(n),
    soldier_id: SOLDIER,
    created_by: by,
    leave_type_id: type,
    status,
  })
  const leaves = [
    mine(1, 'approved'),
    mine(2, 'approved'),
    mine(3, 'rejected'),
    mine(4, 'pending'),
    mine(5, 'cancelled'),
    mine(6, 'approved', OTHER),
    mine(7, 'pending', SOLDIER, OTHER_TYPE),
  ]
  const isRequestType = (type: LeaveTypeId) => type === HOME_TYPE
  const base = { rotation, served, homeLeaves, leaves, isRequestType }

  it('counts days so far against the planned ones', () => {
    const figures = myRotationFigures({ ...base, today: '2026-12-10' })
    expect(figures).toEqual({
      total: 20,
      base: { sofar: 8, planned: 15 },
      home: { sofar: 2, planned: 5 },
      openRequests: 1,
      approvalRate: 2 / 3,
      next: { kind: 'next', leaveId: leaveId(2), typeId: HOME_TYPE, start: '2026-12-15', end: '2026-12-17', inDays: 5 },
      left: { kind: 'left', days: 10, lastDay: '2026-12-20', elapsed: 10, total: 20 },
    })
  })

  it('says until when the soldier is at home today', () => {
    expect(myRotationFigures({ ...base, today: '2026-12-16' }).next).toEqual({ kind: 'home', until: '2026-12-17' })
  })

  it('has no total and no end for an open rotation, and says when a rotation starts', () => {
    const open = myRotationFigures({ ...base, rotation: { ...rotation, end_date: null }, served: [{ valid_from: '2026-12-01', valid_to: null }], today: '2026-12-10' })
    expect([open.total, open.base.planned, open.left]).toEqual([null, null, null])
    const before = myRotationFigures({ ...base, today: '2026-11-28' })
    expect([before.base.sofar, before.left]).toEqual([0, { kind: 'starts', date: '2026-12-01' }])
    expect(before.next).toMatchObject({ kind: 'next', start: '2026-12-04', inDays: 6 })
  })

  it('has no next leave and no rate with nothing planned or decided', () => {
    const figures = myRotationFigures({ ...base, homeLeaves: [], leaves: [], today: '2026-12-10' })
    expect([figures.next, figures.approvalRate]).toEqual([{ kind: 'none' }, null])
  })
})
