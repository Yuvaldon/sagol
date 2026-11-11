import type { Store } from './store'
import {
  ArchiveTagCategoryInput,
  ArchiveTagInput,
  CreateTagCategoryInput,
  CreateTagInput,
  IssueCode,
  ReorderTagCategoriesInput,
  ReorderTagsInput,
  SoldierScopedQuery,
  Tag,
  TagCategory,
  UpdateTagCategoryInput,
  UpdateTagInput,
  type DataCommands,
  type DataRepositories,
  type Issue,
  type TableName,
  type TagId,
} from '@contracts'
import { archiveTagCategoryIssues, selectionModeChangeIssues, soldierTarget, tagSelectionIssues } from '@domain'
import { holds, loadActorScope, type ActorScope } from './actor'
import { colorKeyIssues } from './checks'
import { tableOf } from './database'
import type { LocalDependencies } from './dependencies'
import { asResult, parseInput, parsedRow } from './failure'
import {
  bySortOrder,
  createReferenceCommands,
  createReferenceRepository,
  createReorderCommand,
  permissionOf,
  type ReferenceSpec,
  type RowCheck,
} from './reference'
import { POLICY_TABLES } from './snapshot'

// Tag categories and their tags: organization data, nothing predefined (D-015, D-130). Both are governed by
// the `tags` resource at `organization` (D-053). A soldier's tags are read with `soldiers:view` over the
// soldier, and `soldiers.setTags` writes them (D-130).

const ORGANIZATION = { kind: 'organization' } as const
const SOLDIERS_VIEW = { resource: 'soldiers', action: 'view' } as const

function rowsOfOrganization<T extends 'tags' | 'tag_categories' | 'soldier_tags'>(database: Store, table: T, scope: ActorScope) {
  return tableOf(database, table).where('organization_id').equals(scope.organization_id).toArray()
}

/** Switching to `single` is refused while a soldier holds two tags of the category (D-065). */
async function selectionModeIssues({ database, scope, row, before }: RowCheck<TagCategory>): Promise<Issue[]> {
  if (before === null || row.selection_mode === before.selection_mode) return []
  const [tags, soldierTags] = await Promise.all([
    rowsOfOrganization(database, 'tags', scope),
    rowsOfOrganization(database, 'soldier_tags', scope),
  ])
  return selectionModeChangeIssues(row.id, row.selection_mode, tags, soldierTags)
}

const CATEGORY_SPEC: ReferenceSpec<TagCategory> = {
  table: 'tag_categories',
  resource: 'tags',
  schema: TagCategory,
  checkTables: ['tags', 'soldier_tags'],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: async (check) => [
    ...colorKeyIssues(check.before?.color_key, check.row.color_key),
    ...(await selectionModeIssues(check)),
  ],
}

/** A new category must exist, be visible and be live. An unchanged one is left alone (D-130, as D-113). */
async function categoryIssues({ database, scope, row, before }: RowCheck<Tag>): Promise<Issue[]> {
  if (row.category_id === before?.category_id) return []
  const category = await tableOf(database, 'tag_categories').get(row.category_id)
  const visible =
    category !== undefined &&
    category.organization_id === scope.organization_id &&
    holds(scope, permissionOf('tags', 'view'), ORGANIZATION)
  if (!visible) return [{ path: ['category_id'], code: IssueCode.enum.reference_not_found }]
  if (category.archived_at !== null) return [{ path: ['category_id'], code: IssueCode.enum.reference_archived }]
  return []
}

/** `uq_tags_name`: a name is taken once among the live tags of a category. */
async function nameIssues({ database, scope, row, before }: RowCheck<Tag>): Promise<Issue[]> {
  if (row.archived_at !== null) return []
  if (before !== null && before.name === row.name && before.category_id === row.category_id) return []
  const tags = await rowsOfOrganization(database, 'tags', scope)
  const taken = tags.some(
    (tag) => tag.id !== row.id && tag.archived_at === null && tag.category_id === row.category_id && tag.name === row.name,
  )
  return taken ? [{ path: ['name'], code: IssueCode.enum.already_exists }] : []
}

const TAG_SPEC: ReferenceSpec<Tag> = {
  table: 'tags',
  resource: 'tags',
  schema: Tag,
  checkTables: ['tag_categories'],
  optionalText: [],
  targetOf: () => ORGANIZATION,
  rowIssues: async (check) => [
    ...colorKeyIssues(check.before?.color_key, check.row.color_key),
    ...(await categoryIssues(check)),
    ...(await nameIssues(check)),
  ],
}

