import { z } from 'zod'

// The rule builder's operator vocabulary (D-312, D-380, D-441): the operators a row offers and which ones each kind of
// field offers, in order. The stored operator each comparison is written with sits beside the rule, in `index.ts`.
// `logic` and `ui` read both from `contracts` (rule 2, OI-340).

/** The operators of a builder row, as the soldier picks them. */
export const FilterOperator = z.enum([
  'anyOf',
  'noneOf',
  'is',
  'isNot',
  'contains',
  'greaterThan',
  'greaterOrEqual',
  'lessThan',
  'lessOrEqual',
  'before',
  'onOrBefore',
  'after',
  'onOrAfter',
  'isEmpty',
  'isNotEmpty',
])
export type FilterOperator = z.infer<typeof FilterOperator>

/**
 * The kinds of field a row filters by, by the operators they offer: a set of chosen values (tags, command ranks), the
 * soldier's status, a yes / no property, a text, number or date property, and a property chosen from a list (options,
 * soldiers, units).
 */
export const FilterFieldKind = z.enum(['set', 'status', 'yes_no', 'text', 'number', 'date', 'list'])
export type FilterFieldKind = z.infer<typeof FilterFieldKind>

/** The operators each kind of field offers, in the order the builder lists them; the first is a new row's. */
export const FILTER_OPERATORS_OF = {
  set: ['anyOf', 'noneOf'],
  status: ['is', 'isNot'],
  yes_no: ['is', 'isEmpty', 'isNotEmpty'],
  text: ['contains', 'is', 'isNot', 'isEmpty', 'isNotEmpty'],
  number: ['is', 'isNot', 'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'isEmpty', 'isNotEmpty'],
  date: ['is', 'isNot', 'before', 'onOrBefore', 'after', 'onOrAfter', 'isEmpty', 'isNotEmpty'],
  list: ['anyOf', 'noneOf', 'isEmpty', 'isNotEmpty'],
} as const satisfies Record<FilterFieldKind, readonly FilterOperator[]>

/** The operators that take no value. */
export const VALUELESS_FILTER_OPERATORS = ['isEmpty', 'isNotEmpty'] as const satisfies readonly FilterOperator[]

/** The plain operators of a field, which a filter chip does not name. */
export const PLAIN_FILTER_OPERATORS = ['anyOf', 'is'] as const satisfies readonly FilterOperator[]

/** The operators that negate what they match. */
export const NEGATING_FILTER_OPERATORS = ['noneOf', 'isNot'] as const satisfies readonly FilterOperator[]
