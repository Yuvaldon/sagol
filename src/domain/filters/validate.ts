import {
  IssueCode,
  PropertyEntityType,
  type CommandRankId,
  type FilterExpression,
  type FilterNode,
  type Issue,
  type PropertyDefinition,
  type PropertyDefinitionId,
  type SoldierId,
  type TagId,
  type UnitId,
} from '@contracts'
import { operandFits, operatorFits } from './operators'

// Write-time checks of a filter (D-067). Row references are listed by `filterReferences`
// so the data layer checks them (`reference_not_found`, `reference_archived`).

export type FilterDefinitionShape = Pick<PropertyDefinition, 'id' | 'entity_type' | 'data_type' | 'options'>

type Path = Issue['path']

function nodeIssues(
  node: FilterNode,
  path: Path,
  definitions: ReadonlyMap<string, FilterDefinitionShape>,
): Issue[] {
  switch (node.kind) {
    case 'and':
    case 'or':
      return node.nodes.flatMap((child, index) => nodeIssues(child, [...path, 'nodes', index], definitions))
    case 'not':
      return nodeIssues(node.node, [...path, 'node'], definitions)
    case 'property': {
      const definition = definitions.get(node.property_definition_id)
      if (definition === undefined || definition.entity_type !== PropertyEntityType.enum.soldier) {
        return [{ path: [...path, 'property_definition_id'], code: IssueCode.enum.property_unknown }]
      }
      if (!operatorFits(definition, node.operator)) {
        return [{ path: [...path, 'operator'], code: IssueCode.enum.filter_operator_invalid }]
      }
      if (!operandFits(definition, node.operator, node.value)) {
        return [{ path: [...path, 'value'], code: IssueCode.enum.invalid_value }]
      }
      return []
    }
    default:
      return []
  }
}

/**
 * Issues of a filter against the soldier property definitions: an unknown definition
 * (`property_unknown`), an operator outside the data type (`filter_operator_invalid`) or an
 * operand that does not fit (`invalid_value`). Paths start at `where`.
 */
export function filterIssues(
  expression: FilterExpression,
  definitions: Iterable<FilterDefinitionShape>,
): Issue[] {
  if (expression.where === undefined) return []
  const byId = new Map<string, FilterDefinitionShape>()
  for (const definition of definitions) byId.set(definition.id, definition)
  return nodeIssues(expression.where, ['where'], byId)
}

/** Rows a filter references, each id once. */
export interface FilterReferences {
  readonly tag_ids: TagId[]
  readonly command_rank_ids: CommandRankId[]
  readonly unit_ids: UnitId[]
  readonly soldier_ids: SoldierId[]
  readonly property_definition_ids: PropertyDefinitionId[]
}

/** Every row id a filter references, for the data layer's integrity checks. */
export function filterReferences(expression: FilterExpression): FilterReferences {
  const tags = new Set<TagId>()
  const ranks = new Set<CommandRankId>()
  const units = new Set<UnitId>()
  const soldiers = new Set<SoldierId>()
  const definitions = new Set<PropertyDefinitionId>()
  const visit = (node: FilterNode): void => {
    switch (node.kind) {
      case 'and':
      case 'or':
        node.nodes.forEach(visit)
        return
      case 'not':
        visit(node.node)
        return
      case 'tag':
        node.tag_ids.forEach((id) => tags.add(id))
        return
      case 'command_rank':
        node.command_rank_ids.forEach((id) => ranks.add(id))
        return
      case 'unit':
        node.unit_ids.forEach((id) => units.add(id))
        return
      case 'soldier':
        node.soldier_ids.forEach((id) => soldiers.add(id))
        return
      case 'property':
        definitions.add(node.property_definition_id)
        return
      case 'seniority':
      case 'soldier_status':
        return
    }
  }
  if (expression.where !== undefined) visit(expression.where)
  return {
    tag_ids: [...tags],
    command_rank_ids: [...ranks],
    unit_ids: [...units],
    soldier_ids: [...soldiers],
    property_definition_ids: [...definitions],
  }
}
