import {
  CreatePropertyDefinitionInput,
  PropertyDefinitionId,
  PropertyOptionId,
  type Issue,
  type JsonValue,
  type PropertyDataType,
  type PropertyDefinition,
  type PropertyEntityType,
  type PropertyOption,
  type UpdatePropertyDefinitionInput,
} from '@contracts'
import { OPTION_DATA_TYPES, isEmptyPropertyValue, propertyDefinitionIssues } from '@domain'
import { formIssues } from '../forms/issues'
import { bySortOrder, nextSortOrder } from '../forms/order'

// Custom properties (D-016) between the store and the screens: the definitions module, and the values a form edits. Pure.

/** The live definitions of one entity type, in order: what a form shows and moving one up or down reorders. */
export function definitionsOf(definitions: readonly PropertyDefinition[], entityType: PropertyEntityType): PropertyDefinition[] {
  return definitions
    .filter((definition) => definition.archived_at === null && definition.entity_type === entityType)
    .toSorted(bySortOrder)
}

export function hasOptions(dataType: PropertyDataType): boolean {
  return OPTION_DATA_TYPES.includes(dataType)
}

/** The options of a definition in their order. */
export function optionsOf(definition: Pick<PropertyDefinition, 'options'>): PropertyOption[] {
  return definition.options.toSorted(bySortOrder)
}

// ---------------------------------------------------------------- definitions

/** One option row of the form; its place in the list is its order. */
export interface PropertyOptionFormValues {
  readonly id: PropertyOptionId
  readonly label: string
  readonly color_key: string | null
}

export interface PropertyDefinitionFormValues {
  readonly label: string
  /** Set at creation only (D-016). */
  readonly entity_type: PropertyEntityType
  /** Set at creation only (D-016). */
  readonly data_type: PropertyDataType
  readonly is_required: boolean
  readonly options: readonly PropertyOptionFormValues[]
}

export function newPropertyDefinitionValues(entityType: PropertyEntityType): PropertyDefinitionFormValues {
  return { label: '', entity_type: entityType, data_type: 'text', is_required: false, options: [] }
}

export function propertyDefinitionFormValues(definition: PropertyDefinition): PropertyDefinitionFormValues {
  return {
    label: definition.label,
    entity_type: definition.entity_type,
    data_type: definition.data_type,
    is_required: definition.is_required,
    options: optionsOf(definition).map(({ id, label, color_key }) => ({ id, label, color_key })),
  }
}

export function newPropertyOption(): PropertyOptionFormValues {
  return { id: PropertyOptionId.parse(crypto.randomUUID()), label: '', color_key: null }
}

/** Only option data types keep options; the order of the rows is the order of the options. */
function storedOptions(values: PropertyDefinitionFormValues): PropertyOption[] {
  if (!hasOptions(values.data_type)) return []
  return values.options.map((option, index) => ({ ...option, sort_order: index }))
}

function createInput(values: PropertyDefinitionFormValues, definitions: readonly PropertyDefinition[]) {
  return {
    id: PropertyDefinitionId.parse(crypto.randomUUID()),
    entity_type: values.entity_type,
    data_type: values.data_type,
    label: values.label,
    is_required: values.is_required,
    options: storedOptions(values),
    sort_order: nextSortOrder(definitionsOf(definitions, values.entity_type)),
  }
}

/** The schema's codes and the domain's, as the adapter answers them (D-065, D-068). */
export function propertyDefinitionFormIssues(values: PropertyDefinitionFormValues): Issue[] {
  const input = createInput(values, [])
  const schema = formIssues(CreatePropertyDefinitionInput, input)
  return schema.length > 0 ? schema : propertyDefinitionIssues(input)
}

export function toCreatePropertyDefinitionInput(
  values: PropertyDefinitionFormValues,
  definitions: readonly PropertyDefinition[],
): CreatePropertyDefinitionInput {
  return CreatePropertyDefinitionInput.parse(createInput(values, definitions))
}

