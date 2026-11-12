import { describe, expect, it } from 'vitest'
import {
  AvailabilityRuleId,
  CommandRankId,
  DeploymentId,
  LeaveId,
  LeaveTypeId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitLevelId,
  UnitMembershipId,
  type CalendarDate,
  type FilterExpression,
  type RuleViolation,
} from '@contracts'
import { compareCodeUnits } from '../json'
import { eachDay } from '../time'
import {
  createRuleContext,
  leaveChangeViolations,
  ruleGate,
  ruleThresholds,
  ruleViolations,
  type AvailabilityLeave,
  type RuleData,
  type RuleShape,
  type RuleTargetResult,
} from './index'

// ============================================================================ sample world
// Test data only (iron rule 4).
//
//   COMP (company) ── P1 (platoon) ── S11 (squad)
//                  ├─ P2 (platoon)
//                  └─ P3 (platoon, archived)
//
//   a1  P1   fighter  medic
//   a2  P1   fighter  medic, driver, old (archived tag)
//   a3  S11  squad    driver
//   b1  P2   fighter  medic
//   b2  P2   fighter  student
//   c1  COMP fighter  medic            (placed directly on the company)
//   m   P2 until 2026-12-02, then P1; fighter; medic
//   x   P1   inactive, medic
//   y   P1   archived, medic
//   z   no membership, medic

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const LEVEL = { company: UnitLevelId.parse(uuid(1)), platoon: UnitLevelId.parse(uuid(2)), squad: UnitLevelId.parse(uuid(3)) }
const UNIT = {
  COMP: UnitId.parse(uuid(11)),
  P1: UnitId.parse(uuid(12)),
  P2: UnitId.parse(uuid(13)),
  P3: UnitId.parse(uuid(14)),
  S11: UnitId.parse(uuid(15)),
}
const RANK = { fighter: CommandRankId.parse(uuid(21)), squad: CommandRankId.parse(uuid(22)), old: CommandRankId.parse(uuid(23)) }
const CATEGORY = { role: TagCategoryId.parse(uuid(31)), civil: TagCategoryId.parse(uuid(32)) }
const TAG = {
  medic: TagId.parse(uuid(41)),
  driver: TagId.parse(uuid(42)),
  old: TagId.parse(uuid(43)),
  student: TagId.parse(uuid(44)),
}
const SOLDIER_NAMES = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1', 'm', 'x', 'y', 'z'] as const
type SoldierName = (typeof SOLDIER_NAMES)[number]
const S = Object.fromEntries(SOLDIER_NAMES.map((name, index) => [name, SoldierId.parse(uuid(51 + index))])) as Record<
  SoldierName,
  SoldierId
>
/** A soldier's name as a violation lists it (D-138). */
const nameOf = (name: SoldierName) => ({ id: S[name], first_name: name, last_name: name.toUpperCase() })
const byId = (a: { id: string }, b: { id: string }) => compareCodeUnits(a.id, b.id)
const TYPE = { vacation: LeaveTypeId.parse(uuid(71)), exam: LeaveTypeId.parse(uuid(72)) }
const DEPLOYMENT = {
  alert: DeploymentId.parse(uuid(81)),
  archived: DeploymentId.parse(uuid(82)),
  whole: DeploymentId.parse(uuid(83)),
}
const ARCHIVED_AT = '2026-11-01T08:00:00Z'

const D = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'] as const
const ALL_DAYS = [...D]

type World = { -readonly [K in keyof RuleData]: RuleData[K] extends Iterable<infer T> ? T[] : RuleData[K] }

