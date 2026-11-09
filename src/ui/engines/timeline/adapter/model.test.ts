import { OrganizationId, SoldierId, type Soldier } from '@contracts'
import { dictionary as he } from '@i18n'
import type { TimelineItem } from '@logic'
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
    const rows = timelineRows(items, DAYS, null)
    expect(rows[0]).toEqual({ kind: 'group', key: 'group:a', label: 'מחלקה א · כיתה 1', count: 1 })
    expect(rows[1]).toMatchObject({ kind: 'resource', name: 'דנה לוי', detail: null, offDays: [true, false, true], onOpen: null })
    expect(rows[1]?.kind === 'resource' ? rows[1].offText : null).toBe(`${he.timeline.outOfScope}: 8 בנוב׳, 10 בנוב׳`)
    expect(rows[2]).toMatchObject({ label: he.soldiers.unknownUnit })
  })

  it('opens a soldier only when the actor may (D-076)', () => {
    const open = vi.fn()
    const [row] = timelineRows([{ kind: 'soldier', key: dana.id, soldier: dana, rank: null, inScope: [true, true, true] }], DAYS, open)
    if (row?.kind !== 'resource' || row.onOpen === null) throw new Error('no way to open')
    expect(row.offText).toBeNull()
    row.onOpen()
    expect(open).toHaveBeenCalledWith(dana.id)
  })
})
