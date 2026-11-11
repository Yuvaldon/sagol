import {
  CommandRankId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitMembershipId,
  type FilterExpression,
  type Leave,
  type LeaveType,
  type Soldier,
  type SoldierTag,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import { presenceLists } from '../presence/presence'
import { LeaveConditions, leaveMatches } from '../view-state/conditions'
import { NO_CONDITIONS, readFilter, withTagChip, writeFilter } from '../view-state/filter'
import { populationOf, type FilterSource } from './source'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const DAY = '2026-11-11'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

const UNIT = UnitId.parse(uuid(10))
const RANK = CommandRankId.parse(uuid(20))
const ROLE = TagCategoryId.parse(uuid(30))
const MARITAL = TagCategoryId.parse(uuid(31))
const MEDIC = TagId.parse(uuid(40))
const DRIVER = TagId.parse(uuid(41))
const SINGLE = TagId.parse(uuid(42))

const categoryOf = (tagId: TagId) => (tagId === SINGLE ? MARITAL : tagId === MEDIC || tagId === DRIVER ? ROLE : undefined)

describe('the filter in the URL (D-131)', () => {
  it('writes one top-level and, a lone node unwrapped, nothing for no condition', () => {
    expect(writeFilter(NO_CONDITIONS)).toBeUndefined()
    expect(writeFilter({ ...NO_CONDITIONS, statuses: ['inactive'] })).toEqual({ where: { kind: 'soldier_status', statuses: ['inactive'] } })
    expect(writeFilter({ unitId: UNIT, tagSets: [[MEDIC, DRIVER]], rankIds: [RANK], statuses: [] })).toEqual({
      where: {
        kind: 'and',
        nodes: [
          { kind: 'unit', unit_ids: [UNIT], include_descendants: true },
          { kind: 'tag', match: 'any', tag_ids: [MEDIC, DRIVER] },
          { kind: 'command_rank', command_rank_ids: [RANK] },
        ],
      },
    })
  })

  it('reads back what it wrote, and anything else as another filter', () => {
    const conditions = { unitId: UNIT, tagSets: [[MEDIC], [SINGLE]], rankIds: [RANK], statuses: ['active' as const] }
    expect(readFilter(writeFilter(conditions) ?? null)).toEqual({ kind: 'conditions', conditions })
    expect(readFilter(null)).toEqual({ kind: 'conditions', conditions: NO_CONDITIONS })
    const others: FilterExpression[] = [
      { where: { kind: 'or', nodes: [{ kind: 'tag', match: 'any', tag_ids: [MEDIC] }] } },
      { where: { kind: 'tag', match: 'all', tag_ids: [MEDIC] } },
      { where: { kind: 'not', node: { kind: 'soldier_status', statuses: ['active'] } } },
      { where: { kind: 'unit', unit_ids: [UNIT], include_descendants: false } },
      {
        where: {
          kind: 'and',
          nodes: [
            { kind: 'command_rank', command_rank_ids: [RANK] },
            { kind: 'command_rank', command_rank_ids: [RANK] },
          ],
        },
      },
    ]
    for (const filter of others) expect(readFilter(filter)).toEqual({ kind: 'other' })
  })

  it("replaces one category's chip in its place, and removes it when empty", () => {
    const conditions = { ...NO_CONDITIONS, tagSets: [[MEDIC], [SINGLE]] }
    expect(withTagChip(conditions, categoryOf, ROLE, [DRIVER]).tagSets).toEqual([[DRIVER], [SINGLE]])
    expect(withTagChip(conditions, categoryOf, ROLE, []).tagSets).toEqual([[SINGLE]])
    expect(withTagChip({ ...NO_CONDITIONS, tagSets: [[SINGLE]] }, categoryOf, ROLE, [MEDIC]).tagSets).toEqual([[SINGLE], [MEDIC]])
  })

  it('shows active soldiers only, unless the filter speaks of status (D-105, D-131)', () => {
    const active = soldier(1, { status: 'active' })
    const inactive = soldier(2, { status: 'inactive' })
    const archived = soldier(3, { archived_at: AT, status: 'inactive' })
    const plain = populationOf(null)
    expect([active, inactive, archived].map(plain)).toEqual([true, false, false])
    const byStatus = populationOf({ where: { kind: 'soldier_status', statuses: ['inactive'] } })
    expect([active, inactive, archived].map(byStatus)).toEqual([true, true, false])
  })
})

describe('leave conditions (D-132)', () => {
  const type = LeaveTypeId.parse(uuid(60))
  const other = LeaveTypeId.parse(uuid(61))

  it('matches every condition given, and everything without one', () => {
    expect(leaveMatches({}, { status: 'pending', leave_type_id: type })).toBe(true)
    expect(leaveMatches({ statuses: ['approved'] }, { status: 'pending', leave_type_id: type })).toBe(false)
    expect(leaveMatches({ statuses: ['pending'], type_ids: [type] }, { status: 'pending', leave_type_id: type })).toBe(true)
    expect(leaveMatches({ type_ids: [other] }, { status: 'pending', leave_type_id: type })).toBe(false)
  })

  it('takes only the statuses the board draws, and no empty list', () => {
    expect(LeaveConditions.safeParse({ statuses: ['rejected'] }).success).toBe(false)
    expect(LeaveConditions.safeParse({ type_ids: [] }).success).toBe(false)
  })
})

function soldier(n: number, overrides: Partial<Soldier> = {}): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name: `F${n}`,
    last_name: `L${n}`,
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
    ...overrides,
  }
}

