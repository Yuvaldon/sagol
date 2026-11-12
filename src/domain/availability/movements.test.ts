import { describe, expect, it } from 'vitest'
import { LeaveId, LeaveTypeId, SoldierId, type CalendarDate } from '@contracts'
import { APPROVED_ONLY, createAvailabilityContext, dayMovements, soldierMovement, type AvailabilityLeave } from './index'

// Test data only (iron rule 4).

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const S = { a: SoldierId.parse(uuid(1)), b: SoldierId.parse(uuid(2)), c: SoldierId.parse(uuid(3)), d: SoldierId.parse(uuid(4)) }
const TYPE = { vacation: LeaveTypeId.parse(uuid(11)), course: LeaveTypeId.parse(uuid(12)), exam: LeaveTypeId.parse(uuid(13)) }
const LEAVE_TYPES = [
  { id: TYPE.vacation, availability_effect: 'unavailable' as const },
  { id: TYPE.course, availability_effect: 'unavailable' as const },
  { id: TYPE.exam, availability_effect: 'available' as const },
]
const DAY = '2026-12-10'

let nextLeave = 100
function leave(soldierId: SoldierId, start: CalendarDate, end: CalendarDate, extra: Partial<AvailabilityLeave> = {}): AvailabilityLeave {
  nextLeave += 1
  return {
    id: LeaveId.parse(uuid(nextLeave)),
    soldier_id: soldierId,
    leave_type_id: TYPE.vacation,
    start_date: start,
    end_date: end,
    status: 'approved',
    availability_effect_override: null,
    ...extra,
  }
}

function movementOn(leaves: AvailabilityLeave[], soldierId: SoldierId = S.a, date: CalendarDate = DAY) {
  const context = createAvailabilityContext({ leaves, leave_types: LEAVE_TYPES })
  const { leaving, returning, day } = soldierMovement(context, soldierId, date, APPROVED_ONLY)
  return { status: day.status, leaving, returning }
}

describe('a soldier’s movement on a day (D-193)', () => {
  it('leaves on the first day of an absence and returns on its last', () => {
    const away = [leave(S.a, '2026-12-10', '2026-12-12')]
    expect(movementOn(away, S.a, '2026-12-10')).toEqual({ status: 'unavailable', leaving: true, returning: false })
    expect(movementOn(away, S.a, '2026-12-11')).toEqual({ status: 'unavailable', leaving: false, returning: false })
    expect(movementOn(away, S.a, '2026-12-12')).toEqual({ status: 'unavailable', leaving: false, returning: true })
    expect(movementOn(away, S.a, '2026-12-13')).toEqual({ status: 'available', leaving: false, returning: false })
    expect(movementOn(away, S.a, '2026-12-09')).toEqual({ status: 'available', leaving: false, returning: false })
  })

  it('both leaves and returns on a one-day absence', () => {
    expect(movementOn([leave(S.a, DAY, DAY)])).toEqual({ status: 'unavailable', leaving: true, returning: true })
  })

  it('reads the absence, not the leaves: back-to-back and overlapping leaves move once', () => {
    const backToBack = [leave(S.a, '2026-12-08', '2026-12-10'), leave(S.a, '2026-12-11', '2026-12-13', { leave_type_id: TYPE.course })]
    expect(movementOn(backToBack, S.a, '2026-12-10')).toEqual({ status: 'unavailable', leaving: false, returning: false })
    expect(movementOn(backToBack, S.a, '2026-12-11')).toEqual({ status: 'unavailable', leaving: false, returning: false })
    expect(movementOn(backToBack, S.a, '2026-12-13')).toMatchObject({ returning: true })
    const overlapping = [leave(S.a, '2026-12-08', '2026-12-12'), leave(S.a, '2026-12-10', '2026-12-10')]
    expect(movementOn(overlapping)).toEqual({ status: 'unavailable', leaving: false, returning: false })
  })

  it('never moves on a marker, a pending, rejected or cancelled leave, or an override to available', () => {
    for (const extra of [
      { leave_type_id: TYPE.exam },
      { status: 'pending' as const },
      { status: 'rejected' as const },
      { status: 'cancelled' as const },
      { availability_effect_override: 'available' as const },
    ]) {
      expect(movementOn([leave(S.a, DAY, DAY, extra)])).toEqual({ status: 'available', leaving: false, returning: false })
    }
  })

  it('counts an override to unavailable on a marker type', () => {
    const marker = leave(S.a, DAY, '2026-12-11', { leave_type_id: TYPE.exam, availability_effect_override: 'unavailable' })
    expect(movementOn([marker])).toEqual({ status: 'unavailable', leaving: true, returning: false })
  })

  it('steps across month and year ends', () => {
    const away = [leave(S.a, '2027-01-01', '2027-01-01')]
    expect(movementOn(away, S.a, '2027-01-01')).toEqual({ status: 'unavailable', leaving: true, returning: true })
  })
})

describe('the lists of a day (D-193)', () => {
  const leaves = [
    leave(S.a, DAY, '2026-12-12'),
    leave(S.b, '2026-12-08', DAY),
    leave(S.c, '2026-12-08', '2026-12-12'),
  ]
  const context = createAvailabilityContext({ leaves, leave_types: LEAVE_TYPES })
  const lists = dayMovements(context, [S.a, S.b, S.c, S.d, S.a], DAY, APPROVED_ONLY)
  const ids = (list: readonly { day: { soldier_id: SoldierId } }[]) => list.map((movement) => movement.day.soldier_id)

  it('partitions every soldier once into present and absent, in the given order', () => {
    expect(ids(lists.present)).toEqual([S.d])
    expect(ids(lists.absent)).toEqual([S.a, S.b, S.c])
    expect(lists.date).toBe(DAY)
  })

  it('takes leaving and returning from the absent', () => {
    expect(ids(lists.leaving)).toEqual([S.a])
    expect(ids(lists.returning)).toEqual([S.b])
  })

  it('is empty for no soldiers', () => {
    expect(dayMovements(context, [], DAY, APPROVED_ONLY)).toEqual({ date: DAY, present: [], absent: [], leaving: [], returning: [] })
  })
})
