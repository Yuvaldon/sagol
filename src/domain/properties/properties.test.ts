import { describe, expect, it } from 'vitest'
import {
  PropertyDefinitionId,
  PropertyOptionId,
  type JsonValue,
  type PropertyDataType,
  type PropertyValues,
} from '@contracts'
import {
  fitsPropertyType,
  isEmptyPropertyValue,
  propertyDefinitionIssues,
  propertyValueIssues,
  type PropertyDefinitionShape,
} from './index'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const OPTION = { a: PropertyOptionId.parse(uuid(51)), b: PropertyOptionId.parse(uuid(52)) }
const OPTIONS = [
  { id: OPTION.a, label: 'Morning', color_key: null, sort_order: 0 },
  { id: OPTION.b, label: 'Evening', color_key: null, sort_order: 1 },
]

function definition(n: number, data_type: PropertyDataType, extra: Partial<PropertyDefinitionShape> = {}): PropertyDefinitionShape {
  return {
    id: PropertyDefinitionId.parse(uuid(n)),
    entity_type: 'soldier',
    data_type,
    options: data_type === 'select' || data_type === 'multi_select' ? OPTIONS : [],
    is_required: false,
    archived_at: null,
    ...extra,
  }
}

const DEF = {
  text: definition(1, 'text'),
  number: definition(2, 'number'),
  date: definition(3, 'date'),
  boolean: definition(4, 'boolean'),
  select: definition(5, 'select'),
  multi: definition(6, 'multi_select'),
  soldier: definition(7, 'soldier_ref'),
  unit: definition(8, 'unit_ref'),
  required: definition(9, 'text', { is_required: true }),
  archived: definition(10, 'text', { archived_at: '2026-10-01T00:00:00Z' }),
  ofUnits: definition(11, 'text', { entity_type: 'unit', is_required: true }),
}
const DEFINITIONS = Object.values(DEF)

const values = (entries: [PropertyDefinitionShape, JsonValue][]): PropertyValues =>
  Object.fromEntries(entries.map(([def, value]) => [def.id, value]))

describe('fitsPropertyType', () => {
  const cases: [PropertyDefinitionShape, JsonValue[], JsonValue[]][] = [
    [DEF.text, ['Haifa', ' x '], ['', '   ', 3, null, ['a']]],
    [DEF.number, [0, -2.5, 40], ['40', true, null]],
    [DEF.date, ['2026-11-04'], ['2026-13-01', '04/11/2026', 20261104]],
    [DEF.boolean, [true, false], ['true', 0]],
    [DEF.select, [OPTION.a], [uuid(99), [OPTION.a], 'Morning']],
    [DEF.multi, [[OPTION.a], [OPTION.a, OPTION.b]], [[], [OPTION.a, OPTION.a], [uuid(99)], OPTION.a]],
    [DEF.soldier, [uuid(1)], ['not-an-id', 1]],
    [DEF.unit, [uuid(1)], ['', null]],
  ]
  for (const [def, good, bad] of cases) {
    it(`${def.data_type}: accepts its values, rejects others and empty ones`, () => {
      for (const value of good) expect(fitsPropertyType(def, value)).toBe(true)
      for (const value of bad) expect(fitsPropertyType(def, value)).toBe(false)
    })
  }

  it('NULL, blank text and empty lists are empty', () => {
    for (const value of [undefined, null, '', '  ', []]) expect(isEmptyPropertyValue(value)).toBe(true)
    for (const value of [0, false, 'x', [OPTION.a]]) expect(isEmptyPropertyValue(value)).toBe(false)
  })
})

