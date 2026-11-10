import {
  CreateTagCategoryInput,
  CreateTagInput,
  TagCategoryId,
  TagId,
  TagSelectionMode,
  type Issue,
  type SetSoldierTagsInput,
  type Soldier,
  type SoldierId,
  type SoldierTag,
  type Tag,
  type TagCategory,
  type UpdateTagCategoryInput,
  type UpdateTagInput,
} from '@contracts'
import { formIssues } from '../forms/issues'
import { bySortOrder, nextSortOrder } from '../forms/order'

// Tag categories, tags and a soldier's tags, between the store and the screens (D-130). Pure.

export function liveCategories(categories: readonly TagCategory[]): TagCategory[] {
  return categories.filter((category) => category.archived_at === null).toSorted(bySortOrder)
}

/** The live tags of a category, in order: what moving one up or down reorders. */
export function tagsOfCategory(tags: readonly Tag[], categoryId: TagCategoryId): Tag[] {
  return tags.filter((tag) => tag.archived_at === null && tag.category_id === categoryId).toSorted(bySortOrder)
}

/** A live category and its live tags. */
export interface TagSection {
  readonly category: TagCategory
  readonly tags: readonly Tag[]
}

/** Live categories in their order, each with its live tags in theirs. A category with no tag still has its section. */
export function tagSections(categories: readonly TagCategory[], tags: readonly Tag[]): TagSection[] {
  return liveCategories(categories).map((category) => ({ category, tags: tagsOfCategory(tags, category.id) }))
}

/** A tag's own color, else its category's (D-015). NULL when neither is known. */
export function tagColorOf(tag: Tag, categories: readonly TagCategory[]): string | null {
  return tag.color_key ?? categories.find((category) => category.id === tag.category_id)?.color_key ?? null
}

// ------------------------------------------------------------------ categories

export interface TagCategoryFormValues {
  readonly name: string
  readonly selection_mode: TagSelectionMode
  /** NULL until a color is picked; the schema then answers `required`. */
  readonly color_key: string | null
}

export const NEW_TAG_CATEGORY_VALUES: TagCategoryFormValues = {
  name: '',
  selection_mode: TagSelectionMode.enum.multiple,
  color_key: null,
}

export function tagCategoryFormValues(category: TagCategory): TagCategoryFormValues {
  return { name: category.name, selection_mode: category.selection_mode, color_key: category.color_key }
}

function createCategoryInput(values: TagCategoryFormValues, categories: readonly TagCategory[]) {
  return { id: TagCategoryId.parse(crypto.randomUUID()), ...values, sort_order: nextSortOrder(liveCategories(categories)) }
}

/** The same field codes the adapter answers (D-068). */
export function tagCategoryFormIssues(values: TagCategoryFormValues): Issue[] {
  return formIssues(CreateTagCategoryInput, createCategoryInput(values, []))
}

export function toCreateTagCategoryInput(values: TagCategoryFormValues, categories: readonly TagCategory[]): CreateTagCategoryInput {
  return CreateTagCategoryInput.parse(createCategoryInput(values, categories))
}