function world(leaves: AvailabilityLeave[] = []): World {
  const unit = (id: UnitId, parent: UnitId | null, level: UnitLevelId, archived = false) => ({
    id,
    parent_id: parent,
    unit_level_id: level,
    archived_at: archived ? ARCHIVED_AT : null,
    valid_from: null,
    valid_to: null,
  })
  const placements: [SoldierName, UnitId, CalendarDate, CalendarDate | null][] = [
    ['a1', UNIT.P1, '2026-01-01', null],
    ['a2', UNIT.P1, '2026-01-01', null],
    ['a3', UNIT.S11, '2026-01-01', null],
    ['b1', UNIT.P2, '2026-01-01', null],
    ['b2', UNIT.P2, '2026-01-01', null],
    ['c1', UNIT.COMP, '2026-01-01', null],
    ['m', UNIT.P2, '2026-01-01', '2026-12-02'],
    ['m', UNIT.P1, '2026-12-03', null],
    ['x', UNIT.P1, '2026-01-01', null],
    ['y', UNIT.P1, '2026-01-01', null],
  ]
  const tags: [SoldierName, TagId][] = [
    ['a1', TAG.medic], ['a2', TAG.medic], ['a2', TAG.driver], ['a2', TAG.old], ['a3', TAG.driver],
    ['b1', TAG.medic], ['b2', TAG.student], ['c1', TAG.medic], ['m', TAG.medic], ['x', TAG.medic],
    ['y', TAG.medic], ['z', TAG.medic],
  ]
  const soldier = (name: SoldierName, rank: CommandRankId, extra: Partial<World['soldiers'][number]> = {}) => ({
    ...nameOf(name),
    command_rank_id: rank,
    status: 'active' as const,
    properties: {},
    archived_at: null,
    ...extra,
  })
  return {
    units: [
      unit(UNIT.COMP, null, LEVEL.company),
      unit(UNIT.P1, UNIT.COMP, LEVEL.platoon),
      unit(UNIT.P2, UNIT.COMP, LEVEL.platoon),
      unit(UNIT.P3, UNIT.COMP, LEVEL.platoon, true),
      unit(UNIT.S11, UNIT.P1, LEVEL.squad),
    ],
    soldiers: [
      soldier('a1', RANK.fighter),
      soldier('a2', RANK.fighter),
      soldier('a3', RANK.squad),
      soldier('b1', RANK.fighter),
      soldier('b2', RANK.fighter),
      soldier('c1', RANK.fighter),
      soldier('m', RANK.fighter),
      soldier('x', RANK.fighter, { status: 'inactive' }),
      soldier('y', RANK.fighter, { archived_at: ARCHIVED_AT }),
      soldier('z', RANK.fighter),
    ],
    soldier_tags: tags.map(([name, tagId]) => ({ soldier_id: S[name], tag_id: tagId })),
    command_ranks: [
      { id: RANK.fighter, seniority: 10, archived_at: null },
      { id: RANK.squad, seniority: 20, archived_at: null },
      { id: RANK.old, seniority: 5, archived_at: ARCHIVED_AT },
    ],
    tags: [
      { id: TAG.medic, category_id: CATEGORY.role, archived_at: null },
      { id: TAG.driver, category_id: CATEGORY.role, archived_at: null },
      { id: TAG.old, category_id: CATEGORY.role, archived_at: ARCHIVED_AT },
      { id: TAG.student, category_id: CATEGORY.civil, archived_at: null },
    ],
    seniority_overrides: [],
    unit_memberships: placements.map(([name, unitId, from, to], index) => ({
      id: UnitMembershipId.parse(uuid(101 + index)),
      soldier_id: S[name],
      unit_id: unitId,
      membership_type: 'primary' as const,
      valid_from: from,
      valid_to: to,
    })),
    property_definitions: [],
    deployments: [
      { id: DEPLOYMENT.alert, unit_id: UNIT.COMP, start_date: D[1], end_date: D[3], archived_at: null },
      { id: DEPLOYMENT.archived, unit_id: UNIT.COMP, start_date: D[0], end_date: null, archived_at: ARCHIVED_AT },
      { id: DEPLOYMENT.whole, unit_id: UNIT.P2, start_date: D[0], end_date: null, archived_at: null },
    ],
    deployment_members: [
      { deployment_id: DEPLOYMENT.alert, soldier_id: S.a1, start_date: null, end_date: null },
      { deployment_id: DEPLOYMENT.alert, soldier_id: S.a2, start_date: D[2], end_date: null },
      { deployment_id: DEPLOYMENT.archived, soldier_id: S.a1, start_date: null, end_date: null },
    ],
    leaves,
    leave_types: [
      { id: TYPE.vacation, availability_effect: 'unavailable' },
      { id: TYPE.exam, availability_effect: 'available' },
    ],
  }
}

