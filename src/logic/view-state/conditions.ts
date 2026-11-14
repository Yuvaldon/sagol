import {
  JsonValue,
  LeaveStatus,
  LeaveTypeId,
  PropertyDefinitionId,
  PropertyOperator,
  type Leave,
  type PropertyDefinition,
} from '@contracts'
import { propertyMatches } from '@domain'
import { z } from 'zod'

// The board's leave conditions (D-132, D-382), apart from the hooks, so the search schema can read them.

/** The statuses the board draws, and so the ones a leave condition can choose (D-111, D-132). */
export const BoardLeaveStatus = LeaveStatus.extract(['pending', 'approved'])
export type BoardLeaveStatus = z.infer<typeof BoardLeaveStatus>

const PropertyNode = z.object({
  kind: z.literal('property'),
  property_definition_id: PropertyDefinitionId,
  operator: PropertyOperator,
  value: JsonValue,
})

/** One condition on a leave's own property (D-382): a property node, or `not` over one for "none of". */
export const LeavePropertyNode = z.discriminatedUnion('kind', [
  PropertyNode,
  z.object({ kind: z.literal('not'), node: PropertyNode }),
])
export type LeavePropertyNode = z.infer<typeof LeavePropertyNode>

/** The search param `leaves`. An empty list is never written: a chip that is not there is absent. */
export const LeaveConditions = z.object({
  statuses: z.array(BoardLeaveStatus).min(1).optional(),
  type_ids: z.array(LeaveTypeId).min(1).optional(),
  properties: z.array(LeavePropertyNode).min(1).optional(),
})
export type LeaveConditions = z.infer<typeof LeaveConditions>

export const NO_LEAVE_CONDITIONS: LeaveConditions = {}

export function hasLeaveConditions(conditions: LeaveConditions): boolean {
  return conditions.statuses !== undefined || conditions.type_ids !== undefined || conditions.properties !== undefined
}

type MatchedLeave = Pick<Leave, 'status' | 'leave_type_id' | 'properties'>

/**
 * One property condition over a leave (D-382). A definition not known, or not of leaves, matches no leave, as the
 * soldier filter's validation turns it away (D-381).
 */
function propertyNodeMatches(
  node: LeavePropertyNode,
  definitions: ReadonlyMap<PropertyDefinitionId, PropertyDefinition>,
  leave: MatchedLeave,
): boolean {
  if (node.kind === 'not') return !propertyNodeMatches(node.node, definitions, leave)
  const definition = definitions.get(node.property_definition_id)
  if (definition?.entity_type !== 'leave') return false
  return propertyMatches(definition, node.operator, node.value, leave.properties[definition.id])
}

/** True when the leave meets every condition (D-132, D-382). */
export function leaveMatches(
  conditions: LeaveConditions,
  definitions: ReadonlyMap<PropertyDefinitionId, PropertyDefinition>,
  leave: MatchedLeave,
): boolean {
  const { statuses, type_ids: typeIds, properties } = conditions
  if (statuses !== undefined && !statuses.some((status) => status === leave.status)) return false
  if (typeIds !== undefined && !typeIds.includes(leave.leave_type_id)) return false
  return properties === undefined || properties.every((node) => propertyNodeMatches(node, definitions, leave))
}
