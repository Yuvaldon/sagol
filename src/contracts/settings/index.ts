import { z } from 'zod'
import { PropertyOptionId } from '../common/ids'
import { ColorKey, Integer, Timestamp, label } from '../common/scalars'
import { Appearance, ReschedulePolicy } from '../enums'

// Contracts of JSONB columns. Each parses `{}` (the column default) into a complete
// value, so defaults live here and nowhere else (D-041).

/** `organizations.settings`. */
export const OrganizationSettings = z
  .object({
    reschedule_policy: ReschedulePolicy.default('keep_if_can_approve'),
  })
  .prefault({})
export type OrganizationSettings = z.infer<typeof OrganizationSettings>

/** `soldier_preferences.preferences`. A stored key no longer named here (`pinned_modules`, D-221, D-291; `rules_row_placement`, D-310) is dropped on read. */
export const SoldierPreferences = z
  .object({
    /** Pre-selects "create as approved" for actors who hold leaves:approve (D-013). */
    create_leaves_as_approved: z.boolean().default(false),
    /** The color scheme (D-181); light until chosen. */
    appearance: Appearance.default('light'),
    /** The newest update the soldier has seen on "שלי"; NULL until the first look: everything in the window is unread (D-352). */
    updates_seen_at: Timestamp.nullable().default(null),
    /** Which phone notifications the soldier wants, on every device they turned them on (D-358). */
    notifications: z
      .object({ my_request: z.boolean().default(true), awaiting_me: z.boolean().default(true) })
      .prefault({}),
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