let nextRule = 200
function rule(extra: Partial<RuleShape> = {}): RuleShape {
  nextRule += 1
  return {
    id: AvailabilityRuleId.parse(uuid(nextRule)),
    is_enabled: true,
    archived_at: null,
    priority: 0,
    enforcement: 'soft',
    scope_unit_id: null,
    scope_mode: 'unit_tree',
    scope_level_id: null,
    population_filter: {},
    group_by: 'none',
    group_tag_category_id: null,
    metric: 'count',
    min_value: 1,
    max_value: null,
    effective_from: null,
    effective_to: null,
    deployment_id: null,
    count_pending_as_unavailable: false,
    ...extra,
  }
}

let nextLeave = 300
function leave(name: SoldierName, start: CalendarDate, end: CalendarDate, extra: Partial<AvailabilityLeave> = {}): AvailabilityLeave {
  nextLeave += 1
  return {
    id: LeaveId.parse(uuid(nextLeave)),
    soldier_id: S[name],
    leave_type_id: TYPE.vacation,
    start_date: start,
    end_date: end,
    status: 'approved',
    availability_effect_override: null,
    ...extra,
  }
}

const tagFilter = (...tagIds: TagId[]): FilterExpression => ({ where: { kind: 'tag', match: 'any', tag_ids: tagIds } })

function evaluate(rules: RuleShape[], data: World = world(), dates: CalendarDate[] = ALL_DAYS) {
  return createRuleContext(data).evaluate(rules, { dates })
}

/** Targets of one day, keyed by evaluated unit (`org` for the whole organization). */
function onDay(targets: readonly RuleTargetResult[], date: CalendarDate) {
  return targets.filter((target) => target.date === date)
}

function members(target: RuleTargetResult | undefined): SoldierId[] {
  return [...(target?.members ?? [])].sort()
}
const ids = (...names: SoldierName[]) => names.map((name) => S[name]).sort()

// ============================================================================ thresholds

describe('rule thresholds (D-071)', () => {
  it('rounds a percentage minimum up and a maximum down', () => {
    expect(ruleThresholds({ metric: 'percent', min_value: 60, max_value: 60 }, 7)).toEqual({ required_min: 5, allowed_max: 4 })
    expect(ruleThresholds({ metric: 'percent', min_value: 50, max_value: 50 }, 4)).toEqual({ required_min: 2, allowed_max: 2 })
    expect(ruleThresholds({ metric: 'percent', min_value: 14.29, max_value: 14.28 }, 7)).toEqual({
      required_min: 2,
      allowed_max: 0,
    })
    expect(ruleThresholds({ metric: 'percent', min_value: 100, max_value: null }, 0)).toEqual({ required_min: 0, allowed_max: null })
  })

  it('compares hundredths, so binary float error never moves a count', () => {
    // 0.29 * 100 = 28.999999999999996 in floating point.
    expect(ruleThresholds({ metric: 'percent', min_value: 0.29, max_value: 0.29 }, 10000)).toEqual({
      required_min: 29,
      allowed_max: 29,
    })
    expect(ruleThresholds({ metric: 'count', min_value: 2.5, max_value: 2.5 }, 99)).toEqual({ required_min: 3, allowed_max: 2 })
    expect(ruleThresholds({ metric: 'count', min_value: 2, max_value: null }, 0)).toEqual({ required_min: 2, allowed_max: null })
  })
})

// ============================================================================ targets and populations

