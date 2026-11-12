import {
  IssueCode,
  TagSelectionMode,
  type DeploymentId,
  type Issue,
  type SoldierId,
  type SoldierTag,
  type Tag,
  type TagCategory,
  type TagCategoryId,
  type TagId,
} from '@contracts'

// Tag categories with selection mode (D-015, D-065): a soldier holds at most one tag of a
// `single` category. Every assigned tag counts, archived ones included.

type TagShape = Pick<Tag, 'id' | 'category_id'>
type CategoryShape = Pick<TagCategory, 'id' | 'selection_mode'>

/**
 * Issues of a soldier's tag set (`setSoldierTags`): the second tag of a `single` category
 * answers `tag_single_selection` at its index. Unknown tags are the data layer's
 * `reference_not_found`.
 */
export function tagSelectionIssues(
  tagIds: readonly TagId[],
  tags: Iterable<TagShape>,
  categories: Iterable<CategoryShape>,
): Issue[] {
  const categoryOf = new Map<TagId, TagCategoryId>()
  for (const tag of tags) categoryOf.set(tag.id, tag.category_id)
  const single = new Set<TagCategoryId>()
  for (const category of categories) {
    if (category.selection_mode === TagSelectionMode.enum.single) single.add(category.id)
  }
  const taken = new Set<TagCategoryId>()
  const issues: Issue[] = []
  tagIds.forEach((tagId, index) => {
    const categoryId = categoryOf.get(tagId)
    if (categoryId === undefined || !single.has(categoryId)) return
    if (taken.has(categoryId)) issues.push({ path: ['tag_ids', index], code: IssueCode.enum.tag_single_selection })
    taken.add(categoryId)
  })
  return issues
}

/**
 * Switching a category to `single` is refused while a soldier holds two of its tags
 * (`tag_single_selection` at `selection_mode`).
 */
export function selectionModeChangeIssues(
  categoryId: TagCategoryId,
  mode: TagSelectionMode,
  tags: Iterable<TagShape>,
  soldierTags: Iterable<Pick<SoldierTag, 'soldier_id' | 'tag_id' | 'deployment_id'>>,
): Issue[] {
  if (mode !== TagSelectionMode.enum.single) return []
  const inCategory = new Set<TagId>()
  for (const tag of tags) {
    if (tag.category_id === categoryId) inCategory.add(tag.id)
  }
  const holders = new Set<string>()
  for (const row of soldierTags) {
    if (!inCategory.has(row.tag_id)) continue
    // `single` holds within each scope: the persistent set, or one rotation's (D-221).
    const holder = `${row.soldier_id}|${row.deployment_id ?? ''}`
    if (holders.has(holder)) {
      return [{ path: ['selection_mode'], code: IssueCode.enum.tag_single_selection }]
    }
    holders.add(holder)
  }
  return []
}

/**
 * A category stays while a live tag belongs to it, so no live tag sits under a name nobody can see (D-130, as
 * D-113 for leave type groups).
 */
export function archiveTagCategoryIssues(
  tags: Iterable<Pick<Tag, 'category_id' | 'archived_at'>>,
  categoryId: TagCategoryId,
): Issue[] {
  for (const tag of tags) {
    if (tag.category_id === categoryId && tag.archived_at === null) return [{ path: [], code: IssueCode.enum.group_in_use }]
  }
  return []
}

type ScopedTag = Pick<SoldierTag, 'soldier_id' | 'tag_id' | 'deployment_id'>

/**
 * The tags a soldier holds in a rotation (D-260, D-221): the persistent ones plus that rotation's, where a rotation tag
 * of a `single` category replaces the persistent tag of that category. With no rotation, only the persistent ones.
 * Rows keep their shape, so the result feeds every reader of `soldier_tags`.
 */
export function effectiveSoldierTags<Row extends ScopedTag>(
  soldierTags: Iterable<Row>,
  rotationId: DeploymentId | null,
  tags: Iterable<TagShape>,
  categories: Iterable<CategoryShape>,
): Row[] {
  const categoryOf = new Map<TagId, TagCategoryId>()
  for (const tag of tags) categoryOf.set(tag.id, tag.category_id)
  const single = new Set<TagCategoryId>()
  for (const category of categories) {
    if (category.selection_mode === TagSelectionMode.enum.single) single.add(category.id)
  }
  const persistent: Row[] = []
  const rotation: Row[] = []
  for (const row of soldierTags) {
    if (row.deployment_id === null) persistent.push(row)
    else if (row.deployment_id === rotationId) rotation.push(row)
  }
  const replaced = new Set<string>()
  for (const row of rotation) {
    const categoryId = categoryOf.get(row.tag_id)
    if (categoryId !== undefined && single.has(categoryId)) replaced.add(`${row.soldier_id}|${categoryId}`)
  }
  const kept = persistent.filter((row) => {
    const categoryId = categoryOf.get(row.tag_id)
    return categoryId === undefined || !replaced.has(`${row.soldier_id}|${categoryId}`)
  })
  return [...kept, ...rotation]
}

/** A soldier's tags of one scope (D-221): the persistent set when `rotationId` is NULL, else that rotation's. */
export function scopeTagIds(
  soldierTags: Iterable<ScopedTag>,
  soldierId: SoldierId,
  rotationId: DeploymentId | null,
): TagId[] {
  const ids: TagId[] = []
  for (const row of soldierTags) {
    if (row.soldier_id === soldierId && row.deployment_id === rotationId) ids.push(row.tag_id)
  }
  return ids
}
