import { LeaveId, OrganizationId, SoldierId, type CalendarDate, type Soldier } from '@contracts'
import { describe, expect, it } from 'vitest'
import type { BoardModel } from './hooks'
import type { BoardLeave } from './leaves'
import { boardDays, boardEntries, calendarWeeks } from './views'

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
      { kind: 'soldier', key: one.id, soldier: one, rank: null, inScope: ALL_WEEK },
      { kind: 'group', key: 'g2', label: { kind: 'none' }, size: 1 },
      // Out of the unit from Thursday on.
      { kind: 'soldier', key: two.id, soldier: two, rank: null, inScope: WEEK.map((day) => day < '2026-11-12') },
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
  it('lists every leave of the soldiers in view with its row group, in row order', () => {
    expect(boardEntries(model()).map((entry) => [entry.leave.id, entry.soldier.first_name, entry.group?.kind])).toEqual([
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
