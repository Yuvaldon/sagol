import { describe, expect, it } from 'vitest'
import {
  CommandRankId,
  PropertyDefinitionId,
  PropertyOptionId,
  SeniorityOverrideId,
  SoldierId,
  TagId,
  UnitId,
  UnitMembershipId,
  type FilterExpression,
  type FilterNode,
  type JsonValue,
  type PropertyOperator,
} from '@contracts'
import {
  canonicalFilter,
  createFilterContext,
  filterIssues,
  filterKey,
  filterReferences,
  sameFilter,
  type FilterData,
} from './index'

// ============================================================================ sample world
// Test data only (iron rule 4).
//
//   BAT ── COMP ── P1, P2
//
//   s1  P1, fighter (10), medic + driver
//   s2  P2, squad commander (20), driver
//   s3  P1 until 2026-11-09, then P2; fighter; medic
//   s4  inactive, no unit, no rank
//   s5  COMP, fighter with a seniority override of 30 on 2026-11-05 … 2026-11-07

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const UNIT = {
  BAT: UnitId.parse(uuid(1)),
  COMP: UnitId.parse(uuid(2)),
  P1: UnitId.parse(uuid(3)),
  P2: UnitId.parse(uuid(4)),
}
const RANK = { fighter: CommandRankId.parse(uuid(11)), squad: CommandRankId.parse(uuid(12)) }
const TAG = { medic: TagId.parse(uuid(21)), driver: TagId.parse(uuid(22)) }
const S = {
  s1: SoldierId.parse(uuid(31)),
  s2: SoldierId.parse(uuid(32)),
  s3: SoldierId.parse(uuid(33)),
  s4: SoldierId.parse(uuid(34)),
  s5: SoldierId.parse(uuid(35)),
}
const OPT = { day: PropertyOptionId.parse(uuid(41)), night: PropertyOptionId.parse(uuid(42)) }
const OPTIONS = [
  { id: OPT.day, label: 'Day', color_key: null, sort_order: 0 },
  { id: OPT.night, label: 'Night', color_key: null, sort_order: 1 },
]
const PROP = {
  city: PropertyDefinitionId.parse(uuid(51)),
  age: PropertyDefinitionId.parse(uuid(52)),
  release: PropertyDefinitionId.parse(uuid(53)),
  officer: PropertyDefinitionId.parse(uuid(54)),
  shift: PropertyDefinitionId.parse(uuid(55)),
  langs: PropertyDefinitionId.parse(uuid(56)),
  buddy: PropertyDefinitionId.parse(uuid(57)),
  unitNote: PropertyDefinitionId.parse(uuid(58)),
  missing: PropertyDefinitionId.parse(uuid(59)),
}

