import {
  DeploymentId,
  CommandRankId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  PropertyDefinitionId,
  PropertyOptionId,
  SoldierId,
  SoldierTagId,
  TagId,
  UnitId,
  UnitMembershipId,
  type FilterExpression,
  type Leave,
  type LeaveType,
  type PropertyDefinition,
  type Soldier,
  type SoldierTag,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import { presenceLists } from '../presence/presence'
import { LeaveConditions, leaveMatches } from '../view-state/conditions'
import {
  NO_RULES,
  readRules,
  ruleHasValue,
  writeRules,
  type SoldierFilter,
} from '../view-state/filter'
import { DEFAULT_SORT_RULES, SortRules, isDefaultSort } from '../view-state/sort-rules'
import { populationOf, type FilterSource } from './source'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const DAY = '2026-11-11'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

const UNIT = UnitId.parse(uuid(10))
const RANK = CommandRankId.parse(uuid(20))
const MEDIC = TagId.parse(uuid(40))
const DRIVER = TagId.parse(uuid(41))
const SINGLE = TagId.parse(uuid(42))
const BLOOD = PropertyDefinitionId.parse(uuid(50))
const LICENSED = PropertyDefinitionId.parse(uuid(51))
const TYPE_A = PropertyOptionId.parse(uuid(52))
const NOTE = PropertyDefinitionId.parse(uuid(53))
const HEIGHT = PropertyDefinitionId.parse(uuid(54))
const JOINED = PropertyDefinitionId.parse(uuid(55))
const BUDDY = PropertyDefinitionId.parse(uuid(56))

describe('the rules of the builder in the URL (D-312)', () => {
  const filter: SoldierFilter = {
    unitId: UNIT,
    match: 'all',
    rules: [
      { kind: 'tag', negate: false, tagIds: [MEDIC, DRIVER] },
      { kind: 'tag', negate: true, tagIds: [SINGLE] },
      { kind: 'rank', negate: true, rankIds: [RANK] },
      { kind: 'status', negate: false, statuses: ['active'] },
      { kind: 'options', definitionId: BLOOD, negate: true, ids: [TYPE_A] },
      { kind: 'empty', definitionId: BLOOD, empty: false },
      { kind: 'boolean', definitionId: LICENSED, value: true },
      { kind: 'compare', definitionId: NOTE, operator: 'contains', value: 'gate' },
      { kind: 'compare', definitionId: HEIGHT, operator: 'greater_or_equal', value: 170 },
      { kind: 'compare', definitionId: JOINED, operator: 'less_than', value: '2026-01-01' },
      { kind: 'compare', definitionId: NOTE, operator: 'not_equals', value: 'north' },
      { kind: 'options', definitionId: BUDDY, negate: false, ids: [UNIT] },
    ],
  }

  it('writes "none of" and "is not" as `not`, and reads back what it wrote', () => {
    const written = writeRules(filter)
    expect(written?.where).toMatchObject({
      kind: 'and',
      nodes: [
        { kind: 'unit', unit_ids: [UNIT] },
        { kind: 'tag', match: 'any', tag_ids: [MEDIC, DRIVER] },
        { kind: 'not', node: { kind: 'tag', match: 'any', tag_ids: [SINGLE] } },
        { kind: 'not', node: { kind: 'command_rank' } },
        { kind: 'soldier_status', statuses: ['active'] },
        { kind: 'not', node: { kind: 'property', operator: 'any_of', value: [TYPE_A] } },
        { kind: 'property', operator: 'is_not_empty', value: null },
        { kind: 'property', operator: 'equals', value: true },
        { kind: 'property', operator: 'contains', value: 'gate' },
        { kind: 'property', operator: 'greater_or_equal', value: 170 },
        { kind: 'property', operator: 'less_than', value: '2026-01-01' },
        { kind: 'property', operator: 'not_equals', value: 'north' },
        { kind: 'property', operator: 'any_of', value: [UNIT] },
      ],
    })
    expect(readRules(written ?? null)).toEqual({ kind: 'rules', filter })
  })

  it('keeps או in an `or`, even with one rule, and unwraps a lone node', () => {
    const any: SoldierFilter = { unitId: null, match: 'any', rules: [{ kind: 'status', negate: true, statuses: ['inactive'] }] }
    const written = writeRules(any)
    expect(written).toEqual({ where: { kind: 'or', nodes: [{ kind: 'not', node: { kind: 'soldier_status', statuses: ['inactive'] } }] } })
    expect(readRules(written ?? null)).toEqual({ kind: 'rules', filter: any })
    expect(readRules(writeRules({ ...filter, match: 'any' }) ?? null)).toEqual({ kind: 'rules', filter: { ...filter, match: 'any' } })
    expect(writeRules({ ...NO_RULES, unitId: UNIT })).toEqual({ where: { kind: 'unit', unit_ids: [UNIT], include_descendants: true } })
    expect(writeRules(NO_RULES)).toBeUndefined()
    expect(readRules(null)).toEqual({ kind: 'rules', filter: NO_RULES })
  })

  it('leaves a rule without a value out of the URL, and reads what it cannot edit as another filter', () => {
    const empty = { kind: 'tag' as const, negate: false, tagIds: [] }
    expect(ruleHasValue(empty)).toBe(false)
    expect(ruleHasValue({ kind: 'compare', definitionId: NOTE, operator: 'contains', value: null })).toBe(false)
    expect(ruleHasValue({ kind: 'compare', definitionId: NOTE, operator: 'contains', value: '  ' })).toBe(false)
    expect(writeRules({ ...NO_RULES, rules: [empty] })).toBeUndefined()
    const others: FilterExpression[] = [
      { where: { kind: 'tag', match: 'all', tag_ids: [MEDIC] } },
      { where: { kind: 'and', nodes: [{ kind: 'or', nodes: [{ kind: 'tag', match: 'any', tag_ids: [MEDIC] }] }, { kind: 'soldier_status', statuses: ['active'] }] } },
      { where: { kind: 'not', node: { kind: 'property', property_definition_id: LICENSED, operator: 'equals', value: true } } },
      { where: { kind: 'seniority', min: 1, max: null } },
      { where: { kind: 'property', property_definition_id: NOTE, operator: 'any_of', value: ['north'] } },
      { where: { kind: 'not', node: { kind: 'property', property_definition_id: NOTE, operator: 'contains', value: 'gate' } } },
    ]
    for (const other of others) expect(readRules(other)).toEqual({ kind: 'other' })
  })
})

describe('the sort rules in the URL (D-313)', () => {
  it('holds each target once, and knows the default', () => {
    expect(SortRules.safeParse([{ key: 'unit', order: 'asc' }, { property: BLOOD, order: 'desc' }]).success).toBe(true)
    expect(SortRules.safeParse([{ key: 'unit', order: 'asc' }, { key: 'unit', order: 'desc' }]).success).toBe(false)
    expect(SortRules.safeParse([{ key: 'unit', order: 'asc', property: BLOOD }]).success).toBe(false)
    expect(isDefaultSort(DEFAULT_SORT_RULES)).toBe(true)
    expect(isDefaultSort([{ key: 'seniority', order: 'asc' }])).toBe(false)
    expect(isDefaultSort([])).toBe(false)
  })
})

describe('the soldier population of the URL (D-105)', () => {
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

  const none = new Map<PropertyDefinitionId, PropertyDefinition>()
  const plain = { status: 'pending' as const, leave_type_id: type, properties: {} }

  it('matches every condition given, and everything without one', () => {
    expect(leaveMatches({}, none, plain)).toBe(true)
    expect(leaveMatches({ statuses: ['approved'] }, none, plain)).toBe(false)
    expect(leaveMatches({ statuses: ['pending'], type_ids: [type] }, none, plain)).toBe(true)
    expect(leaveMatches({ type_ids: [other] }, none, plain)).toBe(false)
  })

  it("matches a leave's own properties, and no leave by a definition not of leaves (D-382)", () => {
    const destination = propertyDefinition(80, 'leave', 'text')
    const soldierNote = propertyDefinition(81, 'soldier', 'text')
    const definitions = new Map([destination, soldierNote].map((definition) => [definition.id, definition]))
    const eilat = { ...plain, properties: { [destination.id]: 'Eilat' } }
    const node = (id: PropertyDefinitionId, operator: 'contains' | 'is_empty', value: string | null) =>
      ({ kind: 'property', property_definition_id: id, operator, value }) as const
    expect(leaveMatches({ properties: [node(destination.id, 'contains', 'eil')] }, definitions, eilat)).toBe(true)
    expect(leaveMatches({ properties: [node(destination.id, 'contains', 'eil')] }, definitions, plain)).toBe(false)
    expect(leaveMatches({ properties: [{ kind: 'not', node: node(destination.id, 'contains', 'eil') }] }, definitions, plain)).toBe(true)
    expect(leaveMatches({ properties: [node(destination.id, 'is_empty', null)] }, definitions, plain)).toBe(true)
    expect(leaveMatches({ properties: [node(soldierNote.id, 'is_empty', null)] }, definitions, plain)).toBe(false)
    expect(leaveMatches({ properties: [node(destination.id, 'is_empty', null)] }, none, plain)).toBe(false)
    expect(
      leaveMatches({ statuses: ['approved'], properties: [node(destination.id, 'contains', 'eil')] }, definitions, eilat),
    ).toBe(false)
  })

  it('takes only the statuses the board draws, and no empty list', () => {
    expect(LeaveConditions.safeParse({ statuses: ['rejected'] }).success).toBe(false)
    expect(LeaveConditions.safeParse({ type_ids: [] }).success).toBe(false)
    expect(LeaveConditions.safeParse({ properties: [] }).success).toBe(false)
    expect(LeaveConditions.safeParse({ properties: [{ kind: 'soldier_status', statuses: ['active'] }] }).success).toBe(false)
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
    deployment_id: DeploymentId.parse(uuid(70)),
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
    change_seq: 0,
  })
  const tagged: SoldierTag = { id: SoldierTagId.parse(uuid(701)), deployment_id: null, soldier_id: SoldierId.parse(uuid(2)), tag_id: MEDIC, organization_id: ORGANIZATION, created_at: AT, created_by: null }
  const source: FilterSource = {
    soldiers: [soldier(1), soldier(2), soldier(3), soldier(4, { status: 'inactive' }), soldier(5)],
    ranks: [],
    seniorityOverrides: [],
    units: [unit],
    unitTree: [unit],
    memberships: [placed(1), placed(2), placed(3), placed(4)],
    soldierTags: [tagged],
    propertyDefinitions: [],
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

  it('keeps who serves in an archived sub-unit under the chosen unit (D-147, OI-098)', () => {
    const SQUAD = UnitId.parse(uuid(11))
    const archived: Unit = { ...unit, id: SQUAD, name: 'S', parent_id: UNIT }
    const inSquad: UnitMembership = { ...placed(5), unit_id: SQUAD }
    const withSquad = { ...source, unitTree: [unit, archived], memberships: [...source.memberships, inSquad] }
    const inUnit = { where: { kind: 'unit' as const, unit_ids: [UNIT], include_descendants: true } }
    const lists = presenceLists({ source: withSquad, filter: inUnit, leaves, types: [home, exam], day: DAY, readsLeavesOf: READS_ALL })
    expect([...lists.absent, ...lists.present].map((entry) => entry.soldier.first_name)).toEqual(['F1', 'F2', 'F3', 'F5'])
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

function propertyDefinition(
  n: number,
  entity: PropertyDefinition['entity_type'],
  dataType: PropertyDefinition['data_type'],
): PropertyDefinition {
  return {
    id: PropertyDefinitionId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    entity_type: entity,
    label: `P${String(n)}`,
    data_type: dataType,
    options: [],
    is_required: false,
    sort_order: n,
    ...audit,
  }
}