function leave(n: number, soldierN: number, typeId: LeaveTypeId, status: Leave['status'], start = DAY, end = DAY): Leave {
  return {
    id: LeaveId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    leave_type_id: typeId,
    batch_id: null,
    start_date: start,
    end_date: end,
    status,
    reason: null,
    availability_effect_override: null,
    reviewed_by: null,
    reviewed_at: null,
    properties: {},
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }
}

function leaveType(n: number, effect: LeaveType['availability_effect']): LeaveType {
  return {
    id: LeaveTypeId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    group_id: null,
    name: `T${n}`,
    color_key: 'blue',
    icon_key: null,
    availability_effect: effect,
    requires_reason: false,
    sort_order: n,
    ...audit,
  }
}

describe('present and absent lists (D-134, OI-090)', () => {
  const home = leaveType(70, 'unavailable')
  const exam = leaveType(71, 'available')
  const unit: Unit = {
    id: UNIT,
    organization_id: ORGANIZATION,
    name: 'U',
    code: null,
    parent_id: null,
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    properties: {},
    sort_order: 0,
    ...audit,
  }
  const placed = (n: number): UnitMembership => ({
    id: UnitMembershipId.parse(uuid(500 + n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(n)),
    unit_id: UNIT,
    membership_type: 'primary',
    valid_from: '2026-01-01',
    valid_to: null,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  })
  const tagged: SoldierTag = { soldier_id: SoldierId.parse(uuid(2)), tag_id: MEDIC, organization_id: ORGANIZATION, created_at: AT, created_by: null }
  const source: FilterSource = {
    soldiers: [soldier(1), soldier(2), soldier(3), soldier(4, { status: 'inactive' }), soldier(5)],
    ranks: [],
    units: [unit],
    memberships: [placed(1), placed(2), placed(3), placed(4)],
    soldierTags: [tagged],
  }
  const leaves = [
    leave(80, 1, home.id, 'approved'),
    leave(81, 2, home.id, 'pending'),
    leave(82, 3, exam.id, 'approved'),
    leave(83, 4, home.id, 'approved'),
    leave(84, 1, home.id, 'pending'),
  ]

  it('splits who the filter selects into two lists, each soldier once, approved leaves only', () => {
    const lists = presenceLists({ source, filter: null, leaves, types: [home, exam], day: DAY, readsLeavesOf: READS_ALL })
    // A pending request on an absent day adds nothing: "ממתין" is for who is present (D-134).
    expect(lists.absent.map((entry) => [entry.soldier.first_name, entry.absences.map((type) => type?.name), entry.pending])).toEqual([
      ['F1', ['T70'], false],
    ])
    expect(lists.present.map((entry) => [entry.soldier.first_name, entry.pending, entry.markers.map((type) => type?.name)])).toEqual([
      ['F2', true, []],
      ['F3', false, ['T71']],
      ['F5', false, []],
    ])
  })

  it('follows the soldier filter of the day, the status rule included', () => {
    const inUnit = { where: { kind: 'unit' as const, unit_ids: [UNIT], include_descendants: true } }
    const lists = presenceLists({ source, filter: inUnit, leaves, types: [home, exam], day: DAY, readsLeavesOf: READS_ALL })
    expect([...lists.absent, ...lists.present].map((entry) => entry.soldier.first_name)).toEqual(['F1', 'F2', 'F3'])
    const withInactive = presenceLists({
      source,
      filter: { where: { kind: 'soldier_status', statuses: ['inactive'] } },
      leaves,
      types: [home, exam],
      day: DAY,
      readsLeavesOf: READS_ALL,
    })
    expect(withInactive.absent.map((entry) => entry.soldier.first_name)).toEqual(['F4'])
    const medics = presenceLists({ source, filter: { where: { kind: 'tag', match: 'any', tag_ids: [MEDIC] } }, leaves, types: [], day: DAY, readsLeavesOf: READS_ALL })
    expect(medics.present.map((entry) => entry.soldier.first_name)).toEqual(['F2'])
  })

  it('matches nobody for a unit or rank the actor does not see (D-104, OI-101)', () => {
    const unseen = { ...source, units: [], ranks: [] }
    const inUnit = { where: { kind: 'unit' as const, unit_ids: [UNIT], include_descendants: true } }
    const lists = presenceLists({ source: unseen, filter: inUnit, leaves, types: [home, exam], day: DAY, readsLeavesOf: READS_ALL })
    expect([...lists.absent, ...lists.present]).toEqual([])
    const outside = presenceLists({
      source: unseen,
      filter: { where: { kind: 'not', node: inUnit.where } },
      leaves,
      types: [home, exam],
      day: DAY,
      readsLeavesOf: READS_ALL,
    })
    expect([...outside.absent, ...outside.present].map((entry) => entry.soldier.first_name).toSorted()).toEqual(['F1', 'F2', 'F3', 'F5'])
  })

  it('leaves out soldiers whose leaves the actor cannot read, from both lists (D-161)', () => {
    const hidden = new Set([SoldierId.parse(uuid(1)), SoldierId.parse(uuid(3))])
    const lists = presenceLists({
      source,
      filter: null,
      leaves,
      types: [home, exam],
      day: DAY,
      readsLeavesOf: (soldier) => !hidden.has(soldier.id),
    })
    expect(lists.absent).toEqual([])
    expect(lists.present.map((entry) => entry.soldier.first_name)).toEqual(['F2', 'F5'])
  })
})

const READS_ALL = () => true