/** The tables `soldiers.setTags` reads beyond the roster's. */
export const SOLDIER_TAG_TABLES: readonly TableName[] = ['tags', 'tag_categories', 'soldier_tags']

/**
 * The issues of a soldier's new tag set (D-130): each tag it adds must exist, be visible and be live, and the
 * whole set keeps one tag of a `single` category (D-065). Tags already held are left alone, archived or not.
 */
export async function soldierTagIssues(
  database: Store,
  scope: ActorScope,
  held: readonly TagId[],
  next: readonly TagId[],
): Promise<Issue[]> {
  const [tags, categories] = await Promise.all([
    rowsOfOrganization(database, 'tags', scope),
    rowsOfOrganization(database, 'tag_categories', scope),
  ])
  const visible = holds(scope, permissionOf('tags', 'view'), ORGANIZATION)
  const byId = new Map(tags.map((tag) => [tag.id, tag]))
  const kept = new Set(held)
  const issues: Issue[] = []
  next.forEach((tagId, index) => {
    if (kept.has(tagId)) return
    const tag = byId.get(tagId)
    if (tag === undefined || !visible) issues.push({ path: ['tag_ids', index], code: IssueCode.enum.reference_not_found })
    else if (tag.archived_at !== null) issues.push({ path: ['tag_ids', index], code: IssueCode.enum.reference_archived })
  })
  if (issues.length > 0) return issues
  return tagSelectionIssues(next, tags, categories)
}

// --------------------------------------------------------------------- reads

export function createTagCategoryRepository(dependencies: LocalDependencies): DataRepositories['tag_categories'] {
  return createReferenceRepository(dependencies, CATEGORY_SPEC, bySortOrder)
}

/** By `sort_order` inside a category. The order of the categories themselves is the caller's (D-130). */
export function createTagRepository(dependencies: LocalDependencies): DataRepositories['tags'] {
  return createReferenceRepository(dependencies, TAG_SPEC, bySortOrder)
}

/** A soldier's tags are part of the soldier: read with `soldiers:view` over them (D-130). */
export function createSoldierTagRepository(dependencies: LocalDependencies): DataRepositories['soldier_tags'] {
  const { database } = dependencies
  const tables: TableName[] = [...POLICY_TABLES, 'soldier_tags']
  return {
    list: (raw) =>
      asResult(() => {
        const query = parseInput(SoldierScopedQuery, raw)
        return database.transaction('r', tables, async () => {
          const scope = await loadActorScope(dependencies)
          const rows = await rowsOfOrganization(database, 'soldier_tags', scope)
          return rows
            .filter((row) => query.soldier_ids === null || query.soldier_ids.includes(row.soldier_id))
            .filter((row) => holds(scope, SOLDIERS_VIEW, soldierTarget(row.soldier_id)))
            .sort((a, b) => a.soldier_id.localeCompare(b.soldier_id) || a.tag_id.localeCompare(b.tag_id))
            .map((row) => parsedRow('soldier_tags', row))
        })
      }),
  }
}

// ------------------------------------------------------------------ commands

export function createTagCategoryCommands(dependencies: LocalDependencies): DataCommands['tag_categories'] {
  return {
    ...createReferenceCommands(dependencies, CATEGORY_SPEC, {
      create: CreateTagCategoryInput,
      update: UpdateTagCategoryInput,
      archive: ArchiveTagCategoryInput,
      placementOf: () => ORGANIZATION,
      archiveIssues: async (database, scope, category) =>
        archiveTagCategoryIssues(await rowsOfOrganization(database, 'tags', scope), category.id),
    }),
    reorder: createReorderCommand(dependencies, CATEGORY_SPEC, ReorderTagCategoriesInput, () => null),
  }
}

export function createTagCommands(dependencies: LocalDependencies): DataCommands['tags'] {
  return {
    ...createReferenceCommands(dependencies, TAG_SPEC, {
      create: CreateTagInput,
      update: UpdateTagInput,
      archive: ArchiveTagInput,
      placementOf: () => ORGANIZATION,
    }),
    // Tags are ordered inside their category (D-130).
    reorder: createReorderCommand(dependencies, TAG_SPEC, ReorderTagsInput, (row) => row.category_id),
  }
}
