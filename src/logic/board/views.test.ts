import { LeaveId, OrganizationId, SoldierId, type CalendarDate, type Soldier } from '@contracts'
import { describe, expect, it } from 'vitest'
import type { BoardModel } from './hooks'
import type { BoardLeave } from './leaves'
import { boardDays, boardEntries, boardMovements, calendarWeeks, cellRequests, dayLeaves, movementRuns, type BoardDay } from './views'
import { impactOf } from './impact'
import { leaveMoveOf, roundMovesOf } from '../leaves/move'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }
// Sunday 8 to Saturday 14 November 2026.
const WEEK: CalendarDate[] = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

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

function leave(n: number, start_date: CalendarDate, end_date: CalendarDate, overrides: Partial<BoardLeave> = {}): BoardLeave {
  return { id: LeaveId.parse(uuid(n)), status: 'approved', start_date, end_date, effect: 'unavailable', type: null, layer: 'request', ...overrides }
}

const ALL_WEEK = WEEK.map(() => true)

function model(): BoardModel {
  const one = soldier(1)
  const two = soldier(2)
  return {
    days: WEEK,
    today: '2026-11-11',
    items: [
      { kind: 'group', key: 'g1', label: { kind: 'unit', path: ['A'] }, size: 1 },
      { kind: 'soldier', key: one.id, soldier: one, rank: null, unit: { kind: 'unit', path: ['A'] }, inScope: ALL_WEEK },
      { kind: 'group', key: 'g2', label: { kind: 'none' }, size: 1 },
      // Out of the unit from Thursday on.
      { kind: 'soldier', key: two.id, soldier: two, rank: null, unit: { kind: 'none' }, inScope: WEEK.map((day) => day < '2026-11-12') },
    ],
    leaves: new Map([
      [one.id, [leave(50, '2026-11-01', '2026-11-09'), leave(51, '2026-11-09', '2026-11-09', { effect: 'available' })]],
      [two.id, [leave(52, '2026-11-11', '2026-11-20', { status: 'pending' })]],
    ]),
    approved: new Map([
      [one.id, [leave(50, '2026-11-01', '2026-11-09'), leave(51, '2026-11-09', '2026-11-09', { effect: 'available' })]],
      // Approved and not drawn: the leave conditions leave it out of the board, and it still counts as away.
      [two.id, [leave(53, '2026-11-10', '2026-11-10')]],
    ]),
    soldierCount: 2,
    rosterCount: 2,
  }
}

describe('the list, the table and the calendar read the board (D-174)', () => {
  it('lists every leave of the soldiers in view with the unit of its row, in row order', () => {
    expect(boardEntries(model()).map((entry) => [entry.leave.id, entry.soldier.first_name, entry.unit.kind])).toEqual([
      [uuid(50), 'F1', 'unit'],
      [uuid(51), 'F1', 'unit'],
      [uuid(52), 'F2', 'none'],
    ])
  })

  it('puts each leave on its days, absences first, and counts only approved absences as away', () => {
    const days = boardDays(model())
    const summary = days.map((day) => [day.day, day.entries.map((entry) => entry.leave.id.slice(-2)), day.away])
    expect(summary).toEqual([
      ['2026-11-08', ['50'], 1],
      ['2026-11-09', ['50', '51'], 1],
      ['2026-11-10', [], 1],
      // A pending absence is drawn and not counted.
      ['2026-11-11', ['52'], 0],
      // A muted day of the row adds nothing.
      ['2026-11-12', [], 0],
      ['2026-11-13', [], 0],
      ['2026-11-14', [], 0],
    ])
  })

  it('lays the days out in whole weeks from Sunday, with empty places outside the window', () => {
    const days = WEEK.slice(2, 5).map((day) => ({ day }))
    expect(calendarWeeks(days).map((week) => week.map((cell) => cell?.day ?? null))).toEqual([
      [null, null, '2026-11-10', '2026-11-11', '2026-11-12', null, null],
    ])
    const fortnight = [...WEEK, '2026-11-15'].map((day) => ({ day }))
    expect(calendarWeeks(fortnight).map((week) => week.filter((cell) => cell !== null).length)).toEqual([7, 1])
    expect(calendarWeeks([])).toEqual([])
  })
})

