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
import { primaryUnitOn, type MembershipSpan } from '../hierarchy'
import { presenceWithMe, type PresenceWithMeInput } from '.'

// "איתך היום" (D-478, D-479): who of the holder's own unit is on base, by name. Sample rows, test file only.

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

function soldier(n: number, overrides: { status?: 'active' | 'inactive'; archived_at?: Timestamp | null } = {}) {
  return { id: soldierId(n), first_name: `First${n}`, last_name: `Last${n}`, status: 'active' as const, archived_at: null, ...overrides }
}

let membershipCount = 0
function member(n: number, unit_id: UnitId, valid_from = '2026-01-01', valid_to: string | null = null, type: 'primary' | 'attached' = 'primary'): MembershipSpan {
  membershipCount += 1
  return {
    id: `b0000000-0000-4000-8000-${String(membershipCount).padStart(12, '0')}` as UnitMembershipId,
    soldier_id: soldierId(n),
    unit_id,
    membership_type: type,
    valid_from: day(valid_from),
    valid_to: valid_to === null ? null : day(valid_to),
  }
}

/** The primary unit on DATE, as the policy context answers it. */
const unitsOf = (memberships: readonly MembershipSpan[]) => (id: SoldierId) => primaryUnitOn(memberships, id, DATE)

let leaveCount = 0
function leave(n: number, status: LeaveStatus, leave_type_id: LeaveTypeId = HOME, start = '2026-11-09', end = '2026-11-11') {
  leaveCount += 1
  return {
    id: `e0000000-0000-4000-8000-${String(leaveCount).padStart(12, '0')}` as LeaveId,
    soldier_id: soldierId(n),
    leave_type_id,
    start_date: day(start),
    end_date: day(end),
    status,
    availability_effect_override: null,
  }
}

const leave_types = [
  { id: HOME, availability_effect: 'unavailable' as const },
  { id: MARKER, availability_effect: 'available' as const },
]

const PLACED = [member(1, PLATOON), member(2, PLATOON), member(3, SQUAD), member(4, COMPANY), member(5, SISTER), member(6, PLATOON)]

function input(overrides: Partial<PresenceWithMeInput> = {}): PresenceWithMeInput {
  return {
    holderId: HOLDER,
    date: DATE,
    unitOf: unitsOf(PLACED),
    soldiers: [soldier(1), soldier(2), soldier(3), soldier(4), soldier(5), soldier(6)],
    leaves: [],
    leave_types,
    ...overrides,
  }
}

const ids = (answer: ReturnType<typeof presenceWithMe>) => answer?.soldiers.map((row) => row.id) ?? null

describe('presenceWithMe (D-478, D-479)', () => {
  it('names the soldiers of the holder\'s own unit only: not the units under it, above it or beside it, nor the holder', () => {
    expect(presenceWithMe(input())).toEqual({
      date: DATE,
      soldiers: [
        { id: soldierId(2), first_name: 'First2', last_name: 'Last2' },
        { id: soldierId(6), first_name: 'First6', last_name: 'Last6' },
      ],
    })
  })

  it('reaches only the root for a holder placed at the root', () => {
    expect(ids(presenceWithMe(input({ holderId: soldierId(4) })))).toEqual([])
    const atRoot = unitsOf([...PLACED, member(7, COMPANY)])
    expect(ids(presenceWithMe(input({ holderId: soldierId(4), unitOf: atRoot, soldiers: [soldier(4), soldier(7), soldier(3)] })))).toEqual([soldierId(7)])
  })

  it('answers names alone: no status, no leave, no unit', () => {
    const answer = presenceWithMe(input({ leaves: [leave(2, 'approved', MARKER)] }))
    for (const row of answer?.soldiers ?? []) expect(Object.keys(row).sort()).toEqual(['first_name', 'id', 'last_name'])
  })

  it('leaves out who is away by an approved leave, and keeps who only asked, is marked, or is away another day', () => {
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'approved')] })))).toEqual([soldierId(6)])
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'pending'), leave(6, 'approved', MARKER)] })))).toEqual([soldierId(2), soldierId(6)])
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'rejected'), leave(6, 'cancelled')] })))).toEqual([soldierId(2), soldierId(6)])
    expect(ids(presenceWithMe(input({ leaves: [leave(2, 'approved', HOME, '2026-11-11', '2026-11-12')] })))).toEqual([soldierId(2), soldierId(6)])
    const overridden = { ...leave(2, 'approved'), availability_effect_override: 'available' as const }
    expect(ids(presenceWithMe(input({ leaves: [overridden] })))).toEqual([soldierId(2), soldierId(6)])
  })

  it('leaves out an inactive or archived soldier, one placed elsewhere on the day, and one attached there without being placed', () => {
    const soldiers = [soldier(1), soldier(2, { status: 'inactive' }), soldier(6, { archived_at: '2026-11-01T00:00:00.000Z' as Timestamp }), soldier(7), soldier(8)]
    const memberships = [
      member(1, PLATOON),
      member(2, PLATOON),
      member(6, PLATOON),
      member(7, PLATOON, '2026-01-01', '2026-11-09'),
      member(7, SISTER, '2026-11-10'),
      member(8, SISTER),
      member(8, PLATOON, '2026-01-01', null, 'attached'),
    ]
    expect(ids(presenceWithMe(input({ soldiers, unitOf: unitsOf(memberships) })))).toEqual([])
  })

  it('is NULL for a holder with no unit on the day, and follows the holder to a new unit', () => {
    expect(presenceWithMe(input({ unitOf: unitsOf([member(1, PLATOON, '2026-01-01', '2026-11-01'), member(2, PLATOON)]) }))).toBeNull()
    const moved = unitsOf([member(1, PLATOON, '2026-01-01', '2026-11-09'), member(1, SISTER, '2026-11-10'), member(2, PLATOON), member(5, SISTER)])
    expect(ids(presenceWithMe(input({ unitOf: moved })))).toEqual([soldierId(5)])
  })

  it('answers an empty list when nobody else is on base', () => {
    expect(presenceWithMe(input({ leaves: [leave(2, 'approved'), leave(6, 'approved')] }))).toEqual({ date: DATE, soldiers: [] })
  })
})
