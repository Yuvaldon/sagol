import {
  CreateTagCategoryInput,
  CreateTagInput,
  TagCategoryId,
  TagId,
  TagLifetime,
  TagSelectionMode,
  type DeploymentId,
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
import { effectiveSoldierTags, scopeTagIds } from '@domain'
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
  /** What an assignment of the category pre-selects (D-260). */
  readonly default_lifetime: TagLifetime
  /** NULL until a color is picked; the schema then answers `required`. */
  readonly color_key: string | null
}

export const NEW_TAG_CATEGORY_VALUES: TagCategoryFormValues = {
  name: '',
  selection_mode: TagSelectionMode.enum.multiple,
  default_lifetime: TagLifetime.enum.persistent,
  color_key: null,
}

export function tagCategoryFormValues(category: TagCategory): TagCategoryFormValues {
  return {
    name: category.name,
    selection_mode: category.selection_mode,
    default_lifetime: category.default_lifetime,
    color_key: category.color_key,
  }
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
    ...(values.default_lifetime === category.default_lifetime ? {} : { default_lifetime: values.default_lifetime }),
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

// ------------------------------------------------- a soldier's tags in a rotation

/** What a soldier holds in each scope (D-260): the persistent set, and the rotation's when there is one. */
export interface TagScopes {
  readonly persistent: readonly TagId[]
  readonly rotation: readonly TagId[]
}

export function soldierTagScopes(rows: readonly SoldierTag[], soldierId: SoldierId, rotationId: DeploymentId | null): TagScopes {
  return {
    persistent: scopeTagIds(rows, soldierId, null),
    rotation: rotationId === null ? [] : scopeTagIds(rows, soldierId, rotationId),
  }
}

/** What the soldier holds in the rotation (D-260): the persistent tags, a rotation's `single` choice replacing its own. */
export function effectiveTagIds(
  rows: readonly SoldierTag[],
  soldierId: SoldierId,
  rotationId: DeploymentId | null,
  tags: readonly Tag[],
  categories: readonly TagCategory[],
): TagId[] {
  const own = rows.filter((row) => row.soldier_id === soldierId)
  return effectiveSoldierTags(own, rotationId, tags, categories).map((row) => row.tag_id)
}

/** Every tag of either scope: what the groups show, so a held tag archived since can still be removed. */
export function heldInScopes(scopes: TagScopes): TagId[] {
  return [...new Set([...scopes.persistent, ...scopes.rotation])]
}

function idsOf(group: SoldierTagGroup): Set<TagId> {
  return new Set(group.choices.map((choice) => choice.tag.id))
}

/**
 * The lifetime each category opens with (D-222): the rotation's when the rotation holds one of its tags, the
 * persistent one when the persistent set does, else the category's default. Without a rotation, everything is persistent.
 */
export function initialLifetimes(
  groups: readonly SoldierTagGroup[],
  scopes: TagScopes,
  rotationId: DeploymentId | null,
): ReadonlyMap<TagCategoryId, TagLifetime> {
  return new Map(
    groups.map((group) => {
      if (rotationId === null) return [group.category.id, TagLifetime.enum.persistent]
      const own = idsOf(group)
      if (scopes.rotation.some((tagId) => own.has(tagId))) return [group.category.id, TagLifetime.enum.rotation]
      if (scopes.persistent.some((tagId) => own.has(tagId))) return [group.category.id, TagLifetime.enum.persistent]
      return [group.category.id, group.category.default_lifetime]
    }),
  )
}

/** The tags of a group held in the scope of `lifetime`: what it shows until the actor chooses. */
export function selectedInScope(group: SoldierTagGroup, scopes: TagScopes, lifetime: TagLifetime): TagId[] {
  const own = idsOf(group)
  const held = lifetime === TagLifetime.enum.rotation ? scopes.rotation : scopes.persistent
  return held.filter((tagId) => own.has(tagId))
}

/**
 * The categories of the previous rotation's tags (D-222), to copy into this one: the tags it held of each shown
 * category, with that category set to the rotation's lifetime.
 */
export function copiedRotationTags(
  groups: readonly SoldierTagGroup[],
  previous: readonly TagId[],
): { chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>; lifetimes: ReadonlyMap<TagCategoryId, TagLifetime> } {
  const copied = groups.flatMap((group) => {
    const own = idsOf(group)
    const ids = previous.filter((tagId) => own.has(tagId))
    return ids.length === 0 ? [] : [[group.category.id, ids] as const]
  })
  return {
    chosen: new Map(copied),
    lifetimes: new Map(copied.map(([categoryId]) => [categoryId, TagLifetime.enum.rotation])),
  }
}

function replaced(held: readonly TagId[], own: ReadonlySet<TagId>, next: readonly TagId[]): TagId[] {
  return [...held.filter((tagId) => !own.has(tagId)), ...next]
}

function sameSet(a: readonly TagId[], b: readonly TagId[]): boolean {
  return a.length === b.length && a.every((tagId) => b.includes(tagId))
}

/**
 * The sets to save, the persistent one first (D-260, D-222). A category kept persistent takes its choice into the
 * persistent set and leaves the rotation's; a category for the rotation takes it into the rotation's set and leaves
 * the persistent one as it is. Each set is guarded by the version it is saved at: the first by `openedVersion`, the
 * second by the version the first leaves. Empty when nothing changed.
 */
export function toScopedTagInputs(
  soldier: Soldier,
  openedVersion: number,
  rotationId: DeploymentId | null,
  scopes: TagScopes,
  groups: readonly SoldierTagGroup[],
  chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>,
  lifetimes: ReadonlyMap<TagCategoryId, TagLifetime>,
): SetSoldierTagsInput[] {
  let persistent = [...scopes.persistent]
  let rotation = [...scopes.rotation]
  for (const group of groups) {
    const lifetime = rotationId === null ? TagLifetime.enum.persistent : (lifetimes.get(group.category.id) ?? TagLifetime.enum.persistent)
    const next = chosen.get(group.category.id) ?? selectedInScope(group, scopes, lifetime)
    const own = idsOf(group)
    if (lifetime === TagLifetime.enum.rotation) rotation = replaced(rotation, own, next)
    else {
      persistent = replaced(persistent, own, next)
      rotation = replaced(rotation, own, [])
    }
  }
  const sets: { deployment_id: DeploymentId | null; tag_ids: TagId[] }[] = []
  if (!sameSet(persistent, scopes.persistent)) sets.push({ deployment_id: null, tag_ids: persistent })
  if (rotationId !== null && !sameSet(rotation, scopes.rotation)) sets.push({ deployment_id: rotationId, tag_ids: rotation })
  return sets.map((set, index) => ({ soldier_id: soldier.id, expected_version: openedVersion + index, ...set }))
}
