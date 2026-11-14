import { z } from 'zod'
import { PropertyOptionId, SavedViewId } from '../common/ids'
import { ColorKey, Integer, Timestamp, label } from '../common/scalars'
import { Appearance, ReschedulePolicy } from '../enums'
import { IssueCode } from '../errors'

// Contracts of JSONB columns. Each parses `{}` (the column default) into a complete
// value, so defaults live here and nowhere else (D-041).

/** `organizations.settings`. */
export const OrganizationSettings = z
  .object({
    reschedule_policy: ReschedulePolicy.default('keep_if_can_approve'),
  })
  .prefault({})
export type OrganizationSettings = z.infer<typeof OrganizationSettings>

/** The search params a saved view keeps (D-384): never a date, a rotation, a panel or a draft. */
export const SavedViewParam = z.enum(['view', 'filter', 'sorts', 'sort', 'order', 'leaves', 'missing', 'colors', 'range'])
export type SavedViewParam = z.infer<typeof SavedViewParam>

/** The limits of saved views (D-384): part of the stored row's contract, so they live beside it. */
export const SAVED_VIEW_LIMITS = {
  /** Views per soldier. */
  max: 12,
  /** Characters in a view's name. */
  nameMax: 40,
  /** Characters in one stored param value. */
  valueMax: 4000,
} as const

function knownParams(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  return Object.fromEntries(Object.entries(raw).filter(([name]) => SavedViewParam.safeParse(name).success))
}

/**
 * The board state a saved view keeps: each kept param's value as the URL holds it, serialized (D-384), so a saved
 * view and a link are one thing and the URL parsers stay the only parser. A param a later version added is dropped on read.
 */
export const SavedViewQuery = z.preprocess(knownParams, z.partialRecord(SavedViewParam, z.string().max(SAVED_VIEW_LIMITS.valueMax)))
export type SavedViewQuery = z.infer<typeof SavedViewQuery>

/** One saved view (D-384). */
export const SavedView = z.object({
  id: SavedViewId,
  name: label(SAVED_VIEW_LIMITS.nameMax),
  query: SavedViewQuery,
})
export type SavedView = z.infer<typeof SavedView>

/** A soldier's saved views: at most `max`, names unique (`duplicate_item` on the second, D-384). */
const SavedViews = z
  .array(SavedView)
  .max(SAVED_VIEW_LIMITS.max)
  .superRefine((views, ctx) => {
    const seen = new Set<string>()
    views.forEach((view, index) => {
      if (seen.has(view.name)) ctx.addIssue({ code: 'custom', message: IssueCode.enum.duplicate_item, path: [index, 'name'] })
      seen.add(view.name)
    })
  })

/** `soldier_preferences.preferences`. A stored key no longer named here (`pinned_modules`, D-221, D-291; `rules_row_placement`, D-310) is dropped on read. */
export const SoldierPreferences = z
  .object({
    /** Pre-selects "create as approved" for actors who hold leaves:approve (D-013). */
    create_leaves_as_approved: z.boolean().default(false),
    /** The color scheme (D-181); light until chosen. */
    appearance: Appearance.default('light'),
    /** The soldier's saved views, in their order (D-384). */
    saved_views: SavedViews.default([]),
    /** The saved view a bare open of the board starts on (D-386); one no longer saved reads as NULL. */
    start_view_id: SavedViewId.nullable().catch(null).default(null),
    /** The newest update the soldier has seen on "שלי"; NULL until the first look: everything in the window is unread (D-352). */
    updates_seen_at: Timestamp.nullable().default(null),
    /** Which phone notifications the soldier wants, on every device they turned them on (D-358). */
    notifications: z
      .object({ my_request: z.boolean().default(true), awaiting_me: z.boolean().default(true) })
      .prefault({}),
  })
  // `overwrite`, not `transform`: the value is checked in place and the schema stays an object (D-039).
  .overwrite((preferences) =>
    preferences.saved_views.some((view) => view.id === preferences.start_view_id)
      ? preferences
      : { ...preferences, start_view_id: null },
  )
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