/** NULL when nothing changed. The entity and the data type are fixed (D-016). */
export function toUpdatePropertyDefinitionInput(
  definition: PropertyDefinition,
  openedVersion: number,
  values: PropertyDefinitionFormValues,
): UpdatePropertyDefinitionInput | null {
  const options = storedOptions(values)
  const changes = {
    ...(values.label === definition.label ? {} : { label: values.label }),
    ...(values.is_required === definition.is_required ? {} : { is_required: values.is_required }),
    ...(JSON.stringify(options) === JSON.stringify(optionsOf(definition)) ? {} : { options }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: definition.id, expected_version: openedVersion, changes }
}

// --------------------------------------------------------------------- values

/**
 * What a form holds for one property: text for text, number and date fields (as typed), a choice for a boolean (`''` is
 * unset), and ids for select, multi-select and references. A form never writes what it cannot show, so an empty field
 * stores no key (D-016).
 */
export type PropertyFieldValue = string | readonly string[]

export type PropertyFormValues = Readonly<Record<string, PropertyFieldValue>>

/**
 * What a command takes beside a form's own values: the `properties` to store, from `toStoredProperties`. Absent when the
 * form has no property fields, which leaves the stored values as they are. Kept out of the form values themselves, whose
 * fields are typed path by path.
 */
export interface WithProperties {
  readonly properties?: Readonly<Record<string, JsonValue>>
}

const BOOLEAN_TEXT = { true: 'true', false: 'false' } as const

function fieldOf(dataType: PropertyDataType, value: JsonValue | undefined): PropertyFieldValue {
  if (value === undefined || isEmptyPropertyValue(value)) return dataType === 'multi_select' ? [] : ''
  switch (dataType) {
    case 'multi_select':
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    case 'boolean':
      return value === true ? BOOLEAN_TEXT.true : value === false ? BOOLEAN_TEXT.false : ''
    case 'number':
      return typeof value === 'number' ? String(value) : ''
    case 'text':
    case 'date':
    case 'select':
    case 'soldier_ref':
    case 'unit_ref':
      return typeof value === 'string' ? value : ''
  }
}

/** The form's values for the live definitions of the entity, from what is stored. */
export function propertyFormValues(
  definitions: readonly PropertyDefinition[],
  stored: Readonly<Record<string, JsonValue>>,
): PropertyFormValues {
  return Object.fromEntries(definitions.map((definition) => [definition.id, fieldOf(definition.data_type, stored[definition.id])]))
}

function storedOf(dataType: PropertyDataType, field: PropertyFieldValue): JsonValue | undefined {
  if (typeof field !== 'string') return field.length === 0 ? undefined : [...field]
  const text = dataType === 'text' ? field : field.trim()
  if (text.trim() === '') return undefined
  switch (dataType) {
    case 'number': {
      const number = Number(text)
      // A number the field cannot hold stays text, so the domain answers `property_value_invalid` on its path.
      return Number.isFinite(number) ? number : text
    }
    case 'boolean':
      return text === BOOLEAN_TEXT.true
    case 'text':
    case 'date':
    case 'select':
    case 'multi_select':
    case 'soldier_ref':
    case 'unit_ref':
      return text
  }
}

/**
 * The `properties` to store: the stored values of definitions the form does not show stay as they are (an archived
 * definition's value is history), and each shown one is written from its field, or removed when the field is empty.
 */
export function toStoredProperties(
  definitions: readonly PropertyDefinition[],
  stored: Readonly<Record<string, JsonValue>>,
  form: PropertyFormValues,
): Record<string, JsonValue> {
  const shown = definitions.filter((definition) => form[definition.id] !== undefined)
  const shownIds = new Set<string>(shown.map((definition) => definition.id))
  const kept = Object.entries(stored).filter(([key]) => !shownIds.has(key))
  const written = shown.flatMap((definition) => {
    const value = storedOf(definition.data_type, form[definition.id] ?? '')
    return value === undefined ? [] : [[definition.id, value] as const]
  })
  return Object.fromEntries([...kept, ...written])
}

/** Whether two `properties` hold the same values, so an unchanged form sends no change. */
export function sameProperties(a: Readonly<Record<string, JsonValue>>, b: Readonly<Record<string, JsonValue>>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false
  }
  return true
}
