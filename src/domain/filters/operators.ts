import type { JsonValue, PropertyDataType, PropertyDefinition, PropertyOperator } from '@contracts'
import { fitsPropertyType, foldText, isEmptyPropertyValue } from '../properties'
import { compareDates } from '../time'

// Property conditions of a filter (D-067). Every negative operator is the exact complement
// of its positive one, so a soldier without a value matches `not_equals`. Text compares
// folded (case and surrounding spaces ignored). A stored value that does not fit its data
// type counts as empty.

const EMPTINESS = ['is_empty', 'is_not_empty'] as const satisfies readonly PropertyOperator[]
const ORDERING = [
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
] as const satisfies readonly PropertyOperator[]

/** Operators each property data type accepts; any other is `filter_operator_invalid`. */
export const OPERATORS_BY_DATA_TYPE: Readonly<Record<PropertyDataType, readonly PropertyOperator[]>> = {
  text: ['equals', 'not_equals', 'contains', 'any_of', ...EMPTINESS],
  number: ['equals', 'not_equals', 'any_of', ...ORDERING, ...EMPTINESS],
  date: ['equals', 'not_equals', ...ORDERING, ...EMPTINESS],
  boolean: ['equals', 'not_equals', ...EMPTINESS],
  select: ['equals', 'not_equals', 'any_of', ...EMPTINESS],
  multi_select: ['contains', 'any_of', ...EMPTINESS],
  soldier_ref: ['equals', 'not_equals', 'any_of', ...EMPTINESS],
  unit_ref: ['equals', 'not_equals', 'any_of', ...EMPTINESS],
}

type OperandDefinition = Pick<PropertyDefinition, 'data_type' | 'options'>

/** The type of one operand item: an option for multi-select, else the data type itself. */
function itemDefinition(definition: OperandDefinition): OperandDefinition {
  return definition.data_type === 'multi_select' ? { ...definition, data_type: 'select' } : definition
}

/** True when the operator fits the data type. */
export function operatorFits(definition: Pick<PropertyDefinition, 'data_type'>, operator: PropertyOperator): boolean {
  return OPERATORS_BY_DATA_TYPE[definition.data_type].includes(operator)
}

/**
 * True when the operand fits: NULL for emptiness operators, a non-empty list of items for
 * `any_of`, one item otherwise. Option items must be current options.
 */
export function operandFits(definition: OperandDefinition, operator: PropertyOperator, operand: JsonValue): boolean {
  if (operator === 'is_empty' || operator === 'is_not_empty') return operand === null
  const item = itemDefinition(definition)
  if (operator === 'any_of') {
    return Array.isArray(operand) && operand.length > 0 && operand.every((value) => fitsPropertyType(item, value))
  }
  return fitsPropertyType(item, operand)
}

/** Equality of two items of one data type. */
function itemsEqual(dataType: PropertyDataType, a: JsonValue, b: JsonValue): boolean {
  if (dataType === 'text' && typeof a === 'string' && typeof b === 'string') return foldText(a) === foldText(b)
  return a === b
}

/** Order of two items: numbers and dates only. NULL when they cannot be ordered. */
function itemOrder(dataType: PropertyDataType, a: JsonValue, b: JsonValue): number | null {
  if (dataType === 'number' && typeof a === 'number' && typeof b === 'number') return Math.sign(a - b)
  if (dataType === 'date' && typeof a === 'string' && typeof b === 'string') return compareDates(a, b)
  return null
}

function listOf(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : []
}

function positiveMatch(
  definition: OperandDefinition,
  operator: PropertyOperator,
  operand: JsonValue,
  stored: JsonValue,
): boolean {
  const type = definition.data_type
  switch (operator) {
    case 'equals':
      return itemsEqual(type, stored, operand)
    case 'contains':
      if (type === 'multi_select') return listOf(stored).includes(operand)
      return typeof stored === 'string' && typeof operand === 'string' && foldText(stored).includes(foldText(operand))
    case 'any_of':
      if (type === 'multi_select') return listOf(stored).some((value) => listOf(operand).includes(value))
      return listOf(operand).some((value) => itemsEqual(type, stored, value))
    case 'greater_than':
    case 'greater_or_equal':
    case 'less_than':
    case 'less_or_equal': {
      const order = itemOrder(type, stored, operand)
      if (order === null) return false
      if (operator === 'greater_than') return order > 0
      if (operator === 'greater_or_equal') return order >= 0
      if (operator === 'less_than') return order < 0
      return order <= 0
    }
    case 'not_equals':
    case 'is_empty':
    case 'is_not_empty':
      return false
  }
}

/**
 * True when a stored value satisfies a property condition. `stored` is `undefined` when the
 * entity has no value. The operator and operand are checked by `filterIssues` on write; an
 * unfit one never satisfies a positive operator (so `not_equals` then matches everyone).
 */
export function propertyMatches(
  definition: OperandDefinition,
  operator: PropertyOperator,
  operand: JsonValue,
  stored: JsonValue | undefined,
): boolean {
  const value = stored !== undefined && fitsPropertyType(definition, stored) ? stored : null
  const empty = isEmptyPropertyValue(value)
  switch (operator) {
    case 'is_empty':
      return empty
    case 'is_not_empty':
      return !empty
    case 'not_equals':
      return !propertyMatches(definition, 'equals', operand, stored)
    default:
      if (empty || value === null || !operatorFits(definition, operator)) return false
      if (!operandFits(definition, operator, operand)) return false
      return positiveMatch(definition, operator, operand, value)
  }
}
