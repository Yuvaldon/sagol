import { describe, expect, it } from 'vitest'
import {
  LeaveId,
  LeaveTypeId,
  SoldierId,
  TagId,
  CommandRankId,
  type AvailabilityEffect,
  type CalendarDate,
  type FilterExpression,
  type LeaveStatus,
} from '@contracts'
import { positiveSelections } from '../filters'
import { eachDay, rangeCovers } from '../time'
import {
  APPROVED_ONLY,
  createAvailabilityContext,
  effectiveEffect,
  partitionAvailability,
  statusCounts,
  type AvailabilityLeave,
} from './index'

// Test data only (iron rule 4).

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const S = { a: SoldierId.parse(uuid(1)), b: SoldierId.parse(uuid(2)), c: SoldierId.parse(uuid(3)) }
const TYPE = {
  vacation: LeaveTypeId.parse(uuid(11)),
  exam: LeaveTypeId.parse(uuid(12)),
  missing: LeaveTypeId.parse(uuid(13)),
}
const LEAVE_TYPES = [
  { id: TYPE.vacation, availability_effect: 'unavailable' as const },
  { id: TYPE.exam, availability_effect: 'available' as const },
]
const WITH_PENDING = { count_pending_as_unavailable: true }

let nextLeave = 100
function leave(
  soldierId: SoldierId,
  start: CalendarDate,
  end: CalendarDate,
  extra: Partial<AvailabilityLeave> = {},
): AvailabilityLeave {
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

describe('time ranges', () => {
  it('lists every day of an inclusive range across month and year ends', () => {
    expect(eachDay({ start_date: '2026-12-30', end_date: '2027-01-02' })).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    expect(eachDay({ start_date: '2028-02-28', end_date: '2028-03-01' })).toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
    expect(eachDay({ start_date: '2026-12-01', end_date: '2026-12-01' })).toEqual(['2026-12-01'])
    expect(eachDay({ start_date: '2026-12-02', end_date: '2026-12-01' })).toEqual([])
  })

  it('covers inclusive ranges', () => {
    const range = { start_date: '2026-12-01', end_date: '2026-12-03' }
    expect(rangeCovers(range, '2026-11-30')).toBe(false)
    expect(rangeCovers(range, '2026-12-01')).toBe(true)
    expect(rangeCovers(range, '2026-12-03')).toBe(true)
    expect(rangeCovers(range, '2026-12-04')).toBe(false)
  })
})

describe('effective effect (D-032)', () => {
  it('uses the override, else the type, else unavailable', () => {
    const exam = LEAVE_TYPES[1]
    expect(effectiveEffect({ availability_effect_override: null }, exam)).toBe('available')
    expect(effectiveEffect({ availability_effect_override: 'unavailable' }, exam)).toBe('unavailable')
    expect(effectiveEffect({ availability_effect_override: 'available' }, LEAVE_TYPES[0])).toBe('available')
    expect(effectiveEffect({ availability_effect_override: null }, undefined)).toBe('unavailable')
  })
})

describe('availability of one soldier on one day (D-012, D-070)', () => {
  it('is the union of counted leaves and lists markers without changing the status', () => {
    const vacation = leave(S.a, '2026-12-01', '2026-12-05')
    const sick = leave(S.a, '2026-12-03', '2026-12-04')
    const exam = leave(S.a, '2026-12-04', '2026-12-04', { leave_type_id: TYPE.exam })
    const context = createAvailabilityContext({ leaves: [vacation, sick, exam], leave_types: LEAVE_TYPES })

    const day = context.on(S.a, '2026-12-04', APPROVED_ONLY)
    expect(day.status).toBe('unavailable')
    expect(day.leaves).toEqual([
      { leave_id: vacation.id, status: 'approved', effect: 'unavailable', counted: true },
      { leave_id: sick.id, status: 'approved', effect: 'unavailable', counted: true },
      { leave_id: exam.id, status: 'approved', effect: 'available', counted: false },
    ])
    expect(context.on(S.a, '2026-12-06', APPROVED_ONLY)).toEqual({
      soldier_id: S.a,
      date: '2026-12-06',
      status: 'available',
      leaves: [],
    })
  })

  it('applies the override of a single leave', () => {
    const examAbsent = leave(S.a, '2026-12-01', '2026-12-01', {
      leave_type_id: TYPE.exam,
      availability_effect_override: 'unavailable',
    })
    const vacationPresent = leave(S.b, '2026-12-01', '2026-12-01', { availability_effect_override: 'available' })
    const context = createAvailabilityContext({ leaves: [examAbsent, vacationPresent], leave_types: LEAVE_TYPES })
    expect(context.isAvailable(S.a, '2026-12-01', APPROVED_ONLY)).toBe(false)
    expect(context.isAvailable(S.b, '2026-12-01', APPROVED_ONLY)).toBe(true)
  })

  it('counts pending leaves only when asked, and never lists rejected or cancelled ones', () => {
    const pending = leave(S.a, '2026-12-01', '2026-12-01', { status: 'pending' })
    const rejected = leave(S.b, '2026-12-01', '2026-12-01', { status: 'rejected' })
    const cancelled = leave(S.c, '2026-12-01', '2026-12-01', { status: 'cancelled' })
    const context = createAvailabilityContext({ leaves: [pending, rejected, cancelled], leave_types: LEAVE_TYPES })

    expect(context.on(S.a, '2026-12-01', APPROVED_ONLY)).toMatchObject({
      status: 'available',
      leaves: [{ leave_id: pending.id, status: 'pending', counted: false }],
    })
    expect(context.on(S.a, '2026-12-01', WITH_PENDING)).toMatchObject({
      status: 'unavailable',
      leaves: [{ leave_id: pending.id, counted: true }],
    })
    for (const soldierId of [S.b, S.c]) {
      expect(context.on(soldierId, '2026-12-01', WITH_PENDING)).toMatchObject({ status: 'available', leaves: [] })
    }
  })

  it('counts approved leaves always, pending ones on request, closed ones never', () => {
    expect(statusCounts('approved', APPROVED_ONLY)).toBe(true)
    expect(statusCounts('pending', APPROVED_ONLY)).toBe(false)
    expect(statusCounts('pending', WITH_PENDING)).toBe(true)
    expect(statusCounts('rejected', WITH_PENDING)).toBe(false)
    expect(statusCounts('cancelled', WITH_PENDING)).toBe(false)
  })

  it('treats a leave of an unknown type as unavailable', () => {
    const context = createAvailabilityContext({
      leaves: [leave(S.a, '2026-12-01', '2026-12-01', { leave_type_id: TYPE.missing })],
      leave_types: LEAVE_TYPES,
    })
    expect(context.isAvailable(S.a, '2026-12-01', APPROVED_ONLY)).toBe(false)
  })
})

describe('availability partition invariant (D-032)', () => {
  // A deterministic generator: many overlapping leaves of every status, type and override.
  function generator(seed: number) {
    let state = seed
    return (limit: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state % limit
    }
  }
  const STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled']
  const OVERRIDES: (AvailabilityEffect | null)[] = [null, null, 'available', 'unavailable']
  const TYPES = [TYPE.vacation, TYPE.exam, TYPE.missing]
  const DAYS = eachDay({ start_date: '2026-12-01', end_date: '2026-12-20' })

  it('puts every soldier in exactly one list, once, on every day, matching its status', () => {
    const random = generator(7)
    const soldiers = Array.from({ length: 30 }, (_, index) => SoldierId.parse(uuid(500 + index)))
    const leaves: AvailabilityLeave[] = Array.from({ length: 120 }, () => {
      const soldier = soldiers[random(soldiers.length)] ?? S.a
      const start = random(DAYS.length)
      const end = Math.min(DAYS.length - 1, start + random(6))
      return leave(soldier, DAYS[start] ?? '2026-12-01', DAYS[end] ?? '2026-12-01', {
        status: STATUSES[random(STATUSES.length)] ?? 'approved',
        leave_type_id: TYPES[random(TYPES.length)] ?? TYPE.vacation,
        availability_effect_override: OVERRIDES[random(OVERRIDES.length)] ?? null,
      })
    })
    const context = createAvailabilityContext({ leaves, leave_types: LEAVE_TYPES })
    let unavailableDays = 0
    for (const options of [APPROVED_ONLY, WITH_PENDING]) {
      for (const date of DAYS) {
        // Repeated ids in the input still give one entry per soldier.
        const partition = partitionAvailability(context, [...soldiers, ...soldiers.slice(0, 5)], date, options)
        const listed = [...partition.available, ...partition.unavailable].map((day) => day.soldier_id)
        expect(listed).toHaveLength(soldiers.length)
        expect(new Set(listed)).toEqual(new Set(soldiers))
        for (const day of partition.available) expect(day.status).toBe('available')
        for (const day of partition.unavailable) {
          expect(day.status).toBe('unavailable')
          expect(day.leaves.some((covering) => covering.counted)).toBe(true)
        }
        for (const day of partition.available) expect(day.leaves.every((covering) => !covering.counted)).toBe(true)
        unavailableDays += partition.unavailable.length
      }
    }
    // The generated world is not trivially all-available.
    expect(unavailableDays).toBeGreaterThan(0)
  })
})

describe('positive selections (D-072)', () => {
  const T = { medic: TagId.parse(uuid(21)), driver: TagId.parse(uuid(22)), exempt: TagId.parse(uuid(23)) }
  const R = { fighter: CommandRankId.parse(uuid(31)), squad: CommandRankId.parse(uuid(32)) }

  it('collects tags and ranks a matching soldier holds because of the filter', () => {
    const expression: FilterExpression = {
      where: {
        kind: 'and',
        nodes: [
          { kind: 'or', nodes: [{ kind: 'tag', match: 'any', tag_ids: [T.medic] }, { kind: 'tag', match: 'all', tag_ids: [T.driver] }] },
          { kind: 'not', node: { kind: 'tag', match: 'any', tag_ids: [T.exempt] } },
          { kind: 'tag', match: 'none', tag_ids: [T.exempt] },
          { kind: 'not', node: { kind: 'command_rank', command_rank_ids: [R.squad] } },
          { kind: 'command_rank', command_rank_ids: [R.fighter] },
        ],
      },
    }
    expect(positiveSelections(expression)).toEqual({ tag_ids: [T.medic, T.driver], command_rank_ids: [R.fighter] })
  })

  it('flips the sense under negation, twice back', () => {
    expect(
      positiveSelections({ where: { kind: 'not', node: { kind: 'tag', match: 'none', tag_ids: [T.medic] } } }),
    ).toEqual({ tag_ids: [T.medic], command_rank_ids: [] })
    expect(
      positiveSelections({
        where: { kind: 'not', node: { kind: 'not', node: { kind: 'command_rank', command_rank_ids: [R.squad] } } },
      }),
    ).toEqual({ tag_ids: [], command_rank_ids: [R.squad] })
    expect(positiveSelections({})).toEqual({ tag_ids: [], command_rank_ids: [] })
  })
})
