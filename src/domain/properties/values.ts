import {
  CalendarDate,
  IssueCode,
  type PropertyDataType,
  SoldierId,
  UnitId,
  type Issue,
  type JsonValue,
  type PropertyDefinition,
  type PropertyEntityType,
  type PropertyValues,
} from '@contracts'
import { jsonEqual } from '../json'

// Custom property definitions and values (D-016, D-065). Values are keyed by definition id
// in the entity's `properties`. An empty value is an absent key: NULL, blank text and empty
// lists are never stored.

/** The definition columns validation reads. Full rows fit. */
export type PropertyDefinitionShape = Pick<
  PropertyDefinition,
  'id' | 'entity_type' | 'data_type' | 'options' | 'is_required' | 'archived_at'
>

/** Data types whose values are option ids. */
export const OPTION_DATA_TYPES: readonly PropertyDataType[] = ['select', 'multi_select']

/** Text in comparable form: NFC, trimmed, lower case (D-067). */
export function foldText(value: string): string {
  return value.normalize('NFC').trim().toLowerCase()
}

/** True for what counts as "no value": absent, NULL, blank text, empty list. */
export function isEmptyPropertyValue(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  return Array.isArray(value) && value.length === 0
}

function isOptionOf(definition: Pick<PropertyDefinition, 'options'>, value: JsonValue): boolean {
  return typeof value === 'string' && definition.options.some((option) => option.id === value)
}

/**
 * True when `value` is a non-empty value of the definition's data type. Option values must
 * be current options; references must be ids (their rows are checked by the data layer).
 */
export function fitsPropertyType(
  definition: Pick<PropertyDefinition, 'data_type' | 'options'>,
  value: JsonValue,
): boolean {
  if (isEmptyPropertyValue(value)) return false
  switch (definition.data_type) {
    case 'text':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'date':
      return CalendarDate.safeParse(value).success
    case 'boolean':
      return typeof value === 'boolean'
    case 'select':
      return isOptionOf(definition, value)
    case 'multi_select':
      return (
        Array.isArray(value) &&
        value.every((item) => isOptionOf(definition, item)) &&
        new Set(value).size === value.length
      )
    case 'soldier_ref':
      return SoldierId.safeParse(value).success
    case 'unit_ref':
      return UnitId.safeParse(value).success
  }
}

/** A write of an entity's `properties`. */
export interface PropertyWrite {
  readonly entity_type: PropertyEntityType
  /** The stored values; NULL when the entity is created. */
  readonly before: PropertyValues | null
  readonly after: PropertyValues
}

function entriesOf(values: PropertyValues): Map<string, JsonValue> {
  return new Map(Object.entries(values))
}

function sameValues(a: Map<string, JsonValue>, b: Map<string, JsonValue>): boolean {
  if (a.size !== b.size) return false
  for (const [key, value] of a) {
    if (!jsonEqual(value, b.get(key))) return false
  }
  return true
}

/**
 * Issues of a properties write (D-065). Only new or changed values are checked, so a value
 * that became invalid later (option removed, definition archived) never blocks an unrelated
 * edit. Required definitions are enforced on creation and when the values change.
 */
export function propertyValueIssues(
  definitions: Iterable<PropertyDefinitionShape>,
  write: PropertyWrite,
): Issue[] {
  const byId = new Map<string, PropertyDefinitionShape>()
  for (const definition of definitions) byId.set(definition.id, definition)
  const before = write.before === null ? null : entriesOf(write.before)
  const after = entriesOf(write.after)
  const issues: Issue[] = []

  for (const [key, value] of after) {
    if (before !== null && jsonEqual(before.get(key), value)) continue
    const definition = byId.get(key)
    const path = ['properties', key]
    if (definition === undefined || definition.entity_type !== write.entity_type) {
      issues.push({ path, code: IssueCode.enum.property_unknown })
    } else if (definition.archived_at !== null) {
      issues.push({ path, code: IssueCode.enum.reference_archived })
    } else if (!fitsPropertyType(definition, value)) {
      issues.push({ path, code: IssueCode.enum.property_value_invalid })
    }
  }

  if (before === null || !sameValues(before, after)) {
    for (const definition of byId.values()) {
      if (definition.entity_type !== write.entity_type) continue
      if (!definition.is_required || definition.archived_at !== null) continue
      if (!after.has(definition.id)) {
        issues.push({ path: ['properties', definition.id], code: IssueCode.enum.property_required })
      }
    }
  }
  return issues
}

/**
 * Issues of a definition (D-065): only option data types have options; option ids and
 * labels are distinct. Removing an option is always allowed.
 */
export function propertyDefinitionIssues(
  definition: Pick<PropertyDefinition, 'data_type' | 'options'>,
): Issue[] {
  if (!OPTION_DATA_TYPES.includes(definition.data_type)) {
    return definition.options.length === 0 ? [] : [{ path: ['options'], code: IssueCode.enum.property_options_invalid }]
  }
  const issues: Issue[] = []
  const ids = new Set<string>()
  const labels = new Set<string>()
  definition.options.forEach((option, index) => {
    if (ids.has(option.id)) issues.push({ path: ['options', index, 'id'], code: IssueCode.enum.duplicate_item })
    const label = foldText(option.label)
    if (labels.has(label)) issues.push({ path: ['options', index, 'label'], code: IssueCode.enum.duplicate_item })
    ids.add(option.id)
    labels.add(label)
  })
  return issues
}
