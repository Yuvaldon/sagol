import { z } from 'zod'
import { TagCategoryId, TagId } from '../common/ids'
import { Tag, TagCategory } from '../entities/tags'
import { archiveInput, reorderInput, updateInput } from './common'

const categoryContent = TagCategory.pick({
  name: true,
  selection_mode: true,
  default_lifetime: true,
  color_key: true,
}).shape

export const CreateTagCategoryInput = z.strictObject({
  id: TagCategoryId,
  ...categoryContent,
  sort_order: TagCategory.shape.sort_order,
})
export type CreateTagCategoryInput = z.infer<typeof CreateTagCategoryInput>

/** Switching to `single` is refused by domain while a soldier holds two tags of it. */
export const UpdateTagCategoryInput = updateInput(TagCategoryId, categoryContent)
export type UpdateTagCategoryInput = z.infer<typeof UpdateTagCategoryInput>

export const ArchiveTagCategoryInput = archiveInput(TagCategoryId)
export type ArchiveTagCategoryInput = z.infer<typeof ArchiveTagCategoryInput>

export const ReorderTagCategoriesInput = reorderInput(TagCategoryId)
export type ReorderTagCategoriesInput = z.infer<typeof ReorderTagCategoriesInput>

const tagContent = Tag.pick({ name: true, color_key: true }).shape

export const CreateTagInput = z.strictObject({
  id: TagId,
  category_id: Tag.shape.category_id,
  ...tagContent,
  sort_order: Tag.shape.sort_order,
})
export type CreateTagInput = z.infer<typeof CreateTagInput>

export const UpdateTagInput = updateInput(TagId, tagContent)
export type UpdateTagInput = z.infer<typeof UpdateTagInput>

export const ArchiveTagInput = archiveInput(TagId)
export type ArchiveTagInput = z.infer<typeof ArchiveTagInput>

/** Orders the tags of one category. */
export const ReorderTagsInput = reorderInput(TagId)
export type ReorderTagsInput = z.infer<typeof ReorderTagsInput>
