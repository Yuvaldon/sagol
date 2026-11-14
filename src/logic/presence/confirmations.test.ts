import {
  DeploymentId,
  LeaveEventId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  ReportConfirmationId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type CalendarDate,
  type Deployment,
  type Leave,
  type LeaveEvent,
  type ReportConfirmation,
  type Soldier,
  type UnitMembership,
} from '@contracts'
import { buildUnitTree } from '@domain'
import { describe, expect, it } from 'vitest'
import { dayConfirmations, type DayConfirmationsInput } from './confirmations'
import type { ReportDay, ReportEntry, ReportSection } from './report'

// Sample rows, test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const CONFIRMED_AT = '2026-11-08T12:00:00.000Z'
const DAY = '2026-12-10'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

const COMPANY = UnitId.parse(uuid(10))
const SQUAD = UnitId.parse(uuid(11))
const OTHER = UnitId.parse(uuid(12))
const ELSEWHERE = UnitId.parse(uuid(13))
const LEVEL = null
// The company holds the squad and the other unit; ELSEWHERE stands beside it, outside the rotation.
const TREE = buildUnitTree([
  { id: COMPANY, parent_id: null, unit_level_id: LEVEL },
  { id: SQUAD, parent_id: COMPANY, unit_level_id: LEVEL },
  { id: OTHER, parent_id: COMPANY, unit_level_id: LEVEL },
  { id: ELSEWHERE, parent_id: null, unit_level_id: LEVEL },
])
const OWNER = SoldierId.parse(uuid(1))
const ACTOR = SoldierId.parse(uuid(2))

function soldier(n: number): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name: `F${String(n)}`,
    last_name: 'L',
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
  }
}

const entry = (n: number): ReportEntry => ({ soldier: soldier(n), rank: null, absences: [], reasons: [], leaving: false, returning: false })
const COUNTS = { total: 0, present: 0, absent: 0, leaving: 0, returning: 0 }

function section(unitId: UnitId | null, present: readonly number[]): ReportSection {
  return {
    key: unitId ?? 'none',
    unitId,
    label: unitId === null ? { kind: 'none' } : { kind: 'unit', path: [unitId] },
    counts: COUNTS,
    present: present.map(entry),
    absent: [],
    leaving: [],
    returning: [],
  }
}

function rotation(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: DeploymentId.parse(uuid(90)),
    organization_id: ORGANIZATION,
    name: 'Rotation',
    unit_id: COMPANY,
    start_date: '2026-12-01',
    end_date: '2026-12-20',
    closed_at: null,
    closed_by: null,
    report_owner_id: null,
    ...audit,
    ...overrides,
  }
}

function day(rotations: readonly Deployment[], units: readonly ReportSection[]): ReportDay {
  return { date: DAY, rotations, units, counts: COUNTS, present: [], absent: [], leaving: [], returning: [] }
}

function confirmation(unitId: UnitId, date: CalendarDate = DAY): ReportConfirmation {
  return {
    id: ReportConfirmationId.parse(uuid(300)),
    organization_id: ORGANIZATION,
    unit_id: unitId,
    report_date: date,
    confirmed_by: ACTOR,
    confirmed_at: CONFIRMED_AT,
    seen_seq: SEEN,
  }
}

