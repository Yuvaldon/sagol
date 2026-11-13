import { LEAVE_ROUNDS } from '@config'
import { DeploymentId, LeaveTypeId, OrganizationId, SoldierId, UnitId, UnitLevelId, type Deployment, type DeploymentMember } from '@contracts'
import { createRotationMembership } from '@domain'
import { describe, expect, it } from 'vitest'
import {
  groupRounds,
  leaveRoundIssues,
  newLeaveRoundValues,
  nextFirstHome,
  plannedRounds,
  roundAnswerIssues,
  rotationSoldiers,
  toLeaveRoundInput,
  type LeaveRoundValues,
  type RoundContext,
} from './planner'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const ORGANIZATION = OrganizationId.parse(uuid(90))
const TYPE = LeaveTypeId.parse(uuid(30))
const DANA = SoldierId.parse(uuid(1))
const ELI = SoldierId.parse(uuid(2))
const GAL = SoldierId.parse(uuid(3))
const HILA = SoldierId.parse(uuid(4))
const COMPANY = UnitId.parse(uuid(10))
const PLATOON = UnitId.parse(uuid(11))
const OTHER = UnitId.parse(uuid(12))
const LEVEL = UnitLevelId.parse(uuid(80))

const rotation = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: DeploymentId.parse(uuid(70)),
  organization_id: ORGANIZATION,
  name: 'סבב חורף',
  unit_id: COMPANY,
  start_date: '2026-12-01',
  end_date: '2026-12-31',
  closed_at: null,
  closed_by: null,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
  report_owner_id: null,
  ...overrides,
})
const ROTATION = rotation()
const member = (soldierId: SoldierId, start: string | null = null, end: string | null = null): DeploymentMember => ({
  deployment_id: ROTATION.id,
  soldier_id: soldierId,
  organization_id: ORGANIZATION,
  start_date: start,
  end_date: end,
  created_at: AT,
  created_by: null,
})
const UNITS = [
  { id: COMPANY, parent_id: null, unit_level_id: LEVEL },
  { id: PLATOON, parent_id: COMPANY, unit_level_id: LEVEL },
  { id: OTHER, parent_id: null, unit_level_id: LEVEL },
]
const placed = (soldier_id: SoldierId, unit_id: UnitId, valid_from = '2026-01-01', valid_to: string | null = null) => ({
  soldier_id,
  unit_id,
  valid_from,
  valid_to,
})
/** Dana in the company, Eli in its platoon, Gal in another unit; Hila in the platoon on two stretches of December. */
const MEMBERSHIPS = [
  placed(DANA, COMPANY),
  placed(ELI, PLATOON),
  placed(GAL, OTHER),
  placed(HILA, PLATOON, '2026-12-03', '2026-12-09'),
  placed(HILA, PLATOON, '2026-12-19', null),
]
const membership = (deployment_members: readonly DeploymentMember[] = [], unit_memberships = MEMBERSHIPS) =>
  createRotationMembership({ units: UNITS, unit_memberships, deployment_members })
const WHOLE_UNIT: RoundContext = { rotations: [ROTATION], members: membership() }

/** Two groups taking turns on 8 in, 6 home, over December. */
function plan(overrides: Partial<LeaveRoundValues> = {}): LeaveRoundValues {
  const values = newLeaveRoundValues('2026-11-12', ROTATION)
  return {
    ...values,
    name: 'סבבי דצמבר',
    leave_type_id: TYPE,
    groups: [
      { key: 'a', soldier_ids: [DANA], first_home: '2026-12-01' },
      { key: 'b', soldier_ids: [ELI], first_home: '2026-12-08' },
    ],
    ...overrides,
  }
}

describe('a new plan (D-316)', () => {
  it('runs from the later of today and the rotation start to its end, at the routine rhythm', () => {
    const values = newLeaveRoundValues('2026-11-12', ROTATION)
    expect(values).toMatchObject({ deployment_id: ROTATION.id, start_date: '2026-12-01', end_date: '2026-12-31' })
    expect(values).toMatchObject({ days_in: String(LEAVE_ROUNDS.defaultDaysIn), days_home: String(LEAVE_ROUNDS.defaultDaysHome) })
    expect(values.groups.map((group) => group.first_home)).toEqual(['2026-12-01'])
    expect(newLeaveRoundValues('2026-12-10', rotation({ end_date: null }))).toMatchObject({ start_date: '2026-12-10', end_date: '' })
  })

  it('starts the next group right after the last group is home', () => {
    expect(nextFirstHome(plan())).toBe('2026-12-14')
    expect(nextFirstHome(plan({ days_home: 'x' }))).toBe('2026-12-01')
    expect(nextFirstHome(plan({ groups: [] }))).toBe('2026-12-01')
  })
})

