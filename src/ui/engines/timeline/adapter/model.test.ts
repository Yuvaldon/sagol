import { LeaveId, LeaveTypeId, OrganizationId, SoldierId, type LeaveType, type Soldier } from '@contracts'
import { dictionary as he } from '@i18n'
import type { TimelineItem, TimelineLeave } from '@logic'
import { describe, expect, it, vi } from 'vitest'
import { dayCells, timelineRows } from './model'

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
const DAYS = ['2026-11-08', '2026-11-09', '2026-11-10']
const NO_LEAVES = { leaves: new Map(), colors: 'type', openLeave: () => undefined } as const

describe('the timeline adapter', () => {
  it('writes each day as a narrow weekday and a number, and marks today', () => {
    expect(dayCells(DAYS, '2026-11-09')).toEqual([
      { key: '2026-11-08', weekday: 'א׳', dayNumber: '8', isToday: false },
      { key: '2026-11-09', weekday: 'ב׳', dayNumber: '9', isToday: true },
      { key: '2026-11-10', weekday: 'ג׳', dayNumber: '10', isToday: false },
    ])
  })

  it('names groups by path or by state, and reads muted days aloud', () => {
    const items: TimelineItem[] = [
      { kind: 'group', key: 'group:a', label: { kind: 'unit', path: ['מחלקה א', 'כיתה 1'] }, size: 1 },
      { kind: 'soldier', key: dana.id, soldier: dana, rank: null, inScope: [false, true, false] },
      { kind: 'group', key: 'group:unknown', label: { kind: 'unknown' }, size: 0 },
    ]
    const rows = timelineRows(items, DAYS, null, NO_LEAVES)
    expect(rows[0]).toEqual({ kind: 'group', key: 'group:a', label: 'מחלקה א · כיתה 1', count: 1 })
    expect(rows[1]).toMatchObject({ kind: 'resource', name: 'דנה לוי', detail: null, offDays: [true, false, true], onOpen: null })
    expect(rows[1]?.kind === 'resource' ? rows[1].offText : null).toBe(`${he.timeline.outOfScope}: 8 בנוב׳, 10 בנוב׳`)
    expect(rows[2]).toMatchObject({ label: he.soldiers.unknownUnit })
  })

  it('mutes and reads aloud the days "only who is missing" finds present (D-133)', () => {
    const items: TimelineItem[] = [
      { kind: 'soldier', key: dana.id, soldier: dana, rank: null, inScope: [false, true, true], present: [false, true, false] },
    ]
    const [row] = timelineRows(items, DAYS, null, NO_LEAVES)
    expect(row).toMatchObject({ offDays: [true, true, false] })
    expect(row?.kind === 'resource' ? row.offText : null).toBe(`${he.timeline.outOfScope}: 8 בנוב׳, ${he.timeline.present}: 9 בנוב׳`)
  })

  it('opens a soldier only when the actor may (D-076)', () => {
    const open = vi.fn()
    const [row] = timelineRows([{ kind: 'soldier', key: dana.id, soldier: dana, rank: null, inScope: [true, true, true] }], DAYS, open, NO_LEAVES)
    if (row?.kind !== 'resource' || row.onOpen === null) throw new Error('no way to open')
    expect(row.offText).toBeNull()
    row.onOpen()
    expect(open).toHaveBeenCalledWith(dana.id)
  })
})

describe('leaves on a row (D-111, D-112)', () => {
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
  const leave = (n: number, start_date: string, end_date: string, overrides: Partial<TimelineLeave> = {}): TimelineLeave => ({
    id: LeaveId.parse(`00000000-0000-4000-8000-00000000004${String(n)}`),
    status: 'approved',
    start_date,
    end_date,
    effect: 'unavailable',
    type,
    ...overrides,
  })
  const item: TimelineItem = { kind: 'soldier', key: dana.id, soldier: dana, rank: null, inScope: [true, true, true] }
  const opened: string[] = []
  const openLeave = (leaveId: string) => {
    opened.push(leaveId)
  }
  const rowWith = (leaves: TimelineLeave[], colors: 'type' | 'uniform' = 'type') => {
    const [row] = timelineRows([item], DAYS, null, { leaves: new Map([[dana.id, leaves]]), colors, openLeave })
    if (row?.kind !== 'resource') throw new Error('no row')
    return row
  }

  it('places a bar on its days, square where the window cuts it, in the type color', () => {
    const row = rowWith([leave(1, '2026-11-01', '2026-11-09')])
    expect(row.marks).toMatchObject([
      { kind: 'bar', start: 0, length: 2, cut: { start: true, end: false }, lane: 0, dashed: false, tone: { fill: 'bg-palette-teal' } },
    ])
    expect(row.lanes).toBe(1)
  })

  it('dashes a pending leave, gives overlaps their own lane, and names each mark as a control (D-119)', () => {
    const row = rowWith([leave(1, '2026-11-08', '2026-11-09'), leave(2, '2026-11-09', '2026-11-10', { status: 'pending' })])
    expect(row.marks.map((mark) => [mark.lane, mark.dashed])).toEqual([
      [0, false],
      [1, true],
    ])
    expect(row.lanes).toBe(2)
    expect(row.marks[1]?.label).toBe(`רגילה, ${he.leaves.statusPending}, 9–10 בנוב׳`)
    row.marks[1]?.onOpen()
    expect(opened).toEqual([leave(2, '', '').id])
  })

  it('draws a marker as badges over the bars, with its icon, in their own lanes', () => {
    const row = rowWith([leave(1, '2026-11-08', '2026-11-10'), leave(2, '2026-11-09', '2026-11-09', { effect: 'available' })])
    expect(row.marks.map((mark) => [mark.kind, mark.lane])).toEqual([
      ['bar', 0],
      ['badge', 0],
    ])
    expect(row.marks[1]?.Icon).not.toBeNull()
    expect(row.lanes).toBe(1)
    expect(row.marks[1]?.label).toContain(he.leaves.marker)
  })

  it('paints every absence one color in the uniform mode, with the type as a dot and a caption', () => {
    const [bar] = rowWith([leave(1, '2026-11-08', '2026-11-08')], 'uniform').marks
    expect(bar).toMatchObject({ tone: { fill: 'bg-absence' }, dot: 'bg-palette-teal', caption: 'רגילה' })
  })

  it('leaves out what the window does not hold', () => {
    expect(rowWith([leave(1, '2026-11-01', '2026-11-02')]).marks).toEqual([])
  })
})
