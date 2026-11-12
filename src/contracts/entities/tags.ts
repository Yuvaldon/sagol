import { z } from 'zod'
import { auditColumns, createdColumns } from '../common/audit'
import { DeploymentId, OrganizationId, SoldierId, SoldierTagId, TagCategoryId, TagId } from '../common/ids'
import { ColorKey, Integer, label } from '../common/scalars'
import { TagLifetime, TagSelectionMode } from '../enums'

/** `tag_categories` (D-015). */
export const TagCategory = z.object({
  id: TagCategoryId,
  organization_id: OrganizationId,
  name: label(100),
  selection_mode: TagSelectionMode,
  /** Pre-selects an assignment's lifetime only (D-260). */
  default_lifetime: TagLifetime,
  color_key: ColorKey,
  sort_order: Integer,
  ...auditColumns,
})
export type TagCategory = z.infer<typeof TagCategory>

/** `tags`. A NULL color inherits the category color. */
export const Tag = z.object({
  id: TagId,
  organization_id: OrganizationId,
  category_id: TagCategoryId,
  name: label(100),
  color_key: ColorKey.nullable(),
  sort_order: Integer,
  ...auditColumns,
})
export type Tag = z.infer<typeof Tag>

/**
 * `soldier_tags` (D-015): persistent when `deployment_id` is NULL, else held for that rotation only (D-260).
 * `single` selection mode is enforced by domain, in each scope.
 */
export const SoldierTag = z.object({
  id: SoldierTagId,
  soldier_id: SoldierId,
  tag_id: TagId,
  deployment_id: DeploymentId.nullable(),
  organization_id: OrganizationId,
  ...createdColumns,
})
export type SoldierTag = z.infer<typeof SoldierTag>