/** NULL when nothing changed. A form opened at `openedVersion` answers `stale_version` to a later change. */
export function toUpdateTagCategoryInput(
  category: TagCategory,
  openedVersion: number,
  values: TagCategoryFormValues,
): UpdateTagCategoryInput | null {
  const changes = {
    ...(values.name === category.name ? {} : { name: values.name }),
    ...(values.selection_mode === category.selection_mode ? {} : { selection_mode: values.selection_mode }),
    ...(values.color_key === category.color_key || values.color_key === null ? {} : { color_key: values.color_key }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: category.id, expected_version: openedVersion, changes }
}

// ------------------------------------------------------------------------ tags

export interface TagFormValues {
  readonly name: string
  /** NULL until one is picked; the schema then answers `required`. */
  readonly category_id: TagCategoryId | null
  /** NULL inherits the category's color (D-015). */
  readonly color_key: string | null
}

export function newTagValues(categoryId: TagCategoryId | null): TagFormValues {
  return { name: '', category_id: categoryId, color_key: null }
}

export function tagFormValues(tag: Tag): TagFormValues {
  return { name: tag.name, category_id: tag.category_id, color_key: tag.color_key }
}

function createTagInput(values: TagFormValues, tags: readonly Tag[]) {
  const siblings = values.category_id === null ? [] : tagsOfCategory(tags, values.category_id)
  return { id: TagId.parse(crypto.randomUUID()), ...values, sort_order: nextSortOrder(siblings) }
}

export function tagFormIssues(values: TagFormValues): Issue[] {
  return formIssues(CreateTagInput, createTagInput(values, []))
}

export function toCreateTagInput(values: TagFormValues, tags: readonly Tag[]): CreateTagInput {
  return CreateTagInput.parse(createTagInput(values, tags))
}

/** The category is set at creation only; the name and the color change (D-130). */
export function toUpdateTagInput(tag: Tag, openedVersion: number, values: TagFormValues): UpdateTagInput | null {
  const changes = {
    ...(values.name === tag.name ? {} : { name: values.name }),
    ...(values.color_key === tag.color_key ? {} : { color_key: values.color_key }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: tag.id, expected_version: openedVersion, changes }
}

// ------------------------------------------------------------- a soldier's tags

/** The tag ids each soldier holds. */
export function tagsBySoldier(rows: readonly SoldierTag[]): ReadonlyMap<SoldierId, readonly TagId[]> {
  const bySoldier = new Map<SoldierId, TagId[]>()
  for (const row of rows) {
    const own = bySoldier.get(row.soldier_id)
    if (own === undefined) bySoldier.set(row.soldier_id, [row.tag_id])
    else own.push(row.tag_id)
  }
  return bySoldier
}

/** A tag as a soldier's page shows it: live, or held and archived since (D-130). */
export interface TagChoice {
  readonly tag: Tag
  readonly archived: boolean
}

/** One category of a soldier's tags: what may be chosen, and what is. */
export interface SoldierTagGroup {
  readonly category: TagCategory
  readonly choices: readonly TagChoice[]
  readonly selected: readonly TagId[]
}

/**
 * The categories of a soldier's tags, in order. Live tags may be chosen; a held tag archived since shows too, so it
 * can be removed, never added (D-130). A category with nothing to choose is left out. Held tags whose category the
 * actor cannot see are not shown and stay as they are.
 */
export function soldierTagGroups(
  categories: readonly TagCategory[],
  tags: readonly Tag[],
  held: readonly TagId[],
): SoldierTagGroup[] {
  const heldSet = new Set(held)
  const shown = categories.filter(
    (category) => category.archived_at === null || tags.some((tag) => tag.category_id === category.id && heldSet.has(tag.id)),
  )
  return shown.toSorted(bySortOrder).flatMap((category) => {
    const own = tags.filter((tag) => tag.category_id === category.id).toSorted(bySortOrder)
    const choices = own
      .filter((tag) => tag.archived_at === null || heldSet.has(tag.id))
      .map((tag) => ({ tag, archived: tag.archived_at !== null }))
    if (choices.length === 0) return []
    return [{ category, choices, selected: own.filter((tag) => heldSet.has(tag.id)).map((tag) => tag.id) }]
  })
}

/** A `single` category holds one choice: a new one replaces the others (D-065). */
export function toggledTags(group: SoldierTagGroup, tagId: TagId, on: boolean): TagId[] {
  if (!on) return group.selected.filter((id) => id !== tagId)
  if (group.category.selection_mode === TagSelectionMode.enum.single) return [tagId]
  return group.selected.includes(tagId) ? [...group.selected] : [...group.selected, tagId]
}

/**
 * The whole set (D-045): the chosen tags of the groups shown, and the held tags no group shows, kept as they are.
 * NULL when nothing changed.
 */
export function toSetTagsInput(
  soldier: Soldier,
  openedVersion: number,
  held: readonly TagId[],
  groups: readonly SoldierTagGroup[],
  chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>,
): SetSoldierTagsInput | null {
  const shown = new Set(groups.flatMap((group) => group.choices.map((choice) => choice.tag.id)))
  const next = [
    ...held.filter((tagId) => !shown.has(tagId)),
    ...groups.flatMap((group) => chosen.get(group.category.id) ?? group.selected),
  ]
  const same = next.length === held.length && next.every((tagId) => held.includes(tagId))
  return same ? null : { soldier_id: soldier.id, expected_version: openedVersion, tag_ids: next }
}
