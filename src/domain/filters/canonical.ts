import type { FilterExpression, FilterNode, JsonValue } from '@contracts'
import { compareCodeUnits, stableStringify } from '../json'

// Canonical form of a filter (D-031, D-067). Two filters with the same canonical key
// select the same soldiers. The form is structural: id lists sorted and without
// repetition, nested and/or flattened, repeated children removed, children sorted, one-child
// and/or unwrapped, double negation removed, a one-tag `all` written as `any`. Filters that
// are equivalent only by meaning (`not tag any` vs `tag none`) keep different keys.
// Filters are stored as entered; the canonical key is computed when needed.

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].toSorted(compareCodeUnits)
}

function canonicalOperand(operator: string, value: JsonValue): JsonValue {
  if (operator !== 'any_of' || !Array.isArray(value)) return value
  const byKey = new Map<string, JsonValue>()
  for (const item of value) byKey.set(stableStringify(item), item)
  return [...byKey.entries()].toSorted(([a], [b]) => compareCodeUnits(a, b)).map(([, item]) => item)
}

/** Deterministic text of a canonical node. */
function nodeKey(node: FilterNode): string {
  switch (node.kind) {
    case 'and':
    case 'or':
      return `${node.kind}(${node.nodes.map(nodeKey).join(',')})`
    case 'not':
      return `not(${nodeKey(node.node)})`
    case 'tag':
      return JSON.stringify([node.kind, node.match, node.tag_ids])
    case 'command_rank':
      return JSON.stringify([node.kind, node.command_rank_ids])
    case 'seniority':
      return JSON.stringify([node.kind, node.min, node.max])
    case 'unit':
      return JSON.stringify([node.kind, node.unit_ids, node.include_descendants])
    case 'soldier_status':
      return JSON.stringify([node.kind, node.statuses])
    case 'soldier':
      return JSON.stringify([node.kind, node.soldier_ids])
    case 'property':
      return `${JSON.stringify([node.kind, node.property_definition_id, node.operator])}${stableStringify(node.value)}`
  }
}

function canonicalJunction(kind: 'and' | 'or', nodes: readonly FilterNode[]): FilterNode {
  const children = new Map<string, FilterNode>()
  for (const node of nodes) {
    const canonical = canonicalNode(node)
    const flattened = canonical.kind === kind ? canonical.nodes : [canonical]
    for (const child of flattened) children.set(nodeKey(child), child)
  }
  const sorted = [...children.entries()].toSorted(([a], [b]) => compareCodeUnits(a, b)).map(([, child]) => child)
  const [only, ...rest] = sorted
  if (only !== undefined && rest.length === 0) return only
  return { kind, nodes: sorted }
}

function canonicalNode(node: FilterNode): FilterNode {
  switch (node.kind) {
    case 'and':
    case 'or':
      return canonicalJunction(node.kind, node.nodes)
    case 'not': {
      const inner = canonicalNode(node.node)
      return inner.kind === 'not' ? inner.node : { kind: 'not', node: inner }
    }
    case 'tag': {
      const tagIds = sortedUnique(node.tag_ids)
      const match = node.match === 'all' && tagIds.length === 1 ? 'any' : node.match
      return { kind: 'tag', match, tag_ids: tagIds }
    }
    case 'command_rank':
      return { kind: 'command_rank', command_rank_ids: sortedUnique(node.command_rank_ids) }
    case 'seniority':
      return { kind: 'seniority', min: node.min, max: node.max }
    case 'unit':
      return { kind: 'unit', unit_ids: sortedUnique(node.unit_ids), include_descendants: node.include_descendants }
    case 'soldier_status':
      return { kind: 'soldier_status', statuses: sortedUnique(node.statuses) }
    case 'soldier':
      return { kind: 'soldier', soldier_ids: sortedUnique(node.soldier_ids) }
    case 'property':
      return {
        kind: 'property',
        property_definition_id: node.property_definition_id,
        operator: node.operator,
        value: canonicalOperand(node.operator, node.value),
      }
  }
}

/** The canonical form of a filter (selects the same soldiers). */
export function canonicalFilter(expression: FilterExpression): FilterExpression {
  return expression.where === undefined ? {} : { where: canonicalNode(expression.where) }
}

/** Key of "every soldier" (no `where`). */
const EVERYONE_KEY = '*'

/** The canonical key: equal keys mean the same population (D-031 rule targets). */
export function filterKey(expression: FilterExpression): string {
  return expression.where === undefined ? EVERYONE_KEY : nodeKey(canonicalNode(expression.where))
}

/** True when two filters have the same canonical form. */
export function sameFilter(a: FilterExpression, b: FilterExpression): boolean {
  return filterKey(a) === filterKey(b)
}