describe('the planned rounds (D-270, D-316)', () => {
  it('previews a group on the rhythm within the plan', () => {
    const values = plan()
    const [first, second] = values.groups
    if (first === undefined || second === undefined) throw new Error('two groups')
    expect(groupRounds(values, second)).toEqual([
      { start_date: '2026-12-08', end_date: '2026-12-13' },
      { start_date: '2026-12-22', end_date: '2026-12-27' },
    ])
    expect(groupRounds(plan({ days_in: '' }), first)).toEqual([])
  })

  it('plans every soldier of every group, in a rotation of the whole unit', () => {
    const rounds = plannedRounds(plan(), WHOLE_UNIT)
    expect(rounds.map((round) => [round.group, round.soldier_id, round.start_date, round.end_date])).toEqual([
      [0, DANA, '2026-12-01', '2026-12-06'],
      [0, DANA, '2026-12-15', '2026-12-20'],
      [0, DANA, '2026-12-29', '2026-12-31'],
      [1, ELI, '2026-12-08', '2026-12-13'],
      [1, ELI, '2026-12-22', '2026-12-27'],
    ])
  })

  it('cuts the rounds to the days each soldier serves, and skips who does not serve', () => {
    const context = { rotations: [ROTATION], members: membership([member(DANA, '2026-12-03', '2026-12-16'), member(GAL)]) }
    const values = plan({ groups: [{ key: 'a', soldier_ids: [DANA, ELI], first_home: '2026-12-01' }] })
    expect(plannedRounds(values, context).map((round) => [round.soldier_id, round.start_date, round.end_date])).toEqual([
      [DANA, '2026-12-03', '2026-12-06'],
      [DANA, '2026-12-15', '2026-12-16'],
    ])
    expect(rotationSoldiers(ROTATION, context.members, [DANA, ELI, GAL])).toEqual([DANA, GAL])
    expect(rotationSoldiers(null, context.members, [DANA])).toEqual([])
  })

  it('offers a whole-unit rotation only the soldiers of its unit and below it (D-336, OI-292)', () => {
    expect(rotationSoldiers(ROTATION, WHOLE_UNIT.members, [DANA, ELI, GAL, HILA])).toEqual([DANA, ELI, HILA])
    const values = plan({ groups: [{ key: 'a', soldier_ids: [GAL], first_home: '2026-12-01' }] })
    expect(plannedRounds(values, WHOLE_UNIT)).toEqual([])
  })

  it("cuts a whole-unit rotation's rounds to the soldier's membership days, gaps included (D-336, OI-292)", () => {
    const values = plan({ groups: [{ key: 'a', soldier_ids: [HILA], first_home: '2026-12-01' }] })
    expect(plannedRounds(values, WHOLE_UNIT).map((round) => [round.start_date, round.end_date])).toEqual([
      ['2026-12-03', '2026-12-06'],
      ['2026-12-19', '2026-12-20'],
      ['2026-12-29', '2026-12-31'],
    ])
    const outside = plan({ start_date: '2026-12-10', end_date: '2026-12-18', groups: [{ key: 'a', soldier_ids: [HILA], first_home: '2026-12-10' }] })
    expect(plannedRounds(outside, WHOLE_UNIT)).toEqual([])
  })

  it('sends one collective leave in the rotation, a leave per soldier and round', () => {
    const { input, rounds } = toLeaveRoundInput(plan({ reason: ' ', as_approved: true }), WHOLE_UNIT, [])
    expect(input).toMatchObject({ deployment_id: ROTATION.id, as_approved: true, batch: { name: 'סבבי דצמבר', description: null } })
    expect(input.leaves).toHaveLength(rounds.length)
    expect(input.leaves.every((leave) => leave.leave_type_id === TYPE && leave.reason === null)).toBe(true)
  })
})