function leave(soldierN: number, start: CalendarDate, end: CalendarDate): Leave {
  return {
    id: LeaveId.parse(uuid(400 + soldierN)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    leave_type_id: LeaveTypeId.parse(uuid(70)),
    batch_id: null,
    deployment_id: DeploymentId.parse(uuid(90)),
    start_date: start,
    end_date: end,
    status: 'pending',
    reason: null,
    availability_effect_override: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    ...audit,
  }
}

/** The change number the confirmations were read at. */
const SEEN = 5
let next = 500

/** A leave's event numbered `seq`, with the `before` values of the dates it moved. */
function event(
  of: Leave,
  seq: number,
  before: { start_date?: CalendarDate; end_date?: CalendarDate } = {},
): LeaveEvent {
  const changes = Object.fromEntries(
    Object.entries(before).map(([field, value]) => [
      field,
      { before: value, after: of[field as 'start_date' | 'end_date'] },
    ]),
  )
  return {
    id: LeaveEventId.parse(uuid((next += 1))),
    organization_id: ORGANIZATION,
    leave_id: of.id,
    actor_id: ACTOR,
    event_type: 'updated',
    from_status: null,
    to_status: null,
    changes,
    acknowledged_rule_ids: [],
    change_seq: seq,
    created_at: AT,
  }
}

function membership(soldierN: number, unitId: UnitId, validFrom: CalendarDate, seq: number): UnitMembership {
  return {
    id: UnitMembershipId.parse(uuid((next += 1))),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    unit_id: unitId,
    membership_type: 'primary',
    valid_from: validFrom,
    valid_to: null,
    change_seq: seq,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }
}

const NO_CHANGES = { leaves: [], events: [], memberships: [] }
const WHOLE = [section(SQUAD, [5, 6]), section(OTHER, [7]), section(null, [8])]

function input(overrides: Partial<DayConfirmationsInput> = {}): DayConfirmationsInput {
  const whole = day([rotation()], WHOLE)
  return {
    day: whole,
    shown: whole,
    confirmations: [],
    changes: NO_CHANGES,
    confirmable: (unitId, date) => unitId === SQUAD && date === DAY,
    mayConfirm: () => true,
    tree: TREE,
    actorId: ACTOR,
    seenSeq: SEEN,
    unseen: 0,
    ...overrides,
  }
}

describe('the daily report confirmations (D-293)', () => {
  it('gives each unit section a status, and none to a section with no unit', () => {
    const result = dayConfirmations(input({ confirmations: [confirmation(SQUAD), confirmation(OTHER, '2026-12-09')] }))
    expect(result.sections.get(SQUAD)?.status).toBe('confirmed')
    expect(result.sections.get(OTHER)?.status).toBe('not_yet')
    expect(result.sections.has('none')).toBe(false)
    expect(result.seenSeq).toBe(SEEN)
  })

  it('reads a section as changed when a leave of its soldiers touching the day or a neighbor was written after', () => {
    const confirmations = [confirmation(SQUAD)]
    const statusOf = (leaves: readonly Leave[], events: readonly LeaveEvent[]) =>
      dayConfirmations(input({ confirmations, changes: { leaves, events, memberships: [] } })).sections.get(SQUAD)
        ?.status
    const touching = leave(5, '2026-12-11', '2026-12-12')
    expect(statusOf([touching], [event(touching, SEEN + 1)])).toBe('changed_since')
    // Written before the confirmation was read, far from the day, or in another unit: no change.
    expect(statusOf([touching], [event(touching, SEEN)])).toBe('confirmed')
    const far = leave(6, '2026-12-12', '2026-12-14')
    const elsewhere = leave(7, DAY, DAY)
    expect(statusOf([far, elsewhere], [event(far, SEEN + 1), event(elsewhere, SEEN + 2)])).toBe('confirmed')
  })

  it('reads a leave moved off the day as a change, through the dates its events held (OI-254)', () => {
    const confirmations = [confirmation(SQUAD)]
    const statusOf = (leaves: readonly Leave[], events: readonly LeaveEvent[]) =>
      dayConfirmations(input({ confirmations, changes: { leaves, events, memberships: [] } })).sections.get(SQUAD)
        ?.status
    const moved = leave(5, '2026-12-15', '2026-12-16')
    expect(statusOf([moved], [event(moved, SEEN + 2, { start_date: DAY, end_date: DAY })])).toBe('changed_since')
    // Two moves after the confirmation: the day is reached through the earlier one.
    const twice = leave(6, '2026-12-18', '2026-12-18')
    const events = [
      event(twice, SEEN + 3, { start_date: '2026-12-15', end_date: '2026-12-15' }),
      event(twice, SEEN + 1, { start_date: DAY, end_date: DAY }),
    ]
    expect(statusOf([twice], events)).toBe('changed_since')
    // Moved off the day before the confirmation, then moved again far away: no change.
    const before = [
      event(twice, SEEN + 3, { start_date: '2026-12-15', end_date: '2026-12-15' }),
      event(twice, SEEN, { start_date: DAY, end_date: DAY }),
    ]
    expect(statusOf([twice], before)).toBe('confirmed')
  })

  it('reads a membership written in the unit after the confirmation as a change, from its first day on (OI-255)', () => {
    const confirmations = [confirmation(SQUAD)]
    const statusOf = (memberships: readonly UnitMembership[]) =>
      dayConfirmations(input({ confirmations, changes: { leaves: [], events: [], memberships } })).sections.get(SQUAD)
        ?.status
    expect(statusOf([membership(9, SQUAD, '2026-12-01', SEEN + 1)])).toBe('changed_since')
    expect(statusOf([membership(9, SQUAD, DAY, SEEN + 1)])).toBe('changed_since')
    expect(statusOf([membership(9, SQUAD, '2026-12-11', SEEN + 1)])).toBe('confirmed')
    expect(statusOf([membership(9, SQUAD, '2026-12-01', SEEN)])).toBe('confirmed')
    expect(statusOf([membership(9, OTHER, '2026-12-01', SEEN + 1)])).toBe('confirmed')
  })

  it('offers the button where the data layer answers the report confirmable, whatever units the actor sees', () => {
    const result = dayConfirmations(input({ mayConfirm: () => false }))
    expect(result.sections.get(SQUAD)).toMatchObject({ canConfirm: true, needsFullList: false })
    expect(result.sections.get(OTHER)).toMatchObject({ canConfirm: false, needsFullList: false })
    expect(dayConfirmations(input({ confirmable: () => false })).sections.get(SQUAD)?.canConfirm).toBe(false)
  })

  it('reads a filtered section on the whole unit, and asks for the full list instead of offering the button', () => {
    // The view filter hides soldier 6, whose leave changed the day after the confirmation.
    const shown = day([rotation()], [section(SQUAD, [5]), section(OTHER, [7])])
    const changed = leave(6, DAY, DAY)
    const changes = { leaves: [changed], events: [event(changed, SEEN + 1)], memberships: [] }
    const result = dayConfirmations(input({ shown, confirmations: [confirmation(SQUAD)], changes }))
    expect(result.sections.get(SQUAD)).toMatchObject({
      status: 'changed_since',
      canConfirm: false,
      needsFullList: true,
    })
    expect(result.summary).toEqual({ total: 2, confirmed: 0, changed: 1, unseen: 0 })
    // A section the filter leaves whole is confirmed as it is.
    const whole = dayConfirmations(input({ shown: day([rotation()], [section(SQUAD, [5, 6])]) }))
    expect(whole.sections.get(SQUAD)).toMatchObject({ canConfirm: true, needsFullList: false })
  })

  it('shows the summary to the named owner, or with none named to who may confirm', () => {
    const confirmations = [confirmation(SQUAD)]
    const ownedDay = day([rotation({ report_owner_id: OWNER })], WHOLE)
    expect(dayConfirmations(input({ confirmations, day: ownedDay, shown: ownedDay, actorId: OWNER })).summary).toEqual({
      total: 2,
      confirmed: 1,
      changed: 0,
      unseen: 0,
    })
    expect(dayConfirmations(input({ day: ownedDay, shown: ownedDay })).summary).toBeNull()
    expect(dayConfirmations(input()).summary).toEqual({ total: 2, confirmed: 0, changed: 0, unseen: 0 })
    expect(dayConfirmations(input({ mayConfirm: () => false })).summary).toBeNull()
  })

  it('gives no status to a section no rotation covers, unless it may be confirmed or a confirmation stands', () => {
    const outside = day([rotation()], [...WHOLE, section(ELSEWHERE, [9])])
    const bare = dayConfirmations(input({ day: outside, shown: outside }))
    expect(bare.sections.has(ELSEWHERE)).toBe(false)
    expect(bare.summary).toEqual({ total: 2, confirmed: 0, changed: 0, unseen: 0 })
    const kept = dayConfirmations(input({ day: outside, shown: outside, confirmations: [confirmation(ELSEWHERE)] }))
    expect(kept.sections.get(ELSEWHERE)?.status).toBe('confirmed')
    const offered = dayConfirmations(input({ day: outside, shown: outside, confirmable: (unitId) => unitId === ELSEWHERE }))
    expect(offered.sections.get(ELSEWHERE)?.canConfirm).toBe(true)
  })

  it("shows the data layer's count of the sections outside the actor's view to who reads the summary (D-303)", () => {
    expect(dayConfirmations(input({ unseen: 3 })).summary).toMatchObject({ total: 2, unseen: 3 })
    expect(dayConfirmations(input({ unseen: 3, mayConfirm: () => false })).summary).toBeNull()
  })
})