const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`

function world(): FilterData {
  const member = (n: number, soldier: SoldierId, unit: UnitId, from: string, to: string | null = null) => ({
    id: UnitMembershipId.parse(uuid(n)),
    soldier_id: soldier,
    unit_id: unit,
    membership_type: 'primary' as const,
    valid_from: from,
    valid_to: to,
  })
  const definition = (id: PropertyDefinitionId, data_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'soldier_ref', entity_type: 'soldier' | 'unit' = 'soldier') => ({
    id,
    entity_type,
    data_type,
    options: data_type === 'select' || data_type === 'multi_select' ? OPTIONS : [],
  })
  return {
    units: [
      { id: UNIT.BAT, parent_id: null, unit_level_id: null },
      { id: UNIT.COMP, parent_id: UNIT.BAT, unit_level_id: null },
      { id: UNIT.P1, parent_id: UNIT.COMP, unit_level_id: null },
      { id: UNIT.P2, parent_id: UNIT.COMP, unit_level_id: null },
    ],
    soldiers: [
      {
        id: S.s1,
        command_rank_id: RANK.fighter,
        status: 'active',
        properties: {
          [PROP.city]: '  Haifa ',
          [PROP.age]: 25,
          [PROP.release]: '2027-01-01',
          [PROP.officer]: false,
          [PROP.shift]: OPT.day,
          [PROP.langs]: [OPT.day, OPT.night],
          [PROP.buddy]: S.s2,
        },
      },
      {
        id: S.s2,
        command_rank_id: RANK.squad,
        status: 'active',
        properties: { [PROP.city]: 'Tel Aviv', [PROP.age]: 31, [PROP.officer]: true, [PROP.langs]: [OPT.night] },
      },
      // A stored value that no longer fits its type counts as empty.
      { id: S.s3, command_rank_id: RANK.fighter, status: 'active', properties: { [PROP.age]: 'unknown' } },
      { id: S.s4, command_rank_id: null, status: 'inactive', properties: {} },
      { id: S.s5, command_rank_id: RANK.fighter, status: 'active', properties: { [PROP.shift]: OPT.night } },
    ],
    soldier_tags: [
      { soldier_id: S.s1, tag_id: TAG.medic },
      { soldier_id: S.s1, tag_id: TAG.driver },
      { soldier_id: S.s2, tag_id: TAG.driver },
      { soldier_id: S.s3, tag_id: TAG.medic },
    ],
    command_ranks: [
      { id: RANK.fighter, seniority: 10 },
      { id: RANK.squad, seniority: 20 },
    ],
    seniority_overrides: [
      {
        id: SeniorityOverrideId.parse(uuid(61)),
        soldier_id: S.s5,
        seniority: 30,
        valid_from: day(5),
        valid_to: day(7),
        revoked_at: null,
      },
    ],
    unit_memberships: [
      member(71, S.s1, UNIT.P1, '2026-01-01'),
      member(72, S.s2, UNIT.P2, '2026-01-01'),
      member(73, S.s3, UNIT.P1, '2026-01-01', day(9)),
      member(74, S.s3, UNIT.P2, day(10)),
      member(75, S.s5, UNIT.COMP, '2026-01-01'),
    ],
    property_definitions: [
      definition(PROP.city, 'text'),
      definition(PROP.age, 'number'),
      definition(PROP.release, 'date'),
      definition(PROP.officer, 'boolean'),
      definition(PROP.shift, 'select'),
      definition(PROP.langs, 'multi_select'),
      definition(PROP.buddy, 'soldier_ref'),
      definition(PROP.unitNote, 'text', 'unit'),
    ],
  }
}

const context = createFilterContext(world())
const where = (node: FilterNode): FilterExpression => ({ where: node })
const select = (node: FilterNode, date = day(4)) => context.select(where(node), date)
const property = (id: PropertyDefinitionId, operator: PropertyOperator, value: JsonValue): FilterNode => ({
  kind: 'property',
  property_definition_id: id,
  operator,
  value,
})

// ============================================================================ evaluation

describe('filter evaluation', () => {
  it('no `where` selects every soldier', () => {
    expect(context.select({}, day(4))).toEqual([S.s1, S.s2, S.s3, S.s4, S.s5])
  })

  it('tags: any, all, none', () => {
    const tags = [TAG.medic, TAG.driver]
    expect(select({ kind: 'tag', match: 'any', tag_ids: tags })).toEqual([S.s1, S.s2, S.s3])
    expect(select({ kind: 'tag', match: 'all', tag_ids: tags })).toEqual([S.s1])
    expect(select({ kind: 'tag', match: 'none', tag_ids: tags })).toEqual([S.s4, S.s5])
  })

  it('command rank, status and soldier ids', () => {
    expect(select({ kind: 'command_rank', command_rank_ids: [RANK.squad] })).toEqual([S.s2])
    expect(select({ kind: 'soldier_status', statuses: ['inactive'] })).toEqual([S.s4])
    expect(select({ kind: 'soldier', soldier_ids: [S.s5, S.s3] })).toEqual([S.s3, S.s5])
  })

  it('seniority is the effective seniority on the day; no seniority never matches', () => {
    const senior = { kind: 'seniority', min: 15, max: null } as const
    expect(select(senior, day(4))).toEqual([S.s2])
    expect(select(senior, day(6))).toEqual([S.s2, S.s5])
    expect(select({ kind: 'seniority', min: null, max: 10 }, day(6))).toEqual([S.s1, S.s3])
  })

  it('unit is the primary membership on the day, with or without descendants', () => {
    const p1: FilterNode = { kind: 'unit', unit_ids: [UNIT.P1], include_descendants: false }
    expect(select(p1, day(9))).toEqual([S.s1, S.s3])
    expect(select(p1, day(10))).toEqual([S.s1])
    expect(select({ kind: 'unit', unit_ids: [UNIT.COMP], include_descendants: false })).toEqual([S.s5])
    expect(select({ kind: 'unit', unit_ids: [UNIT.COMP], include_descendants: true })).toEqual([
      S.s1,
      S.s2,
      S.s3,
      S.s5,
    ])
  })

  it('and, or, not', () => {
    const medic: FilterNode = { kind: 'tag', match: 'any', tag_ids: [TAG.medic] }
    const p2: FilterNode = { kind: 'unit', unit_ids: [UNIT.P2], include_descendants: false }
    expect(select({ kind: 'and', nodes: [medic, p2] }, day(10))).toEqual([S.s3])
    expect(select({ kind: 'or', nodes: [medic, p2] }, day(4))).toEqual([S.s1, S.s2, S.s3])
    expect(select({ kind: 'not', node: medic })).toEqual([S.s2, S.s4, S.s5])
  })

  it('an unknown soldier matches nothing', () => {
    expect(context.matches({}, SoldierId.parse(uuid(999)), day(4))).toBe(false)
  })
})

describe('property conditions (D-067)', () => {
  it('text compares folded: case and surrounding spaces are ignored', () => {
    expect(select(property(PROP.city, 'equals', 'haifa'))).toEqual([S.s1])
    expect(select(property(PROP.city, 'contains', 'AVI'))).toEqual([S.s2])
    expect(select(property(PROP.city, 'any_of', ['tel aviv', 'Eilat']))).toEqual([S.s2])
  })

  it('negative operators are exact complements: no value matches not_equals', () => {
    expect(select(property(PROP.city, 'not_equals', 'Haifa'))).toEqual([S.s2, S.s3, S.s4, S.s5])
    expect(select(property(PROP.city, 'is_empty', null))).toEqual([S.s3, S.s4, S.s5])
    expect(select(property(PROP.city, 'is_not_empty', null))).toEqual([S.s1, S.s2])
  })

  it('numbers and dates are ordered; a value that does not fit counts as empty', () => {
    expect(select(property(PROP.age, 'greater_than', 25))).toEqual([S.s2])
    expect(select(property(PROP.age, 'greater_or_equal', 25))).toEqual([S.s1, S.s2])
    expect(select(property(PROP.age, 'less_than', 30))).toEqual([S.s1])
    expect(select(property(PROP.age, 'is_empty', null))).toEqual([S.s3, S.s4, S.s5])
    expect(select(property(PROP.release, 'less_or_equal', '2027-01-01'))).toEqual([S.s1])
    expect(select(property(PROP.release, 'greater_than', '2027-01-01'))).toEqual([])
  })

  it('boolean, select, multi-select and references', () => {
    expect(select(property(PROP.officer, 'equals', false))).toEqual([S.s1])
    expect(select(property(PROP.shift, 'equals', OPT.night))).toEqual([S.s5])
    expect(select(property(PROP.shift, 'any_of', [OPT.day, OPT.night]))).toEqual([S.s1, S.s5])
    expect(select(property(PROP.langs, 'contains', OPT.night))).toEqual([S.s1, S.s2])
    expect(select(property(PROP.langs, 'any_of', [OPT.day]))).toEqual([S.s1])
    // An option removed since the filter was written matches no value; the others still do (D-177).
    const gone = '00000000-0000-4000-8000-000000000999'
    expect(select(property(PROP.shift, 'any_of', [OPT.night, gone]))).toEqual([S.s5])
    expect(select(property(PROP.langs, 'any_of', [gone]))).toEqual([])
    expect(select(property(PROP.buddy, 'equals', S.s2))).toEqual([S.s1])
  })

  it('a missing definition, or one of another entity, matches nobody', () => {
    expect(select(property(PROP.missing, 'is_empty', null))).toEqual([])
    expect(select(property(PROP.unitNote, 'is_empty', null))).toEqual([])
    expect(select({ kind: 'not', node: property(PROP.missing, 'is_empty', null) })).toHaveLength(5)
  })

  it('an operator or operand that does not fit never satisfies a positive operator', () => {
    expect(select(property(PROP.age, 'contains', 2))).toEqual([])
    expect(select(property(PROP.age, 'equals', '25'))).toEqual([])
    expect(select(property(PROP.shift, 'equals', uuid(99)))).toEqual([])
  })
})

// ============================================================================ validation

describe('filterIssues', () => {
  const definitions = world().property_definitions

  it('accepts a valid filter and a filter without `where`', () => {
    expect(filterIssues({}, definitions)).toEqual([])
    expect(
      filterIssues(where({ kind: 'and', nodes: [property(PROP.age, 'any_of', [1, 2]), property(PROP.city, 'is_empty', null)] }), definitions),
    ).toEqual([])
  })

  it('reports unknown definitions, operators and operands at their path', () => {
    const filter = where({
      kind: 'and',
      nodes: [
        property(PROP.missing, 'equals', 'x'),
        { kind: 'not', node: property(PROP.age, 'contains', 2) },
        { kind: 'or', nodes: [property(PROP.age, 'equals', '2'), property(PROP.city, 'is_empty', 'x')] },
        property(PROP.unitNote, 'equals', 'x'),
        property(PROP.shift, 'equals', uuid(99)),
        property(PROP.langs, 'any_of', []),
      ],
    })
    expect(filterIssues(filter, definitions)).toEqual([
      { path: ['where', 'nodes', 0, 'property_definition_id'], code: 'property_unknown' },
      { path: ['where', 'nodes', 1, 'node', 'operator'], code: 'filter_operator_invalid' },
      { path: ['where', 'nodes', 2, 'nodes', 0, 'value'], code: 'invalid_value' },
      { path: ['where', 'nodes', 2, 'nodes', 1, 'value'], code: 'invalid_value' },
      { path: ['where', 'nodes', 3, 'property_definition_id'], code: 'property_unknown' },
      { path: ['where', 'nodes', 4, 'value'], code: 'invalid_value' },
      { path: ['where', 'nodes', 5, 'value'], code: 'invalid_value' },
    ])
  })

  it('every operator of each data type has a matching operand rule', () => {
    expect(filterIssues(where(property(PROP.langs, 'contains', OPT.day)), definitions)).toEqual([])
    expect(filterIssues(where(property(PROP.langs, 'equals', OPT.day)), definitions)).toEqual([
      { path: ['where', 'operator'], code: 'filter_operator_invalid' },
    ])
    expect(filterIssues(where(property(PROP.release, 'any_of', ['2026-01-01'])), definitions)).toEqual([
      { path: ['where', 'operator'], code: 'filter_operator_invalid' },
    ])
  })
})

describe('filterReferences', () => {
  it('lists each referenced row once', () => {
    const filter = where({
      kind: 'or',
      nodes: [
        { kind: 'tag', match: 'any', tag_ids: [TAG.medic, TAG.driver] },
        { kind: 'not', node: { kind: 'tag', match: 'none', tag_ids: [TAG.medic] } },
        { kind: 'unit', unit_ids: [UNIT.P1], include_descendants: true },
        { kind: 'command_rank', command_rank_ids: [RANK.squad] },
        { kind: 'soldier', soldier_ids: [S.s1, S.s1] },
        property(PROP.city, 'is_empty', null),
        { kind: 'seniority', min: 1, max: null },
      ],
    })
    expect(filterReferences(filter)).toEqual({
      tag_ids: [TAG.medic, TAG.driver],
      command_rank_ids: [RANK.squad],
      unit_ids: [UNIT.P1],
      soldier_ids: [S.s1],
      property_definition_ids: [PROP.city],
    })
    expect(filterReferences({})).toEqual({
      tag_ids: [],
      command_rank_ids: [],
      unit_ids: [],
      soldier_ids: [],
      property_definition_ids: [],
    })
  })
})

// ======================================================================= canonical form

describe('canonical form (D-031, D-067)', () => {
  const medic: FilterNode = { kind: 'tag', match: 'any', tag_ids: [TAG.medic] }
  const driver: FilterNode = { kind: 'tag', match: 'any', tag_ids: [TAG.driver] }
  const p1: FilterNode = { kind: 'unit', unit_ids: [UNIT.P1], include_descendants: false }

  it('ignores the order and repetition of ids and children', () => {
    expect(
      sameFilter(
        where({ kind: 'and', nodes: [medic, { kind: 'soldier', soldier_ids: [S.s2, S.s1, S.s2] }] }),
        where({ kind: 'and', nodes: [{ kind: 'soldier', soldier_ids: [S.s1, S.s2] }, medic, medic] }),
      ),
    ).toBe(true)
    expect(
      sameFilter(where(property(PROP.age, 'any_of', [3, 1, 3])), where(property(PROP.age, 'any_of', [1, 3]))),
    ).toBe(true)
  })

  it('flattens nested junctions, unwraps one child and removes double negation', () => {
    const nested = where({ kind: 'and', nodes: [medic, { kind: 'and', nodes: [driver, { kind: 'and', nodes: [p1] }] }] })
    const flat = where({ kind: 'and', nodes: [p1, driver, medic] })
    expect(filterKey(nested)).toBe(filterKey(flat))
    expect(filterKey(where({ kind: 'or', nodes: [medic, medic] }))).toBe(filterKey(where(medic)))
    expect(filterKey(where({ kind: 'not', node: { kind: 'not', node: medic } }))).toBe(filterKey(where(medic)))
    expect(canonicalFilter(nested)).toEqual({
      where: { kind: 'and', nodes: [driver, medic, p1].toSorted((a, b) => (filterKey(where(a)) < filterKey(where(b)) ? -1 : 1)) },
    })
  })

  it('writes a one-tag `all` as `any`', () => {
    expect(sameFilter(where({ kind: 'tag', match: 'all', tag_ids: [TAG.medic, TAG.medic] }), where(medic))).toBe(true)
  })

  it('keeps different meanings apart; and/or, include_descendants and operands matter', () => {
    const keys = [
      filterKey({}),
      filterKey(where({ kind: 'and', nodes: [medic, driver] })),
      filterKey(where({ kind: 'or', nodes: [medic, driver] })),
      filterKey(where({ kind: 'tag', match: 'all', tag_ids: [TAG.medic, TAG.driver] })),
      filterKey(where({ kind: 'unit', unit_ids: [UNIT.P1], include_descendants: true })),
      filterKey(where(p1)),
      filterKey(where(property(PROP.city, 'equals', 'a'))),
      filterKey(where(property(PROP.city, 'equals', 'b'))),
      filterKey(where({ kind: 'not', node: medic })),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the canonical form selects the same soldiers on every day', () => {
    const filters: FilterNode[] = [
      { kind: 'or', nodes: [{ kind: 'and', nodes: [medic, { kind: 'not', node: { kind: 'not', node: p1 } }] }, driver, driver] },
      { kind: 'not', node: { kind: 'or', nodes: [{ kind: 'or', nodes: [medic] }, { kind: 'seniority', min: 15, max: null }] } },
      { kind: 'and', nodes: [{ kind: 'tag', match: 'all', tag_ids: [TAG.driver, TAG.driver] }, property(PROP.age, 'any_of', [31, 25, 31])] },
    ]
    for (const node of filters) {
      for (const date of [day(4), day(6), day(10)]) {
        expect(context.select(canonicalFilter(where(node)), date)).toEqual(select(node, date))
      }
    }
  })
})
