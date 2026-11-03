import { z } from 'zod'
import { auditColumns, createdColumns } from '../common/audit'
import { OrganizationId, SoldierId, TagCategoryId, TagId } from '../common/ids'
import { ColorKey, Integer, label } from '../common/scalars'
import { TagSelectionMode } from '../enums'

/** `tag_categories` (D-015). */
export const TagCategory = z.object({
  id: TagCategoryId,
  organization_id: OrganizationId,
  name: label(100),
  selection_mode: TagSelectionMode,
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

/** `soldier_tags`. `single` selection mode is enforced by domain. */
export const SoldierTag = z.object({
  soldier_id: SoldierId,
  tag_id: TagId,
  organization_id: OrganizationId,
  ...createdColumns,
})
export type SoldierTag = z.infer<typeof SoldierTag>