describe('rule targets and populations (D-071)', () => {
  it('counts only active, non-archived soldiers placed on the day, per day of membership', () => {
    const r = rule({ scope_unit_id: UNIT.P1 })
    const { targets } = evaluate([r])
    const [first] = onDay(targets, D[0])
    expect(first?.scope_unit_id).toBe(UNIT.P1)
    expect(members(first)).toEqual(ids('a1', 'a2', 'a3'))
    expect(members(onDay(targets, D[2])[0])).toEqual(ids('a1', 'a2', 'a3', 'm'))
  })

  it('counts every placed soldier for a global rule, and nobody without a membership', () => {
    const { targets } = evaluate([rule()], world(), [D[0]])
    expect(targets).toHaveLength(1)
    expect(targets[0]?.scope_unit_id).toBeNull()
    expect(members(targets[0])).toEqual(ids('a1', 'a2', 'a3', 'b1', 'b2', 'c1', 'm'))
  })

  it('makes each child its own target and leaves out soldiers placed on the scope unit', () => {
    const { targets } = evaluate([rule({ scope_unit_id: UNIT.COMP, scope_mode: 'each_child' })], world(), [D[0]])
    expect(targets.map((target) => target.scope_unit_id)).toEqual([UNIT.P1, UNIT.P2])
    expect(members(targets[0])).toEqual(ids('a1', 'a2', 'a3'))
    expect(members(targets[1])).toEqual(ids('b1', 'b2', 'm'))
    expect(targets.flatMap((target) => target.members)).not.toContain(S.c1)
  })

  it('evaluates each descendant at a level, from a unit or from the organization', () => {
    const fromCompany = evaluate(
      [rule({ scope_unit_id: UNIT.COMP, scope_mode: 'each_descendant_at_level', scope_level_id: LEVEL.squad })],
      world(),
      [D[0]],
    )
    expect(fromCompany.targets.map((target) => target.scope_unit_id)).toEqual([UNIT.S11])
    expect(members(fromCompany.targets[0])).toEqual(ids('a3'))

    const global = evaluate([rule({ scope_mode: 'each_descendant_at_level', scope_level_id: LEVEL.platoon })], world(), [D[0]])
    expect(global.targets.map((target) => target.scope_unit_id)).toEqual([UNIT.P1, UNIT.P2])

    const topLevel = evaluate([rule({ scope_mode: 'each_child' })], world(), [D[0]])
    expect(topLevel.targets.map((target) => target.scope_unit_id)).toEqual([UNIT.COMP])
    // A descendant-at-level scope does not include the scope unit itself.
    const self = evaluate(
      [rule({ scope_unit_id: UNIT.P1, scope_mode: 'each_descendant_at_level', scope_level_id: LEVEL.platoon })],
      world(),
      [D[0]],
    )
    expect(self.targets).toEqual([])
  })

  it('has no target on an archived unit or outside a unit validity', () => {
    expect(evaluate([rule({ scope_unit_id: UNIT.P3 })]).targets).toEqual([])
    const data = world()
    data.units = data.units.map((unit) => (unit.id === UNIT.P2 ? { ...unit, valid_from: D[1], valid_to: D[2] } : unit))
    const { targets } = evaluate([rule({ scope_unit_id: UNIT.COMP, scope_mode: 'each_child' })], data)
    expect(targets.filter((target) => target.scope_unit_id === UNIT.P2).map((target) => target.date)).toEqual([D[1], D[2]])
  })

  it('applies only enabled, non-archived rules inside their dates', () => {
    expect(evaluate([rule({ is_enabled: false }), rule({ archived_at: ARCHIVED_AT })]).targets).toEqual([])
    const dated = evaluate([rule({ effective_from: D[1], effective_to: D[2] })])
    expect(dated.targets.map((target) => target.date)).toEqual([D[1], D[2]])
    const open = evaluate([rule({ effective_from: D[3] })])
    expect(open.targets.map((target) => target.date)).toEqual([D[3], D[4]])
  })

  it('limits a deployment rule to the deployment days and members (D-071)', () => {
    const r = rule({ scope_unit_id: UNIT.P1, deployment_id: DEPLOYMENT.alert, effective_to: D[2] })
    const { targets } = evaluate([r])
    // Deployment D2 … D4 intersected with the rule dates (… D3).
    expect(targets.map((target) => target.date)).toEqual([D[1], D[2]])
    // a2 joins on D3 (own start date); a1 uses the deployment dates.
    expect(members(targets[0])).toEqual(ids('a1'))
    expect(members(targets[1])).toEqual(ids('a1', 'a2'))
    expect(evaluate([rule({ deployment_id: DEPLOYMENT.archived })]).targets).toEqual([])
  })

  it('holds the whole unit in a rotation with no member rows, by its memberships there (D-221)', () => {
    const { targets } = evaluate([rule({ deployment_id: DEPLOYMENT.whole })])
    // m leaves P2 after D2.
    expect(members(onDay(targets, D[1])[0])).toEqual(ids('b1', 'b2', 'm'))
    expect(members(onDay(targets, D[2])[0])).toEqual(ids('b1', 'b2'))
  })

  it('combines the scope with the population filter on the same day', () => {
    const { targets } = evaluate([rule({ scope_unit_id: UNIT.P1, population_filter: tagFilter(TAG.medic) })])
    expect(members(onDay(targets, D[0])[0])).toEqual(ids('a1', 'a2'))
    expect(members(onDay(targets, D[2])[0])).toEqual(ids('a1', 'a2', 'm'))
  })
})

