import type {
  CalendarDate,
  LeaveId,
  LeaveStatus,
  LeaveTypeId,
  SoldierId,
  Timestamp,
  UnitId,
  UnitMembershipId,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import { presenceWithMe, type PresenceWithMeInput } from '.'

// "איתך היום" (D-478): who of the holder's own unit is on base, by name. Sample rows, test file only.

const day = (value: string) => value as CalendarDate
const DATE = day('2026-11-10')
const COMPANY = 'c0000000-0000-4000-8000-000000000001' as UnitId
const PLATOON = 'c0000000-0000-4000-8000-000000000002' as UnitId
const SQUAD = 'c0000000-0000-4000-8000-000000000003' as UnitId
const SISTER = 'c0000000-0000-4000-8000-000000000004' as UnitId
const HOME: LeaveTypeId = 'd0000000-0000-4000-8000-000000000001' as LeaveTypeId
const MARKER: LeaveTypeId = 'd0000000-0000-4000-8000-000000000002' as LeaveTypeId

const soldierId = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}` as SoldierId
const HOLDER = soldierId(1)

const units = [
  { id: COMPANY, parent_id: null, unit_level_id: null },
  { id: PLATOON, parent_id: COMPANY, unit_level_id: null },
  { id: SQUAD, parent_id: PLATOON, unit_level_id: null },
  { id: SISTER, parent_id: COMPANY, unit_level_id: null },
]

function soldier(n: number, overrides: { status?: 'active' | 'inactive'; archived_at?: Timestamp | null } = {}) {
  return { id: soldierId(n), first_name: `First${n}`, last_name: `Last${n}`, status: 'active' as const, archived_at: null, ...overrides }
}

let membershipCount = 0
function member(n: number, unit_id: UnitId, valid_from = '2026-01-01', valid_to: string | null = null) {
  membershipCount += 1
  return {
    id: `b0000000-0000-4000-8000-${String(membershipCount).padStart(12, '0')}` as UnitMembershipId,
    soldier_id: soldierId(n),
    unit_id,
    membership_type: 'primary' as const,
    valid_from: day(valid_from),
    valid_to: valid_to === null ? null : day(valid_to),
  }
}

let leaveCount = 0
function leave(n: number, status: LeaveStatus, leave_type_id: LeaveTypeId = HOME) {
  leaveCount += 1
  return {
    id: `e0000000-0000-4000-8000-${String(leaveCount).padStart(12, '0')}` as LeaveId,
    soldier_id: soldierId(n),
    leave_type_id,
    start_date: day('2026-11-09'),
    end_date: day('2026-11-11'),
    status,
    availability_effect_override: null,
  }
}

const leave_types = [
  { id: HOME, availability_effect: 'unavailable' as const },
  { id: MARKER, availability_effect: 'available' as const },
]

function input(overrides: Partial<PresenceWithMeInput> = {}): PresenceWithMeInput {
  return {
    holderId: HOLDER,
    date: DATE,
    units,
    soldiers: [soldier(1), soldier(2), soldier(3), soldier(4), soldier(5)],
    memberships: [member(1, PLATOON), member(2, PLATOON), member(3, SQUAD), member(4, COMPANY), member(5, SISTER)],
    leaves: [],
    leave_types,
    ...overrides,
  }
}

const ids = (answer: ReturnType<typeof presenceWithMe>) => answer?.soldiers.map((row) => row.id) ?? null

describe('presenceWithMe (D-478)', () => {
  it('names the soldiers of the holder\'s unit and the units under it, never above it or beside it, nor the holder', () => {
    const answer = presenceWithMe(input())
    expect(answer).toEqual({
      date: DATE,
      soldiers: [
        { id: soldierId(2), first_name: 'First2', last_name: 'Last2' },
        { id: soldierId(3), first_name: 'First3', last_name: 'Last3' },
      ],
    })
  })

  it('answers names alone: no status, no leave, no unit', () => {
    const answer = presenceWithMe(input({ leaves: [leave(2, 'approved', MARKER)] }))
    for (const row of answer?.soldiers ?? []) expect(Object.keys(row).sort()).toEqual(['first_name', 'id', 'last_name'])
  })

  it('leaves out who is away by an approved leave, and keeps who only asked or is marked', () => {
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'approved')] })))).toEqual([soldierId(3)])
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'pending'), leave(3, 'approved', MARKER)] })))).toEqual([
      soldierId(2),
      soldierId(3),
    ])
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'rejected'), leave(3, 'cancelled')] })))).toEqual([
      soldierId(2),
      soldierId(3),
    ])
  })

  it('leaves out an inactive or archived soldier, and one placed elsewhere on the day', () => {
    const soldiers = [soldier(1), soldier(2, { status: 'inactive' }), soldier(3, { archived_at: '2026-11-01T00:00:00.000Z' as Timestamp }), soldier(6)]
    const memberships = [member(1, PLATOON), member(2, PLATOON), member(3, SQUAD), member(6, PLATOON, '2026-01-01', '2026-11-09'), member(6, SISTER, '2026-11-10')]
    expect(ids(presenceWithMe(input({ soldiers, memberships })))).toEqual([])
  })

  it('is NULL for a holder with no unit on the day, and follows the holder to a new unit', () => {
    expect(presenceWithMe(input({ memberships: [member(1, PLATOON, '2026-01-01', '2026-11-01'), member(2, PLATOON)] }))).toBeNull()
    const moved = [member(1, PLATOON, '2026-01-01', '2026-11-09'), member(1, SISTER, '2026-11-10'), member(2, PLATOON), member(5, SISTER)]
    expect(ids(presenceWithMe(input({ memberships: moved })))).toEqual([soldierId(5)])
  })

  it('answers an empty list when nobody else is on base', () => {
    expect(presenceWithMe(input({ leaves: [leave(2, 'approved'), leave(3, 'approved')] }))).toEqual({ date: DATE, soldiers: [] })
  })
})
