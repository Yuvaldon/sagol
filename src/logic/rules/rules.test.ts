import {
  AvailabilityRuleId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitLevelId,
  UnitMembershipId,
  type AvailabilityRule,
  type FilterExpression,
  type Leave,
  type LeaveType,
  type Soldier,
  type Tag,
  type Unit,
  type UnitMembership,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import type { FilterSource } from '../filters/source'
import { newLeaveCandidate, newLeaveValues } from '../leaves/forms'
import { acknowledgedRuleIds, dayViolations, heatRow, leaveViolations, ruleDataOf, windowConflicts } from './evaluation'
import {
  EVERYONE,
  NEW_RULE_VALUES,
  ruleFormIssues,
  ruleFormValues,
  rulePopulationOf,
  toCreateRuleInput,
  toUpdateRuleInput,
  type RuleFormValues,
} from './rules'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }
const DAYS = ['2026-11-08', '2026-11-09', '2026-11-10']
const [SUNDAY = '', MONDAY = '', TUESDAY = ''] = DAYS

const COMPANY = UnitId.parse(uuid(10))
const PLATOON_A = UnitId.parse(uuid(11))
const PLATOON_B = UnitId.parse(uuid(12))
const CATEGORY = TagCategoryId.parse(uuid(20))
const MEDIC = TagId.parse(uuid(21))
const DRIVER = TagId.parse(uuid(22))
const HOME = LeaveTypeId.parse(uuid(30))

function unit(id: UnitId, parent_id: UnitId | null): Unit {
  return {
    id,
    organization_id: ORGANIZATION,
    name: id,
    code: null,
    parent_id,
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    sort_order: 0,
    properties: {},
    ...audit,
  }
}

function soldier(n: number, first_name: string): Soldier {
  return {
    id: SoldierId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    first_name,
    last_name: 'Test',
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    ...audit,
  }
}

