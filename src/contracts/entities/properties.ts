import { z } from 'zod'
import { auditColumns } from '../common/audit'
import { OrganizationId, PropertyDefinitionId } from '../common/ids'
import { Integer, label } from '../common/scalars'
import { PropertyDataType, PropertyEntityType } from '../enums'
import { PropertyOption } from '../settings'

/** `property_definitions`: Notion-like custom properties (D-016). */
export const PropertyDefinition = z.object({
  id: PropertyDefinitionId,
  organization_id: OrganizationId,
  entity_type: PropertyEntityType,
  label: label(100),
  data_type: PropertyDataType,
  /** Options of select / multi_select. Domain checks that they match the data type. */
  options: z.array(PropertyOption),
  is_required: z.boolean(),
  sort_order: Integer,
  ...auditColumns,
})
export type PropertyDefinition = z.infer<typeof PropertyDefinition>