describe('the board of the new interface (D-480)', () => {
  const one = soldier(1)
  const two = soldier(2)
  const three = soldier(3)
  const entry = (who: Soldier, drawn: BoardLeave) => ({ leave: drawn, soldier: who, rank: null, unit: { kind: 'none' as const } })
  const roundOut = entry(one, leave(60, '2026-11-10', '2026-11-12', { layer: 'round' }))
  const roundHome = entry(two, leave(61, '2026-11-09', '2026-11-13', { layer: 'round' }))
  const roundBack = entry(three, leave(62, '2026-11-08', '2026-11-10', { layer: 'round' }))
  const request = entry(two, leave(63, '2026-11-10', '2026-11-11', { status: 'pending' }))
  const day: BoardDay = { day: '2026-11-10', entries: [roundOut, roundHome, roundBack, request], away: 3, total: 5 }

  it('cuts the leave round of a day by day, never by batch, and marks a request that starts or ends on it', () => {
    const leaves = dayLeaves([day], '2026-11-10')
    expect(leaves.roundLeaving).toEqual([roundOut])
    expect(leaves.roundHome).toEqual([roundHome])
    expect(leaves.roundReturning).toEqual([roundBack])
    expect(leaves.requests).toEqual([{ entry: request, leaving: true, returning: false }])
    expect(cellRequests(day)).toEqual([request])
    // A leave of the round that waits, as a move does, is named in the cell for its approver (D-481).
    const moved = entry(three, leave(66, '2026-11-10', '2026-11-10', { layer: 'round', status: 'pending' }))
    expect(cellRequests({ ...day, entries: [...day.entries, moved] })).toEqual([request, moved])
  })

  it('lists who leaves and who returns by day, and folds the days without movement into one run, today apart', () => {
    const quiet = (date: CalendarDate): BoardDay => ({ day: date, entries: [], away: 0, total: 5 })
    const days = [quiet('2026-11-08'), quiet('2026-11-09'), day, quiet('2026-11-11'), quiet('2026-11-12'), quiet('2026-11-13')]
    const movements = boardMovements(days)
    const tenth = movements[2]
    expect(tenth?.leaving).toEqual({ round: [roundOut], requests: [request] })
    expect(tenth?.returning).toEqual({ round: [roundBack], requests: [] })
    // A leave of one day leaves on it and is listed once, in the movements as in the drawer (D-480).
    const oneDay = entry(one, leave(65, '2026-11-09', '2026-11-09'))
    const [ninth] = boardMovements([{ day: '2026-11-09', entries: [oneDay], away: 1, total: 5 }])
    expect(ninth?.leaving.requests).toEqual([oneDay])
    expect(ninth?.returning.requests).toEqual([])
    expect(dayLeaves([{ day: '2026-11-09', entries: [oneDay], away: 1, total: 5 }], '2026-11-09').requests).toEqual([
      { entry: oneDay, leaving: true, returning: false },
    ])
    expect(movementRuns(movements, '2026-11-12').map((run) => (run.kind === 'day' ? run.day.day : `${run.from}..${run.to}`))).toEqual([
      '2026-11-08..2026-11-09',
      '2026-11-10',
      '2026-11-11..2026-11-11',
      '2026-11-12',
      '2026-11-13..2026-11-13',
    ])
  })

  it('names the first day a step would break, with who would be left on base', () => {
    const violation = {
      rule_id: uuid(70),
      enforcement: 'soft' as const,
      scope_unit_id: null,
      group: null,
      bound: 'min' as const,
      days: [{ date: '2026-11-10', required: 3, actual: 2, unavailable: [] }],
    }
    expect(impactOf([violation] as never, [day], new Map(), one.id)).toEqual({ day: '2026-11-10', present: 1, total: 5 })
    // A soldier already away that day is not taken away twice.
    expect(impactOf([violation] as never, [day], new Map([[one.id, [leave(64, '2026-11-10', '2026-11-10')]]]), one.id)).toEqual({
      day: '2026-11-10',
      present: 2,
      total: 5,
    })
    expect(impactOf([], [day], new Map(), one.id)).toBeNull()
  })

  it('reads a moved leave of the round from its thread, and nothing for a request', () => {
    const moved = { batch_id: uuid(80), start_date: '2026-11-23', end_date: '2026-11-25' }
    const event = (seq: number, changes: Record<string, { before: unknown; after: unknown }>) =>
      ({ change_seq: seq, changes }) as never
    const events = [
      event(2, { start_date: { before: '2026-11-24', after: '2026-11-23' } }),
      event(1, { start_date: { before: '2026-11-26', after: '2026-11-24' }, end_date: { before: '2026-11-28', after: '2026-11-25' } }),
    ]
    expect(leaveMoveOf(moved as never, events)).toEqual({
      from: { start_date: '2026-11-26', end_date: '2026-11-28' },
      to: { start_date: '2026-11-23', end_date: '2026-11-25' },
    })
    expect(leaveMoveOf({ ...moved, batch_id: null } as never, events)).toBeNull()
    expect(leaveMoveOf(moved as never, [])).toBeNull()
  })

  it('finds the moves of the waiting leaves of the round, each from its own events, and of no other leave (OI-398)', () => {
    const base = { start_date: '2026-11-23', end_date: '2026-11-25' }
    const waiting = { ...base, id: uuid(81), batch_id: uuid(80), status: 'pending' }
    const approved = { ...base, id: uuid(82), batch_id: uuid(80), status: 'approved' }
    const request = { ...base, id: uuid(83), batch_id: null, status: 'pending' }
    const event = (leaveId: string) =>
      ({ leave_id: leaveId, change_seq: 1, changes: { start_date: { before: '2026-11-26', after: '2026-11-23' } } }) as never
    const moves = roundMovesOf([waiting, approved, request] as never, [event(uuid(81)), event(uuid(82)), event(uuid(83))])
    expect([...moves.keys()]).toEqual([uuid(81)])
    expect(moves.get(uuid(81) as never)?.from).toEqual({ start_date: '2026-11-26', end_date: '2026-11-25' })
  })
})