// ============================================================================ groups

describe('rule groups (D-072)', () => {
  const groupsOf = (targets: readonly RuleTargetResult[], unitId: UnitId) =>
    targets.filter((target) => target.scope_unit_id === unitId).map((target) => [target.group, members(target)])

  it('evaluates every positively selected tag, even when nobody holds it', () => {
    const { targets } = evaluate(
      [rule({ scope_unit_id: UNIT.COMP, scope_mode: 'each_child', population_filter: tagFilter(TAG.medic, TAG.driver), group_by: 'tag', min_value: 1 })],
      world(),
      [D[0]],
    )
    expect(groupsOf(targets, UNIT.P1)).toEqual([
      [{ group_by: 'tag', tag_id: TAG.medic }, ids('a1', 'a2')],
      [{ group_by: 'tag', tag_id: TAG.driver }, ids('a2', 'a3')],
    ])
    const p2Driver = targets.find((target) => target.scope_unit_id === UNIT.P2 && target.group?.group_by === 'tag' && target.group.tag_id === TAG.driver)
    expect(p2Driver).toMatchObject({ members: [], available: 0, required_min: 1, broken: ['min'] })
  })

  it('adds tags held by members, limited to the group category; archived tags form no group', () => {
    const { targets } = evaluate(
      [
        rule({
          scope_unit_id: UNIT.P1,
          population_filter: tagFilter(TAG.medic, TAG.student),
          group_by: 'tag',
          group_tag_category_id: CATEGORY.role,
        }),
      ],
      world(),
      [D[0]],
    )
    // student is selected but outside the category; driver is held by a2; old is archived.
    expect(groupsOf(targets, UNIT.P1)).toEqual([
      [{ group_by: 'tag', tag_id: TAG.medic }, ids('a1', 'a2')],
      [{ group_by: 'tag', tag_id: TAG.driver }, ids('a2')],
    ])
  })

  it('does not create groups from negated tags', () => {
    const { targets } = evaluate(
      [rule({ scope_unit_id: UNIT.P2, population_filter: { where: { kind: 'not', node: { kind: 'tag', match: 'any', tag_ids: [TAG.driver] } } }, group_by: 'tag' })],
      world(),
      [D[0]],
    )
    expect(groupsOf(targets, UNIT.P2)).toEqual([
      [{ group_by: 'tag', tag_id: TAG.medic }, ids('b1', 'm')],
      [{ group_by: 'tag', tag_id: TAG.student }, ids('b2')],
    ])
  })

  it('groups by command rank: selected ranks plus held ones, never archived ranks', () => {
    const { targets } = evaluate(
      [
        rule({
          scope_unit_id: UNIT.P1,
          population_filter: { where: { kind: 'command_rank', command_rank_ids: [RANK.squad, RANK.old] } },
          group_by: 'command_rank',
        }),
      ],
      world(),
      [D[0]],
    )
    expect(groupsOf(targets, UNIT.P1)).toEqual([[{ group_by: 'command_rank', command_rank_id: RANK.squad }, ids('a3')]])

    const unheld = evaluate(
      [rule({ scope_unit_id: UNIT.P2, population_filter: { where: { kind: 'command_rank', command_rank_ids: [RANK.squad] } }, group_by: 'command_rank' })],
      world(),
      [D[0]],
    )
    expect(unheld.targets).toEqual([
      expect.objectContaining({ group: { group_by: 'command_rank', command_rank_id: RANK.squad }, members: [], broken: ['min'] }),
    ])

    const all = evaluate([rule({ scope_unit_id: UNIT.P1, group_by: 'command_rank' })], world(), [D[0]])
    expect(groupsOf(all.targets, UNIT.P1)).toEqual([
      [{ group_by: 'command_rank', command_rank_id: RANK.fighter }, ids('a1', 'a2')],
      [{ group_by: 'command_rank', command_rank_id: RANK.squad }, ids('a3')],
    ])
  })
})

// ============================================================================ counting