describe('the plan form (D-316)', () => {
  it('passes a whole plan', () => {
    expect(leaveRoundIssues(plan(), null, WHOLE_UNIT)).toEqual([])
  })

  it('asks for a name, a type, and a reason the type requires', () => {
    expect(leaveRoundIssues(plan({ name: ' ', leave_type_id: null }), { requires_reason: true }, WHOLE_UNIT).map((issue) => issue.path)).toEqual([
      ['name'],
      ['leave_type_id'],
      ['reason'],
    ])
  })

  it('keeps the plan within the rotation, in order', () => {
    const codes = (overrides: Partial<LeaveRoundValues>) => leaveRoundIssues(plan(overrides), null, WHOLE_UNIT)
    expect(codes({ start_date: '2026-11-30' })).toContainEqual({ path: ['start_date'], code: 'too_small' })
    expect(codes({ end_date: '2027-01-02' })).toContainEqual({ path: ['end_date'], code: 'too_big' })
    expect(codes({ end_date: '2026-11-30', groups: [] })).toContainEqual({ path: ['end_date'], code: 'too_small' })
    expect(codes({ end_date: '' })).toContainEqual({ path: ['end_date'], code: 'required' })
    expect(codes({ deployment_id: null })).toContainEqual({ path: ['deployment_id'], code: 'required' })
  })

  it('asks for a rhythm of whole days within the limit', () => {
    const issues = leaveRoundIssues(plan({ days_in: '', days_home: '1.5' }), null, WHOLE_UNIT)
    expect(issues).toContainEqual({ path: ['days_in'], code: 'required' })
    expect(issues).toContainEqual({ path: ['days_home'], code: 'not_integer' })
    expect(leaveRoundIssues(plan({ days_in: '0' }), null, WHOLE_UNIT)).toContainEqual({ path: ['days_in'], code: 'too_small' })
    expect(leaveRoundIssues(plan({ days_home: String(LEAVE_ROUNDS.maxDays + 1) }), null, WHOLE_UNIT)).toContainEqual({ path: ['days_home'], code: 'too_big' })
  })

  it('asks each group for soldiers no other group has, and a first day home within the plan', () => {
    const issues = leaveRoundIssues(
      plan({
        groups: [
          { key: 'a', soldier_ids: [DANA], first_home: '' },
          { key: 'b', soldier_ids: [DANA, ELI], first_home: '2027-01-05' },
          { key: 'c', soldier_ids: [], first_home: '2026-11-20' },
        ],
      }),
      null,
      WHOLE_UNIT,
    )
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: ['groups', 0, 'first_home'], code: 'required' },
        { path: ['groups', 1, 'soldier_ids'], code: 'duplicate_item' },
        { path: ['groups', 1, 'first_home'], code: 'too_big' },
        { path: ['groups', 2, 'soldier_ids'], code: 'required' },
        { path: ['groups', 2, 'first_home'], code: 'too_small' },
      ]),
    )
  })

  it('caps how many leaves one plan makes', () => {
    const many = Array.from({ length: 60 }, (_, n) => SoldierId.parse(uuid(100 + n)))
    const values = plan({ days_in: '1', days_home: '1', groups: [{ key: 'a', soldier_ids: many, first_home: '2026-12-01' }] })
    const context: RoundContext = { rotations: [ROTATION], members: membership([], many.map((soldierId) => placed(soldierId, COMPANY))) }
    expect(plannedRounds(values, context).length).toBeGreaterThan(LEAVE_ROUNDS.maxLeaves)
    expect(leaveRoundIssues(values, null, context)).toContainEqual({ path: ['end_date'], code: 'too_big' })
  })

  it('refuses an open rotation planned to a far end date without walking every day', () => {
    const open = rotation({ end_date: null })
    const values = plan({ deployment_id: open.id, end_date: '9999-12-31', days_in: '1', days_home: '1' })
    const context: RoundContext = { rotations: [open], members: membership() }
    expect(groupRounds(values, values.groups[0] ?? { key: 'none', soldier_ids: [], first_home: '' })).toHaveLength(LEAVE_ROUNDS.maxLeaves + 1)
    expect(leaveRoundIssues(values, null, context)).toContainEqual({ path: ['end_date'], code: 'too_big' })
  })

  it("lands the command's answer on the plan's fields", () => {
    const rounds = plannedRounds(plan(), WHOLE_UNIT)
    const last = rounds.length - 1
    expect(
      roundAnswerIssues(
        [
          { path: ['batch', 'name'], code: 'required' },
          { path: ['leaves', 0, 'reason'], code: 'required' },
          { path: ['leaves', 1, 'reason'], code: 'required' },
          { path: ['leaves', last, 'soldier_id'], code: 'not_a_member' },
          { path: ['leaves', last, 'end_date'], code: 'outside_rotation' },
          { path: ['leaves'], code: 'too_big' },
        ],
        rounds,
      ),
    ).toEqual([
      { path: ['name'], code: 'required' },
      { path: ['reason'], code: 'required' },
      { path: ['groups', 1, 'soldier_ids'], code: 'not_a_member' },
      { path: ['groups', 1, 'first_home'], code: 'outside_rotation' },
      { path: ['groups'], code: 'too_big' },
    ])
  })
})
