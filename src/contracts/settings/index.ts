import { z } from 'zod'
import { PropertyOptionId } from '../common/ids'
import { ColorKey, Integer, label } from '../common/scalars'
import { Appearance, ReschedulePolicy } from '../enums'
import { DashboardLayout, StrictDashboardLayout } from './dashboard'

export * from './dashboard'

// Contracts of JSONB columns. Each parses `{}` (the column default) into a complete
// value, so defaults live here and nowhere else (D-041).

/** `organizations.settings`. */
export const OrganizationSettings = z
  .object({
    reschedule_policy: ReschedulePolicy.default('keep_if_can_approve'),
  })
  .prefault({})
export type OrganizationSettings = z.infer<typeof OrganizationSettings>

const preferenceFields = {
  /** Pre-selects "create as approved" for actors who hold leaves:approve (D-013). */
  create_leaves_as_approved: z.boolean().default(false),
  /** The color scheme (D-181); light until chosen. */
  appearance: Appearance.default('light'),
}

/**
 * `soldier_preferences.preferences`. A stored key no longer named here (`pinned_modules`, D-221, D-291;
 * `rules_row_placement`, D-310) is dropped on read, and a board that no longer parses reads as none (D-349, D-361).
 */
export const SoldierPreferences = z
  .object({
    ...preferenceFields,
    /** The command dashboard's board (D-349); none until edited, so the default template applies. */
    dashboard: DashboardLayout.nullable().catch(null).default(null),
  })
  .prefault({})
export type SoldierPreferences = z.infer<typeof SoldierPreferences>

/** `soldier_preferences.preferences` as written: the board is checked whole, never repaired (D-361). */
export const StrictSoldierPreferences = z
  .object({
    ...preferenceFields,
    dashboard: StrictDashboardLayout.nullable().default(null),
  })
  .prefault({})
export type StrictSoldierPreferences = z.infer<typeof StrictSoldierPreferences>

/** One option of a select / multi_select property (`property_definitions.options`). */
export const PropertyOption = z.object({
  id: PropertyOptionId,
  label: label(100),
  color_key: ColorKey.nullable(),
  sort_order: Integer,
})
export type PropertyOption = z.infer<typeof PropertyOption>