describe('rule counting', () => {
  it('counts available members and reports both bounds', () => {
    const data = world([leave('a1', D[0], D[1]), leave('a2', D[1], D[1], { leave_type_id: TYPE.exam })])
    const { targets } = evaluate([rule({ scope_unit_id: UNIT.P1, min_value: 3, max_value: 3 })], data, [D[0], D[2]])
    expect(targets.map((target) => [target.date, target.available, target.broken])).toEqual([
      [D[0], 2, ['min']],
      [D[2], 4, ['max']],
    ])
    const atBounds = evaluate([rule({ scope_unit_id: UNIT.P1, min_value: 4, max_value: 4 })], data, [D[2]])
    expect(atBounds.targets[0]).toMatchObject({ available: 4, broken: [] })
  })

  it('counts pending leaves only for rules that ask for it', () => {
    const data = world([leave('a1', D[0], D[0], { status: 'pending' })])
    const plain = rule({ scope_unit_id: UNIT.P1, min_value: 3 })
    const planning = rule({ scope_unit_id: UNIT.P1, min_value: 3, count_pending_as_unavailable: true })
    const { targets } = evaluate([plain, planning], data, [D[0]])
    expect(targets.map((target) => [target.rule_id, target.available])).toEqual([
      [plain.id, 3],
      [planning.id, 2],
    ])
  })

  it('reports percentage rules as counts', () => {
    const data = world([leave('b1', D[0], D[0])])
    const { targets } = evaluate([rule({ scope_unit_id: UNIT.P2, metric: 'percent', min_value: 70 })], data, [D[0]])
    // 70% of 3 = 2.1 → 3 required; 2 available.
    expect(targets[0]).toMatchObject({ required_min: 3, allowed_max: null, available: 2, broken: ['min'] })
  })
})

// ============================================================================ priority and conflicts

describe('rule priority and conflicts (D-031)', () => {
  it('lets the higher priority win on the same target, also across scope modes', () => {
    const general = rule({ scope_mode: 'each_descendant_at_level', scope_level_id: LEVEL.platoon, population_filter: tagFilter(TAG.medic), min_value: 2 })
    // The same population written differently has the same canonical key (D-067).
    const specific = rule({
      scope_unit_id: UNIT.P1,
      priority: 10,
      population_filter: { where: { kind: 'and', nodes: [{ kind: 'tag', match: 'any', tag_ids: [TAG.medic, TAG.medic] }] } },
      min_value: 1,
    })
    const { targets } = evaluate([general, specific], world(), [D[0]])
    const p1 = targets.filter((target) => target.scope_unit_id === UNIT.P1)
    expect(p1.map((target) => [target.rule_id, target.overridden_by])).toEqual([
      [general.id, [specific.id]],
      [specific.id, []],
    ])
    const p2 = targets.filter((target) => target.scope_unit_id === UNIT.P2)
    expect(p2.map((target) => [target.rule_id, target.overridden_by])).toEqual([[general.id, []]])
  })

  it('applies every rule at equal priority, and rules of different populations or units', () => {
    const a = rule({ scope_unit_id: UNIT.P1, min_value: 1 })
    const b = rule({ scope_unit_id: UNIT.P1, min_value: 2 })
    const c = rule({ scope_unit_id: UNIT.P1, priority: 5, population_filter: tagFilter(TAG.medic) })
    const d = rule({ scope_unit_id: UNIT.COMP, priority: 9 })
    const { targets } = evaluate([a, b, c, d], world(), [D[0]])
    expect(targets.every((target) => target.overridden_by.length === 0)).toBe(true)
  })

  it('reports an effective minimum above an effective maximum, including rounding', () => {
    const atLeast = rule({ scope_unit_id: UNIT.P1, min_value: 3 })
    const atMost = rule({ scope_unit_id: UNIT.P1, min_value: null, max_value: 2 })
    const overridden = rule({ scope_unit_id: UNIT.P2, min_value: 3 })
    const winner = rule({ scope_unit_id: UNIT.P2, priority: 1, min_value: null, max_value: 2 })
    const rounding = rule({ scope_unit_id: UNIT.S11, metric: 'percent', min_value: 50, max_value: 50 })
    const data = world()
    data.unit_memberships.push({
      id: UnitMembershipId.parse(uuid(199)),
      soldier_id: S.z,
      unit_id: UNIT.S11,
      membership_type: 'primary',
      valid_from: D[0],
      valid_to: null,
    })
    data.unit_memberships.push({
      id: UnitMembershipId.parse(uuid(198)),
      soldier_id: S.c1,
      unit_id: UNIT.S11,
      membership_type: 'attached',
      valid_from: D[0],
      valid_to: null,
    })
    // P2: only the higher-priority maximum is effective, so no conflict. S11 counts a3 and z
    // (an attached membership does not count): 50% of 2 = at least 1, at most 1.
    const { conflicts } = evaluate([atLeast, atMost, overridden, winner, rounding], data, [D[0]])
    expect(conflicts).toEqual([
      expect.objectContaining({ scope_unit_id: UNIT.P1, date: D[0], rule_ids: [atLeast.id, atMost.id], required_min: 3, allowed_max: 2 }),
    ])
    // S11 with a3 alone: 50% of 1 = at least 1, at most 0, a conflict inside one rule.
    const single = evaluate([rounding], world(), [D[0]])
    expect(single.conflicts).toEqual([
      expect.objectContaining({ scope_unit_id: UNIT.S11, rule_ids: [rounding.id], required_min: 1, allowed_max: 0 }),
    ])
  })

  it('resolves priority before keeping only the focused soldiers', () => {
    const general = rule({ scope_unit_id: UNIT.P1, min_value: 3 })
    const alert = rule({ scope_unit_id: UNIT.P1, priority: 10, deployment_id: DEPLOYMENT.alert, min_value: 1 })
    const { targets } = createRuleContext(world()).evaluate([general, alert], { dates: [D[1]], soldier_ids: [S.a3] })
    // a3 is not in the alert, yet the alert rule overrides the general one on P1.
    expect(targets.map((target) => [target.rule_id, target.overridden_by])).toEqual([[general.id, [alert.id]]])
    const none = createRuleContext(world()).evaluate([general], { dates: [D[1]], soldier_ids: [S.b1] })
    expect(none.targets).toEqual([])
  })
})

