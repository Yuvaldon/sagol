import { z } from 'zod'
import { PropertyOptionId } from '../common/ids'
import { ColorKey, Integer, label } from '../common/scalars'
import { Appearance, ReschedulePolicy, RulesRowPlacement } from '../enums'

// Contracts of JSONB columns. Each parses `{}` (the column default) into a complete
// value, so defaults live here and nowhere else (D-041).

/** `organizations.settings`. */
export const OrganizationSettings = z
  .object({
    reschedule_policy: ReschedulePolicy.default('keep_if_can_approve'),
  })
  .prefault({})
export type OrganizationSettings = z.infer<typeof OrganizationSettings>

/** `soldier_preferences.preferences`. A stored key no longer named here (`pinned_modules`, D-221, D-291) is dropped on read. */
export const SoldierPreferences = z
  .object({
    /** Pre-selects "create as approved" for actors who hold leaves:approve (D-013). */
    create_leaves_as_approved: z.boolean().default(false),
    /** Where the rules heat row sits on the board (D-173). */
    rules_row_placement: RulesRowPlacement.default('below'),
    /** The color scheme (D-181); light until chosen. */
    appearance: Appearance.default('light'),
  })
  .prefault({})
export type SoldierPreferences = z.infer<typeof SoldierPreferences>

/** One option of a select / multi_select property (`property_definitions.options`). */
export const PropertyOption = z.object({
  id: PropertyOptionId,
  label: label(100),
  color_key: ColorKey.nullable(),
  sort_order: Integer,
})
export type PropertyOption = z.infer<typeof PropertyOption>
