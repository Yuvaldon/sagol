import { CalendarDate, LeaveId, LeaveTypeId, OrganizationId, SoldierId, type LeaveType, type Soldier } from '@contracts'
import { dictionary as he } from '@i18n'
import type { BoardItem, BoardLeave, RoundMove } from '@logic'
import { describe, expect, it } from 'vitest'
import { barLeaves, extraLanes, originalPlaces, runsOf, stateOf } from './bars'
import { rowOffText } from './model'

// Sample rows, test data only.
const AT = '2026-11-08T10:00:00.000Z'
const dana: Soldier = {
  id: SoldierId.parse('00000000-0000-4000-8000-000000000001'),
  organization_id: OrganizationId.parse('00000000-0000-4000-8000-000000000900'),
  first_name: 'דנה',
  last_name: 'לוי',
  nickname: null,
  command_rank_id: null,
  status: 'active',
  properties: {},
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}
const DAYS = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((day) => CalendarDate.parse(day))
const ALL_IN = DAYS.map(() => true)
const type: LeaveType = {
  id: LeaveTypeId.parse('00000000-0000-4000-8000-000000000030'),
  organization_id: dana.organization_id,
  group_id: null,
  name: 'רגילה',
  color_key: 'teal',
  icon_key: 'exam',
  availability_effect: 'unavailable',
  requires_reason: false,
  sort_order: 0,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}
const leave = (n: number, start: string, end: string, overrides: Partial<BoardLeave> = {}): BoardLeave => ({
  id: LeaveId.parse(`00000000-0000-4000-8000-00000000004${String(n)}`),
  status: 'approved',
  start_date: CalendarDate.parse(start),
  end_date: CalendarDate.parse(end),
  effect: 'unavailable',
  type,
  layer: 'request',
  ...overrides,
})
const NO_MOVES: ReadonlyMap<LeaveId, RoundMove> = new Map()

describe("a row's words", () => {
  it('reads aloud the days out of the unit, and nothing when every day is in it (D-105)', () => {
    const item: BoardItem = { kind: 'soldier', key: dana.id, soldier: dana, rank: null, unit: { kind: 'none' }, inScope: [false, true, false, true, true] }
    expect(rowOffText(item, DAYS)).toBe(`${he.timeline.outOfScope}: 8 בנוב׳, 10 בנוב׳`)
    expect(rowOffText({ ...item, inScope: ALL_IN }, DAYS)).toBeNull()
  })
})

describe('the person bar (§1.10, D-480)', () => {
  it('cuts a row into runs: on base, a leave, and days out of the unit', () => {
    const runs = runsOf(DAYS, [true, true, true, true, false], [leave(1, '2026-11-09', '2026-11-10')], NO_MOVES)
    expect(runs.map((run) => [run.state, run.start, run.length])).toEqual([
      ['base', 0, 1],
      ['approved', 1, 2],
      ['base', 3, 1],
      ['off', 4, 1],
    ])
  })

  it('draws a request over the round, a pending one amber, and a marker never on the bar', () => {
    const round = leave(1, '2026-11-08', '2026-11-12', { layer: 'round' })
    const request = leave(2, '2026-11-09', '2026-11-09', { status: 'pending' })
    const marker = leave(3, '2026-11-11', '2026-11-11', { effect: 'available' })
    const runs = runsOf(DAYS, ALL_IN, [round, request, marker], NO_MOVES)
    expect(runs.map((run) => run.state)).toEqual(['round', 'pending', 'round'])
  })

  it('keeps the first lane on the bar and puts what overlaps it in a lane below (D-111)', () => {
    const first = leave(1, '2026-11-08', '2026-11-09')
    const over = leave(2, '2026-11-09', '2026-11-10')
    const drawn = barLeaves([first, over], DAYS)
    expect(drawn).toEqual([first])
    const runs = runsOf(DAYS, ALL_IN, drawn, NO_MOVES)
    const lanes = extraLanes(DAYS, runs, [first, over])
    expect(lanes.map((lane) => lane.map((placed) => [placed.leave.id, placed.start, placed.length]))).toEqual([[[over.id, 1, 2]]])
  })
})

describe('a moved leave of the round while its move waits (OI-398)', () => {
  const moved = leave(1, '2026-11-11', '2026-11-12', { layer: 'round', status: 'pending' })
  const move: RoundMove = {
    from: { start_date: CalendarDate.parse('2026-11-09'), end_date: CalendarDate.parse('2026-11-11') },
    to: { start_date: moved.start_date, end_date: moved.end_date },
  }
  const moves = new Map([[moved.id, move]])

  it('is drawn as the request it now is', () => {
    expect(stateOf(moved, moves)).toBe('pending')
    expect(stateOf(moved, NO_MOVES)).toBe('round')
  })

  it('leaves a gap where it was, on the days it no longer covers', () => {
    expect(originalPlaces([moved], DAYS, moves)).toEqual([{ key: `${moved.id}:1`, start: 1, length: 2 }])
    expect(originalPlaces([moved], DAYS, NO_MOVES)).toEqual([])
  })
})
