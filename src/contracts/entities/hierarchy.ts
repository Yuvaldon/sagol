import { z } from 'zod'
import { auditColumns } from '../common/audit'
import { OrganizationId, PropertyDefinitionId, UnitId, UnitLevelId } from '../common/ids'
import { checkDateRange } from '../common/refinements'
import { CalendarDate, ColorKey, Integer, JsonValue, label, varchar } from '../common/scalars'
import { UnitKind } from '../enums'

/** Custom property values keyed by definition id (D-016). Validated by domain. */
export const PropertyValues = z.record(PropertyDefinitionId, JsonValue)
export type PropertyValues = z.infer<typeof PropertyValues>

/** `unit_levels`: user-defined classification (battalion, company, platoon, ...). */
export const UnitLevel = z.object({
  id: UnitLevelId,
  organization_id: OrganizationId,
  name: label(100),
  sort_order: Integer,
  ...auditColumns,
})
export type UnitLevel = z.infer<typeof UnitLevel>

/** `units`. `parent_id` is the only source of ancestry (D-009). */
export const Unit = z
  .object({
    id: UnitId,
    organization_id: OrganizationId,
    name: label(100),
    code: varchar(50).nullable(),
    parent_id: UnitId.nullable(),
    unit_level_id: UnitLevelId.nullable(),
    kind: UnitKind,
    valid_from: CalendarDate.nullable(),
    valid_to: CalendarDate.nullable(),
    color_key: ColorKey.nullable(),
    sort_order: Integer,
    properties: PropertyValues,
    ...auditColumns,
  })
  .superRefine((row, ctx) => {
    checkDateRange(ctx, row.valid_from, row.valid_to, 'valid_to')
  })
export type Unit = z.infer<typeof Unit>