// ============================================================================ violations and the command gate

/** A violation's day, without who is unavailable; one test below checks the names (D-138). */
const day = (date: CalendarDate, required: number, actual: number) => expect.objectContaining({ date, required, actual })

describe('rule violations and the command gate (D-047, D-073)', () => {
  const p1Min3 = rule({ scope_unit_id: UNIT.P1, min_value: 3, enforcement: 'hard' })

  it('groups broken bounds of effective rules by rule, unit, group and bound, days in order', () => {
    const data = world([leave('a1', D[0], D[1])])
    const overriddenRule = rule({ scope_unit_id: UNIT.P1, min_value: 4, priority: -1 })
    const { targets } = evaluate([p1Min3, overriddenRule], data, [D[1], D[0]])
    expect(ruleViolations([...targets].reverse(), data.soldiers)).toEqual([
      {
        rule_id: p1Min3.id,
        enforcement: 'hard',
        scope_unit_id: UNIT.P1,
        group: null,
        bound: 'min',
        days: [
          { date: D[0], required: 3, actual: 2, unavailable: [nameOf('a1')] },
          { date: D[1], required: 3, actual: 2, unavailable: [nameOf('a1')] },
        ],
      },
    ])
  })

  it('names the soldiers of the target who are unavailable each day, also those the actor cannot see (D-138)', () => {
    const away = leave('a2', D[0], D[1])
    const newLeave = leave('a1', D[1], D[1])
    expect(leaveChangeViolations(world([away]), [p1Min3], [newLeave])).toEqual([
      expect.objectContaining({
        days: [{ date: D[1], required: 3, actual: 1, unavailable: [nameOf('a1'), nameOf('a2')].sort(byId) }],
      }),
    ])
  })

  it('reports what an approval breaks on the days it covers', () => {
    const pending = leave('a2', D[0], D[1], { status: 'pending' })
    const violations = leaveChangeViolations(world([pending]), [p1Min3], [{ ...pending, status: 'approved' }])
    expect(violations).toEqual([
      expect.objectContaining({
        rule_id: p1Min3.id,
        bound: 'min',
        days: [
          day(D[0], 3, 2),
          day(D[1], 3, 2),
        ],
      }),
    ])
  })

  it('reports a day already broken only when the change makes it worse', () => {
    const absent = leave('a1', D[0], D[0])
    const data = world([absent])
    const newLeave = leave('a2', D[0], D[0])
    expect(leaveChangeViolations(data, [p1Min3], [newLeave])).toEqual([
      expect.objectContaining({ days: [day(D[0], 3, 1)] }),
    ])
    // Cancelling on a broken day, a marker, and a soldier outside the target never worsen.
    expect(leaveChangeViolations(data, [p1Min3], [{ ...absent, status: 'cancelled' }])).toEqual([])
    expect(leaveChangeViolations(data, [p1Min3], [leave('a2', D[0], D[0], { leave_type_id: TYPE.exam })])).toEqual([])
    expect(leaveChangeViolations(data, [p1Min3], [leave('b1', D[0], D[0])])).toEqual([])
  })

  it('checks a reschedule on the new days only when the old days improve', () => {
    const stored = leave('a1', D[0], D[0])
    const data = world([stored, leave('a2', D[0], D[0]), leave('a2', D[3], D[3])])
    expect(leaveChangeViolations(data, [p1Min3], [{ ...stored, start_date: D[3], end_date: D[3] }])).toEqual([
      // D4: a1 and a2 away, m arrived on D3, so 2 of 4 remain.
      expect.objectContaining({ days: [day(D[3], 3, 2)] }),
    ])
  })

  it('reports a maximum that a cancellation exceeds', () => {
    const away = leave('b1', D[0], D[0])
    const atMostTwo = rule({ scope_unit_id: UNIT.P2, min_value: null, max_value: 2 })
    expect(leaveChangeViolations(world([away]), [atMostTwo], [{ ...away, status: 'cancelled' }])).toEqual([
      expect.objectContaining({ rule_id: atMostTwo.id, bound: 'max', days: [day(D[0], 2, 3)] }),
    ])
  })

  it('does not report a maximum already exceeded when the change keeps the count', () => {
    const atMostTwo = rule({ scope_unit_id: UNIT.P2, min_value: null, max_value: 2 })
    expect(leaveChangeViolations(world(), [atMostTwo], [leave('b1', D[0], D[0], { leave_type_id: TYPE.exam })])).toEqual([])
  })

  it('checks the old days of a reschedule too: leaving a day can break its maximum', () => {
    const away = leave('b1', D[0], D[0])
    const atMostTwo = rule({ scope_unit_id: UNIT.P2, min_value: null, max_value: 2 })
    expect(leaveChangeViolations(world([away]), [atMostTwo], [{ ...away, start_date: D[1], end_date: D[1] }])).toEqual([
      expect.objectContaining({ bound: 'max', days: [day(D[0], 2, 3)] }),
    ])
  })

  it('ignores overridden rules', () => {
    const relaxed = rule({ scope_unit_id: UNIT.P1, min_value: 1, priority: 10 })
    expect(leaveChangeViolations(world(), [p1Min3, relaxed], [leave('a1', D[0], D[0])])).toEqual([])
  })

  it('answers hard, unacknowledged soft and acknowledged violations', () => {
    const violation = (ruleId: AvailabilityRuleId, enforcement: 'soft' | 'hard'): RuleViolation => ({
      rule_id: ruleId,
      enforcement,
      scope_unit_id: UNIT.P1,
      group: null,
      bound: 'min',
      days: [day(D[0], 3, 2)],
    })
    const [r1, r2, r3] = [rule().id, rule().id, rule().id]
    const hard = violation(r3, 'hard')
    const soft1 = violation(r2, 'soft')
    const soft2 = violation(r1, 'soft')
    expect(ruleGate([soft1, hard], [r2, r3])).toEqual({ ok: false, error: { code: 'rule_violation', violations: [hard] } })
    expect(ruleGate([soft1, soft2], [r2])).toEqual({
      ok: false,
      error: { code: 'rule_acknowledgment_required', violations: [soft1, soft2] },
    })
    expect(ruleGate([soft1, soft2, soft1], [r1, r2, r3])).toEqual({ ok: true, value: [r1, r2] })
    expect(ruleGate([], [r1])).toEqual({ ok: true, value: [] })
  })

  it('evaluates a long window without changing the result per day', () => {
    const window = eachDay({ start_date: '2026-11-01', end_date: '2027-01-31' })
    const { targets } = evaluate([p1Min3], world([leave('a1', D[0], D[0])]), window)
    expect(targets).toHaveLength(window.length)
    expect(targets.filter((target) => target.broken.length > 0).map((target) => target.date)).toEqual([D[0]])
  })
})
