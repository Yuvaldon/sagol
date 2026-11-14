import { z } from 'zod'
import { CommandRankId, PropertyDefinitionId, SoldierId, TagId, UnitId } from '../common/ids'
import { Integer, JsonValue } from '../common/scalars'
import { SchemaIssue } from '../common/issues'
import { SoldierStatus } from '../enums'
import type { FilterOperator } from './operators'

// FilterExpression: one model that selects soldiers, shared by view filters, saved views
// and availability-rule populations (ARCHITECTURE "Filters", D-014, D-031). Evaluated and
// put in canonical form by domain. Contracts define the shape only.

/** How a tag condition matches the soldier's tags. */
export const TagMatch = z.enum(['any', 'all', 'none'])
export type TagMatch = z.infer<typeof TagMatch>

/** Comparison applied to a custom property value. Domain checks it against the data type. */
export const PropertyOperator = z.enum([
  'equals',
  'not_equals',
  'contains',
  'any_of',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
  'is_empty',
  'is_not_empty',
])
export type PropertyOperator = z.infer<typeof PropertyOperator>

/** The operators a typed value is compared by (D-380): text, number and date properties. */
export const COMPARE_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
] as const satisfies readonly PropertyOperator[]
export type CompareOperator = (typeof COMPARE_OPERATORS)[number]

/** The stored operator a compared value is written with (D-380); a date's "before" is "less than". */
export const COMPARE_OPERATOR_OF = {
  is: 'equals',
  isNot: 'not_equals',
  contains: 'contains',
  greaterThan: 'greater_than',
  greaterOrEqual: 'greater_or_equal',
  lessThan: 'less_than',
  lessOrEqual: 'less_or_equal',
  before: 'less_than',
  onOrBefore: 'less_or_equal',
  after: 'greater_than',
  onOrAfter: 'greater_or_equal',
} as const satisfies Partial<Record<FilterOperator, CompareOperator>>


export const FilterNodeKind = z.enum([
  'and',
  'or',
  'not',
  'tag',
  'command_rank',
  'seniority',
  'unit',
  'soldier_status',
  'soldier',
  'property',
])
export type FilterNodeKind = z.infer<typeof FilterNodeKind>

export type FilterNode =
  | { kind: 'and'; nodes: FilterNode[] }
  | { kind: 'or'; nodes: FilterNode[] }
  | { kind: 'not'; node: FilterNode }
  | { kind: 'tag'; match: TagMatch; tag_ids: TagId[] }
  | { kind: 'command_rank'; command_rank_ids: CommandRankId[] }
  | { kind: 'seniority'; min: number | null; max: number | null }
  | { kind: 'unit'; unit_ids: UnitId[]; include_descendants: boolean }
  | { kind: 'soldier_status'; statuses: SoldierStatus[] }
  | { kind: 'soldier'; soldier_ids: SoldierId[] }
  | {
      kind: 'property'
      property_definition_id: PropertyDefinitionId
      operator: PropertyOperator
      value: JsonValue
    }

export const FilterNode: z.ZodType<FilterNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('and'), nodes: z.array(FilterNode).min(1) }),
    z.object({ kind: z.literal('or'), nodes: z.array(FilterNode).min(1) }),
    z.object({ kind: z.literal('not'), node: FilterNode }),
    z.object({ kind: z.literal('tag'), match: TagMatch, tag_ids: z.array(TagId).min(1) }),
    z.object({
      kind: z.literal('command_rank'),
      command_rank_ids: z.array(CommandRankId).min(1),
    }),
    /** Effective seniority (D-029), inclusive bounds. At least one bound is set. */
    z
      .object({ kind: z.literal('seniority'), min: Integer.nullable(), max: Integer.nullable() })
      .refine((node) => node.min !== null || node.max !== null, { message: SchemaIssue.enum.bound_missing })
      .refine((node) => node.min === null || node.max === null || node.min <= node.max, {
        message: SchemaIssue.enum.range_inverted,
      }),
    z.object({
      kind: z.literal('unit'),
      unit_ids: z.array(UnitId).min(1),
      include_descendants: z.boolean(),
    }),
    z.object({
      kind: z.literal('soldier_status'),
      statuses: z.array(SoldierStatus).min(1),
    }),
    z.object({ kind: z.literal('soldier'), soldier_ids: z.array(SoldierId).min(1) }),
    z.object({
      kind: z.literal('property'),
      property_definition_id: PropertyDefinitionId,
      operator: PropertyOperator,
      /** Operand, typed by the property's data type. `null` for is_empty / is_not_empty. */
      value: JsonValue,
    }),
  ]),
)

/**
 * A stored or URL-held filter. No `where` means "every soldier", so the column default
 * `{}` is a valid expression.
 */
export const FilterExpression = z.object({
  where: FilterNode.optional(),
})
export type FilterExpression = z.infer<typeof FilterExpression>

export * from './operators'