function membership(n: number, soldierN: number, unitId: UnitId): UnitMembership {
  return {
    id: UnitMembershipId.parse(uuid(500 + n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    unit_id: unitId,
    membership_type: 'primary',
    valid_from: '2026-01-01',
    valid_to: null,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
  }
}

function tag(id: TagId): Tag {
  return { id, organization_id: ORGANIZATION, category_id: CATEGORY, name: id, color_key: null, sort_order: 0, ...audit }
}

const TYPE: LeaveType = {
  id: HOME,
  organization_id: ORGANIZATION,
  group_id: null,
  name: 'Home',
  color_key: 'teal',
  icon_key: null,
  availability_effect: 'unavailable',
  requires_reason: false,
  sort_order: 0,
  ...audit,
}

function leave(n: number, soldierN: number, start_date: string, end_date: string): Leave {
  return {
    id: LeaveId.parse(uuid(700 + n)),
    organization_id: ORGANIZATION,
    soldier_id: SoldierId.parse(uuid(soldierN)),
    leave_type_id: HOME,
    batch_id: null,
    start_date,
    end_date,
    status: 'approved',
    reviewed_by: null,
    reviewed_at: null,
    availability_effect_override: null,
    reason: null,
    properties: {},
    ...audit,
  }
}

function rule(n: number, overrides: Partial<AvailabilityRule> = {}): AvailabilityRule {
  return {
    ...toCreateRuleInput({ ...NEW_RULE_VALUES, name: `Rule ${n}`, min_value: '1' }),
    id: AvailabilityRuleId.parse(uuid(800 + n)),
    organization_id: ORGANIZATION,
    ...audit,
    ...overrides,
  }
}

// Two medics in platoon A (1, 2), one in platoon B (3); a driver in B (4).
const UNITS = [unit(COMPANY, null), unit(PLATOON_A, COMPANY), unit(PLATOON_B, COMPANY)]
const SOURCE: FilterSource = {
  soldiers: [soldier(1, 'Dana'), soldier(2, 'Eli'), soldier(3, 'Gal'), soldier(4, 'Tom')],
  ranks: [],
  units: UNITS,
  memberships: [membership(1, 1, PLATOON_A), membership(2, 2, PLATOON_A), membership(3, 3, PLATOON_B), membership(4, 4, PLATOON_B)],
  soldierTags: [
    { organization_id: ORGANIZATION, soldier_id: SoldierId.parse(uuid(1)), tag_id: MEDIC, created_at: AT, created_by: null },
    { organization_id: ORGANIZATION, soldier_id: SoldierId.parse(uuid(2)), tag_id: MEDIC, created_at: AT, created_by: null },
    { organization_id: ORGANIZATION, soldier_id: SoldierId.parse(uuid(3)), tag_id: MEDIC, created_at: AT, created_by: null },
    { organization_id: ORGANIZATION, soldier_id: SoldierId.parse(uuid(4)), tag_id: DRIVER, created_at: AT, created_by: null },
  ],
}

const dataWith = (leaves: readonly Leave[]) =>
  ruleDataOf({ source: SOURCE, units: UNITS, tags: [tag(MEDIC), tag(DRIVER)], leaves, types: [TYPE] })

const MEDICS = { kind: 'conditions', tagSets: [[MEDIC]], rankIds: [] } as const

describe('the rule form (D-140)', () => {
  const filled: RuleFormValues = { ...NEW_RULE_VALUES, name: 'Two medics', min_value: '2', population: MEDICS }

  it('answers the codes the command answers on the row', () => {
    expect(ruleFormIssues(NEW_RULE_VALUES)).toEqual([
      { path: ['name'], code: 'required' },
      { path: ['min_value'], code: 'rule_threshold_missing' },
    ])
    expect(ruleFormIssues({ ...filled, max_value: '1' })).toEqual([{ path: ['max_value'], code: 'rule_threshold_inverted' }])
    expect(ruleFormIssues({ ...filled, metric: 'percent', min_value: '120' })).toEqual([
      { path: ['min_value'], code: 'rule_percent_out_of_range' },
    ])
    expect(ruleFormIssues({ ...filled, scope_mode: 'each_descendant_at_level' })).toEqual([
      { path: ['scope_level_id'], code: 'rule_scope_level_mismatch' },
    ])
    expect(ruleFormIssues({ ...filled, min_value: 'two' })).toEqual([{ path: ['min_value'], code: 'invalid_type' }])
    expect(ruleFormIssues(filled)).toEqual([])
  })

  it('writes the population with the bar conditions, and reads it back', () => {
    const input = toCreateRuleInput(filled)
    expect(input.population_filter).toEqual({ where: { kind: 'tag', match: 'any', tag_ids: [MEDIC] } })
    expect(toCreateRuleInput({ ...filled, population: EVERYONE }).population_filter).toEqual({})
    expect(rulePopulationOf(input.population_filter)).toEqual(MEDICS)
    // A unit or a status in a stored filter is a population the form does not write.
    const other: FilterExpression = { where: { kind: 'soldier_status', statuses: ['active'] } }
    expect(rulePopulationOf(other)).toEqual({ kind: 'other', filter: other })
  })

  it('drops a level or a category the chosen mode does not use', () => {
    const level = UnitLevelId.parse(uuid(40))
    const input = toCreateRuleInput({ ...filled, scope_level_id: level, group_tag_category_id: CATEGORY })
    expect(input).toMatchObject({ scope_level_id: null, group_tag_category_id: null, deployment_id: null })
  })

  it('updates only what changed, and nothing when nothing did', () => {
    const stored = rule(1, { ...toCreateRuleInput(filled), id: AvailabilityRuleId.parse(uuid(801)) })
    expect(toUpdateRuleInput(stored, 1, ruleFormValues(stored))).toBeNull()
    expect(toUpdateRuleInput(stored, 1, { ...ruleFormValues(stored), min_value: '3', description: ' ' })).toEqual({
      id: stored.id,
      expected_version: 1,
      changes: { min_value: 3 },
    })
  })
})

describe('rule evaluation for a window (D-141, OI-091)', () => {
  const twoMedicsPerPlatoon = rule(1, {
    scope_unit_id: COMPANY,
    scope_mode: 'each_child',
    population_filter: { where: { kind: 'tag', match: 'any', tag_ids: [MEDIC] } },
    min_value: 2,
    enforcement: 'hard',
  })

  it('marks each day by its broken targets and the worst of them, for the board unit', () => {
    const data = dataWith([leave(1, 1, MONDAY, MONDAY)])
    const all = heatRow({ data, rules: [twoMedicsPerPlatoon], days: DAYS, unitId: null })
    // Platoon B has one medic: broken every day. Platoon A breaks on Monday.
    expect(all.map((day) => [day.date, day.broken, day.worst])).toEqual([
      [SUNDAY, 1, 'hard'],
      [MONDAY, 2, 'hard'],
      [TUESDAY, 1, 'hard'],
    ])
    const platoonA = heatRow({ data, rules: [twoMedicsPerPlatoon], days: DAYS, unitId: PLATOON_A })
    expect(platoonA.map((day) => day.broken)).toEqual([0, 1, 0])
    expect(platoonA[0]?.worst).toBeNull()
  })

  it('counts a target inside the unit even with nobody in it (D-072)', () => {
    const drivers = rule(2, {
      scope_unit_id: COMPANY,
      scope_mode: 'each_child',
      population_filter: { where: { kind: 'tag', match: 'any', tag_ids: [DRIVER] } },
      group_by: 'tag',
    })
    // Platoon A has no driver: its selected group is still judged.
    expect(heatRow({ data: dataWith([]), rules: [drivers], days: [SUNDAY], unitId: PLATOON_A })[0]).toMatchObject({
      broken: 1,
      worst: 'soft',
    })
  })

  it('lists the broken rules of a day with who is unavailable (D-138)', () => {
    const violations = dayViolations({
      data: dataWith([leave(1, 1, MONDAY, MONDAY)]),
      rules: [twoMedicsPerPlatoon],
      day: MONDAY,
      unitId: PLATOON_A,
    })
    expect(violations).toEqual([
      expect.objectContaining({
        rule_id: twoMedicsPerPlatoon.id,
        scope_unit_id: PLATOON_A,
        days: [{ date: MONDAY, required: 2, actual: 1, unavailable: [{ id: SoldierId.parse(uuid(1)), first_name: 'Dana', last_name: 'Test' }] }],
      }),
    ])
  })

  it('groups the same conflict on several days', () => {
    const atLeastTwo = rule(3, { min_value: 2 })
    const atMostOne = rule(4, { min_value: null, max_value: 1 })
    const conflicts = windowConflicts({ data: dataWith([]), rules: [atLeastTwo, atMostOne], days: DAYS })
    expect(conflicts).toEqual([
      {
        scope_unit_id: null,
        group: null,
        rule_ids: [atLeastTwo.id, atMostOne.id],
        required_min: 2,
        allowed_max: 1,
        days: DAYS,
      },
    ])
  })

  it('warns a form with what the command would answer, and acknowledges the soft rules only (D-142)', () => {
    const soft = rule(5, { scope_unit_id: PLATOON_A, min_value: 2 })
    const values = { ...newLeaveValues(MONDAY), soldier_id: SoldierId.parse(uuid(1)), leave_type_id: HOME, as_approved: true }
    const candidate = newLeaveCandidate(values)
    expect(candidate).not.toBeNull()
    if (candidate === null) return
    const violations = leaveViolations(dataWith([]), [soft, twoMedicsPerPlatoon], candidate)
    expect(violations.map((violation) => violation.rule_id).sort()).toEqual([soft.id, twoMedicsPerPlatoon.id].sort())
    expect(acknowledgedRuleIds(violations)).toEqual([soft.id])
    // A pending request counts for no rule that does not count pending leaves.
    const pending = newLeaveCandidate({ ...values, as_approved: false })
    expect(pending === null ? null : leaveViolations(dataWith([]), [soft], pending)).toEqual([])
    expect(newLeaveCandidate({ ...values, end_date: '' })).toBeNull()
  })
})
