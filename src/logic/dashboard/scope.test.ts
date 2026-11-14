import {
  DeploymentId,
  OrganizationId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type CalendarDate,
  type Deployment,
  type Soldier,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { buildUnitTree } from '@domain'
import { describe, expect, it } from 'vitest'
import type { DateWindow } from '../view-state/window'
import { chosenUnit, pickableUnits, rowsOf } from './scope'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

const soldier = (n: number): Soldier => ({
  id: SoldierId.parse(uuid(n)),
  organization_id: ORGANIZATION,
  first_name: `F${n}`,
  last_name: `L${n}`,
  nickname: null,
  command_rank_id: null,
  status: 'active',
  properties: {},
  ...audit,
})

const unit = (n: number, parent: number | null): Unit => ({
  id: UnitId.parse(uuid(n)),
  organization_id: ORGANIZATION,
  name: `U${n}`,
  code: null,
  parent_id: parent === null ? null : UnitId.parse(uuid(parent)),
  unit_level_id: null,
  kind: 'standing',
  valid_from: null,
  valid_to: null,
  color_key: null,
  sort_order: 0,
  properties: {},
  ...audit,
})

const membership = (n: number, soldierN: number, unitN: number, valid_from: CalendarDate, valid_to: CalendarDate | null): UnitMembership => ({
  id: UnitMembershipId.parse(uuid(n)),
  organization_id: ORGANIZATION,
  soldier_id: SoldierId.parse(uuid(soldierN)),
  unit_id: UnitId.parse(uuid(unitN)),
  membership_type: 'primary',
  valid_from,
  valid_to,
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  change_seq: 0,
})

// A company over two platoons.
const COMPANY = unit(1, null)
const P1 = unit(2, 1)
const P2 = unit(3, 1)
const UNITS = [COMPANY, P1, P2]
const tree = buildUnitTree(UNITS)
const A = soldier(11)
const B = soldier(12)
const C = soldier(13)

const DAYS = ['2026-11-08', '2026-11-09', '2026-11-10']
const WINDOW: DateWindow = {
  kind: 'custom',
  from: '2026-11-08',
  to: '2026-11-10',
  days: DAYS,
  rotationId: null,
  followsToday: false,
  holdsToday: true,
}
const TODAY = '2026-11-09'
const ids = (units: readonly Unit[]) => units.map((one) => one.id)
const set = (...soldiers: Soldier[]) => new Set(soldiers.map((one) => one.id))
const everyUnit = () => true

describe('pickableUnits (D-349, D-362, D-403)', () => {
  const memberships = [membership(21, 11, 2, '2026-01-01', null), membership(22, 12, 3, '2026-01-01', null)]

  it('offers a unit whose known soldiers are all readable, not the one above holding an unreadable one', () => {
    const pickable = pickableUnits(UNITS, tree, set(A, B), set(A), memberships, WINDOW, everyUnit)
    expect(ids(pickable)).toEqual([P1.id])
  })

  it('does not offer a unit the actor does not read whole, though every soldier they see is readable', () => {
    // B is hidden from the actor: only the whole-unit check stops the company (D-403).
    const seen = [memberships[0]].filter((row) => row !== undefined)
    expect(ids(pickableUnits(UNITS, tree, set(A), set(A), seen, WINDOW, everyUnit))).toEqual([COMPANY.id, P1.id])
    const whole = (unitId: UnitId) => unitId !== COMPANY.id
    expect(ids(pickableUnits(UNITS, tree, set(A), set(A), seen, WINDOW, whole))).toEqual([P1.id])
  })

  it('ignores memberships outside the span', () => {
    const ended = [membership(23, 11, 2, '2026-01-01', '2026-10-31')]
    expect(pickableUnits(UNITS, tree, set(A), set(A), ended, WINDOW, everyUnit)).toEqual([])
  })
})

describe('chosenUnit (D-349)', () => {
  it('takes the asked unit when it may be picked, else the own unit, else the first', () => {
    expect(chosenUnit([COMPANY, P1], P1.id, COMPANY.id)).toBe(P1.id)
    expect(chosenUnit([COMPANY, P1], P2.id, P1.id)).toBe(P1.id)
    expect(chosenUnit([COMPANY, P1], undefined, P2.id)).toBe(COMPANY.id)
    expect(chosenUnit([], P1.id, P1.id)).toBeNull()
  })
})

describe('rowsOf (P-3)', () => {
  const base = { tree, unitId: COMPANY.id, window: WINDOW, rotation: null, servesInRotation: null, today: TODAY }

  it('takes the readable soldiers serving in the tree in the span, under their sub-unit', () => {
    const memberships = [
      membership(21, 11, 2, '2026-01-01', null),
      membership(22, 12, 1, '2026-01-01', null),
      membership(23, 13, 3, '2026-01-01', '2026-11-01'),
    ]
    const rows = rowsOf({ ...base, memberships, readable: [A, B, C] })
    expect(rows.map((row) => [row.soldier.id, row.subUnitId])).toEqual([
      [A.id, P1.id],
      [B.id, null],
    ])
  })

  it('places a soldier by the membership that holds today', () => {
    const memberships = [membership(21, 11, 2, '2026-11-08', '2026-11-08'), membership(22, 11, 3, '2026-11-09', null)]
    const [row] = rowsOf({ ...base, memberships, readable: [A] })
    expect(row?.subUnitId).toBe(P2.id)
    expect(row?.serves('2026-11-08')).toBe(true)
  })

  it('counts nobody the actor may not read', () => {
    const memberships = [membership(21, 11, 2, '2026-01-01', null)]
    expect(rowsOf({ ...base, memberships, readable: [] })).toEqual([])
  })

  it('in a rotation of a unit in the tree, takes who serves in it without a membership', () => {
    const rotation: Deployment = {
      id: DeploymentId.parse(uuid(31)),
      organization_id: ORGANIZATION,
      name: 'R',
      unit_id: P1.id,
      start_date: '2026-11-08',
      end_date: '2026-11-10',
      closed_at: null,
      closed_by: null,
      report_owner_id: null,
      ...audit,
    }
    const servesInRotation = (soldierId: SoldierId, day: CalendarDate) => soldierId === A.id && day !== '2026-11-08'
    const rows = rowsOf({ ...base, rotation, servesInRotation, memberships: [], readable: [A, B] })
    expect(rows.map((row) => [row.soldier.id, row.subUnitId])).toEqual([[A.id, null]])
    expect(rows[0]?.serves('2026-11-08')).toBe(false)
  })
})
