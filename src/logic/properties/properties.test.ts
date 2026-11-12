import { OrganizationId, PropertyDefinitionId, PropertyOptionId, type PropertyDefinition } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  definitionsOf,
  propertyDefinitionFormIssues,
  propertyDefinitionFormValues,
  propertyFormValues,
  sameProperties,
  toCreatePropertyDefinitionInput,
  toStoredProperties,
  toUpdatePropertyDefinitionInput,
} from './properties'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-08T10:00:00.000Z'
const A = PropertyOptionId.parse(uuid(70))
const O = PropertyOptionId.parse(uuid(71))

function definition(n: number, overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: PropertyDefinitionId.parse(uuid(n)),
    organization_id: OrganizationId.parse(uuid(900)),
    entity_type: 'soldier',
    label: `P${String(n)}`,
    data_type: 'text',
    options: [],
    is_required: false,
    sort_order: n,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    archived_at: null,
    ...overrides,
  }
}

const BLOOD = definition(1, {
  data_type: 'select',
  options: [
    { id: O, label: 'O', color_key: null, sort_order: 1 },
    { id: A, label: 'A', color_key: null, sort_order: 0 },
  ],
})
const SKILLS = definition(2, { data_type: 'multi_select', options: [{ id: A, label: 'A', color_key: null, sort_order: 0 }] })
const LICENSED = definition(3, { data_type: 'boolean' })
const HEIGHT = definition(4, { data_type: 'number' })
const NOTE = definition(5)
const SHOWN = [BLOOD, SKILLS, LICENSED, HEIGHT, NOTE]

describe('property definitions (D-016)', () => {
  it('lists the live definitions of one entity type, in order', () => {
    const unitOne = definition(6, { entity_type: 'unit', sort_order: 0 })
    const archived = definition(7, { archived_at: AT, sort_order: 0 })
    expect(definitionsOf([NOTE, unitOne, archived, BLOOD], 'soldier')).toEqual([BLOOD, NOTE])
  })

  it('creates after the last definition of its type, and keeps options of option types only', () => {
    const values = { ...propertyDefinitionFormValues(BLOOD), label: 'Blood' }
    const input = toCreatePropertyDefinitionInput(values, [BLOOD, definition(9, { entity_type: 'unit', sort_order: 40 })])
    expect(input.sort_order).toBe(2)
    expect(input.options.map((option) => [option.id, option.sort_order])).toEqual([[A, 0], [O, 1]])
    expect(toCreatePropertyDefinitionInput({ ...values, data_type: 'text' }, []).options).toEqual([])
  })

  it('answers the schema and the domain issues of the form', () => {
    expect(propertyDefinitionFormIssues({ ...propertyDefinitionFormValues(BLOOD), label: '' })).toEqual([{ path: ['label'], code: 'required' }])
    const twice = { ...propertyDefinitionFormValues(BLOOD), options: [{ id: A, label: 'A', color_key: null }, { id: O, label: ' a ', color_key: null }] }
    expect(propertyDefinitionFormIssues(twice)).toEqual([{ path: ['options', 1, 'label'], code: 'duplicate_item' }])
  })

  it('updates only what changed, and nothing when nothing did', () => {
    const values = propertyDefinitionFormValues(BLOOD)
    expect(toUpdatePropertyDefinitionInput(BLOOD, 1, values)).toBeNull()
    const reordered = { ...values, options: values.options.toReversed(), is_required: true }
    const update = toUpdatePropertyDefinitionInput(BLOOD, 1, reordered)
    expect(update?.changes.is_required).toBe(true)
    expect(update?.changes.options?.map((option) => option.id)).toEqual([O, A])
    expect(update?.changes.label).toBeUndefined()
  })
})

describe('property values in a form (D-016)', () => {
  const stored = { [BLOOD.id]: A, [SKILLS.id]: [A], [LICENSED.id]: false, [HEIGHT.id]: 180, other: 'kept' }

  it('reads the stored values as fields, and an absent one as empty', () => {
    expect(propertyFormValues(SHOWN, stored)).toEqual({
      [BLOOD.id]: A,
      [SKILLS.id]: [A],
      [LICENSED.id]: 'false',
      [HEIGHT.id]: '180',
      [NOTE.id]: '',
    })
  })

  it('writes the fields back, keeps what the form does not show, and stores no empty field', () => {
    const form = { ...propertyFormValues(SHOWN, stored), [HEIGHT.id]: ' 181 ', [LICENSED.id]: '', [NOTE.id]: ' hi ' }
    expect(toStoredProperties(SHOWN, stored, form)).toEqual({ other: 'kept', [BLOOD.id]: A, [SKILLS.id]: [A], [HEIGHT.id]: 181, [NOTE.id]: ' hi ' })
    // A number the field cannot hold stays text, for the domain to answer on its path.
    expect(toStoredProperties([HEIGHT], {}, { [HEIGHT.id]: 'tall' })).toEqual({ [HEIGHT.id]: 'tall' })
    expect(toStoredProperties([LICENSED], {}, { [LICENSED.id]: 'true' })).toEqual({ [LICENSED.id]: true })
  })

  it('compares stored values whatever the order of their keys', () => {
    expect(sameProperties({ a: 1, b: [A] }, { b: [A], a: 1 })).toBe(true)
    expect(sameProperties({ a: 1 }, { a: 1, b: null })).toBe(false)
    expect(sameProperties({ a: [A, O] }, { a: [O, A] })).toBe(false)
  })
})