describe('propertyValueIssues on creation', () => {
  const create = (after: PropertyValues) => propertyValueIssues(DEFINITIONS, { entity_type: 'soldier', before: null, after })

  it('accepts valid values when every required definition is present', () => {
    expect(
      create(values([[DEF.required, 'yes'], [DEF.number, 3], [DEF.multi, [OPTION.b]], [DEF.date, '2026-01-01']])),
    ).toEqual([])
  })

  it('reports each kind of problem at properties.<id>', () => {
    const unknown = PropertyDefinitionId.parse(uuid(77))
    expect(
      create({
        ...values([
          [DEF.required, 'yes'],
          [DEF.ofUnits, 'x'],
          [DEF.archived, 'x'],
          [DEF.number, 'three'],
          [DEF.text, null],
          [DEF.select, uuid(99)],
        ]),
        [unknown]: 'x',
      }),
    ).toEqual([
      { path: ['properties', DEF.ofUnits.id], code: 'property_unknown' },
      { path: ['properties', DEF.archived.id], code: 'reference_archived' },
      { path: ['properties', DEF.number.id], code: 'property_value_invalid' },
      { path: ['properties', DEF.text.id], code: 'property_value_invalid' },
      { path: ['properties', DEF.select.id], code: 'property_value_invalid' },
      { path: ['properties', unknown], code: 'property_unknown' },
    ])
  })

  it('requires the required definitions of its own entity type only', () => {
    expect(create({})).toEqual([{ path: ['properties', DEF.required.id], code: 'property_required' }])
    expect(propertyValueIssues(DEFINITIONS, { entity_type: 'unit', before: null, after: {} })).toEqual([
      { path: ['properties', DEF.ofUnits.id], code: 'property_required' },
    ])
  })

  it('an archived required definition is not required', () => {
    const archivedRequired = definition(12, 'text', { is_required: true, archived_at: '2026-10-01T00:00:00Z' })
    expect(propertyValueIssues([archivedRequired], { entity_type: 'soldier', before: null, after: {} })).toEqual([])
  })
})

describe('propertyValueIssues on update (D-065)', () => {
  // Stored values that became invalid later: an option was removed, a definition was
  // archived, and a required definition was added after the row was written.
  const stale = values([
    [DEF.select, uuid(99)],
    [DEF.archived, 'old'],
    [DEF.number, 1],
  ])
  const update = (after: PropertyValues) => propertyValueIssues(DEFINITIONS, { entity_type: 'soldier', before: stale, after })

  it('unchanged values are not checked, and unchanged properties skip the required check', () => {
    expect(update({ ...stale })).toEqual([])
  })

  it('key order does not make a value changed', () => {
    const reordered = values([
      [DEF.number, 1],
      [DEF.archived, 'old'],
      [DEF.select, uuid(99)],
    ])
    expect(update(reordered)).toEqual([])
  })

  it('a change checks only the changed value, plus the required definitions', () => {
    expect(update({ ...stale, ...values([[DEF.number, 2]]) })).toEqual([
      { path: ['properties', DEF.required.id], code: 'property_required' },
    ])
    expect(update({ ...stale, ...values([[DEF.number, 2], [DEF.required, 'filled']]) })).toEqual([])
  })

  it('removing a value is a change; removing an archived value is allowed', () => {
    const withoutArchived = values([
      [DEF.select, uuid(99)],
      [DEF.number, 1],
      [DEF.required, 'filled'],
    ])
    expect(update(withoutArchived)).toEqual([])
  })

  it('a changed value is checked against the current options and definition state', () => {
    expect(update({ ...stale, ...values([[DEF.select, uuid(98)], [DEF.required, 'x']]) })).toEqual([
      { path: ['properties', DEF.select.id], code: 'property_value_invalid' },
    ])
    expect(update({ ...stale, ...values([[DEF.archived, 'new'], [DEF.required, 'x']]) })).toEqual([
      { path: ['properties', DEF.archived.id], code: 'reference_archived' },
    ])
  })
})

describe('propertyDefinitionIssues', () => {
  it('only option data types have options', () => {
    expect(propertyDefinitionIssues({ data_type: 'text', options: OPTIONS })).toEqual([
      { path: ['options'], code: 'property_options_invalid' },
    ])
    expect(propertyDefinitionIssues({ data_type: 'text', options: [] })).toEqual([])
    expect(propertyDefinitionIssues({ data_type: 'select', options: [] })).toEqual([])
    expect(propertyDefinitionIssues({ data_type: 'multi_select', options: OPTIONS })).toEqual([])
  })

  it('option ids and labels (case and spaces ignored) are distinct', () => {
    const [first, second] = OPTIONS
    if (first === undefined || second === undefined) throw new Error('options')
    expect(
      propertyDefinitionIssues({
        data_type: 'select',
        options: [first, { ...second, id: first.id }, { ...second, label: ' morning ' }],
      }),
    ).toEqual([
      { path: ['options', 1, 'id'], code: 'duplicate_item' },
      { path: ['options', 2, 'label'], code: 'duplicate_item' },
    ])
  })
})
