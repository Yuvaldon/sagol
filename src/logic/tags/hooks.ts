import type {
  DeploymentId,
  PermissionCheck,
  Result,
  Soldier,
  SoldierTag,
  Tag,
  TagCategory,
  TagCategoryId,
  TagId,
  TagLifetime,
} from '@contracts'
import { checkOn } from '../permissions/checks'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { steppedItems } from '../forms/order'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import {
  liveCategories,
  tagsOfCategory,
  toCreateTagCategoryInput,
  toCreateTagInput,
  toScopedTagInputs,
  toUpdateTagCategoryInput,
  toUpdateTagInput,
  type SoldierTagGroup,
  type TagCategoryFormValues,
  type TagFormValues,
  type TagScopes,
} from './tags'

// Reading and changing tags and a soldier's tags (D-130).

const WITH_ARCHIVED = { include_archived: true }
const EVERY_SOLDIER = { soldier_ids: null }

/** Every category, archived ones too: a held tag keeps showing its category. */
export function useTagCategories(): Loaded<readonly TagCategory[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.tagCategories, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.tag_categories.list(WITH_ARCHIVED)),
    }),
  )
}

/** Every tag, archived ones too: a soldier keeps showing a tag they hold (D-130). */
export function useTags(): Loaded<readonly Tag[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.tags, WITH_ARCHIVED],
      queryFn: () => unwrap(data.repositories.tags.list(WITH_ARCHIVED)),
    }),
  )
}

/** Every tag row of every soldier the actor sees: the filters read them (D-131). */
export function useSoldierTags(): Loaded<readonly SoldierTag[]> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: [...QUERY_KEYS.soldierTags, EVERY_SOLDIER],
      queryFn: () => unwrap(data.repositories.soldier_tags.list(EVERY_SOLDIER)),
    }),
  )
}

export function useTagCategoryCommands() {
  const { data } = usePorts()
  const categories = data.commands.tag_categories
  const keys = [QUERY_KEYS.tagCategories, QUERY_KEYS.tags]

  const create = useCommand(keys, ({ values, all }: { values: TagCategoryFormValues; all: readonly TagCategory[] }) =>
    categories.create(toCreateTagCategoryInput(values, all)),
  )
  const update = useCommand(
    keys,
    async ({ category, openedVersion, values }: { category: TagCategory; openedVersion: number; values: TagCategoryFormValues }) => {
      const input = toUpdateTagCategoryInput(category, openedVersion, values)
      const unchanged: Result<TagCategory> = { ok: true, value: category }
      return input === null ? unchanged : categories.update(input)
    },
  )
  const archive = useCommand(keys, (category: TagCategory) =>
    categories.archive({ id: category.id, expected_version: category.version }),
  )
  const restore = useCommand(keys, (category: TagCategory) =>
    categories.restore({ id: category.id, expected_version: category.version }),
  )
  const step = useCommand(
    keys,
    async ({ category, direction, all }: { category: TagCategory; direction: -1 | 1; all: readonly TagCategory[] }) => {
      const items = steppedItems(liveCategories(all), category, direction)
      const unchanged: Result<TagCategory[]> = { ok: true, value: [] }
      return items === null ? unchanged : categories.reorder({ items })
    },
  )
  return { create, update, archive, restore, step }
}

export function useTagCommands() {
  const { data } = usePorts()
  const tags = data.commands.tags
  const keys = [QUERY_KEYS.tags]

  const create = useCommand(keys, ({ values, all }: { values: TagFormValues; all: readonly Tag[] }) =>
    tags.create(toCreateTagInput(values, all)),
  )
  const update = useCommand(
    keys,
    async ({ tag, openedVersion, values }: { tag: Tag; openedVersion: number; values: TagFormValues }) => {
      const input = toUpdateTagInput(tag, openedVersion, values)
      const unchanged: Result<Tag> = { ok: true, value: tag }
      return input === null ? unchanged : tags.update(input)
    },
  )
  const archive = useCommand(keys, (tag: Tag) => tags.archive({ id: tag.id, expected_version: tag.version }))
  const restore = useCommand(keys, (tag: Tag) => tags.restore({ id: tag.id, expected_version: tag.version }))
  /** Up or down inside its category (D-130). */
  const step = useCommand(keys, async ({ tag, direction, all }: { tag: Tag; direction: -1 | 1; all: readonly Tag[] }) => {
    const items = steppedItems(tagsOfCategory(all, tag.category_id), tag, direction)
    const unchanged: Result<Tag[]> = { ok: true, value: [] }
    return items === null ? unchanged : tags.reorder({ items })
  })
  return { create, update, archive, restore, step }
}

export interface SetScopedTagsRequest {
  readonly soldier: Soldier
  readonly openedVersion: number
  /** The open rotation of the mode, NULL in routine (D-257). */
  readonly rotationId: DeploymentId | null
  readonly scopes: TagScopes
  readonly groups: readonly SoldierTagGroup[]
  readonly chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>
  readonly lifetimes: ReadonlyMap<TagCategoryId, TagLifetime>
}

/**
 * A soldier's tags in both scopes (D-260, D-222): the persistent set, then the rotation's, one `setTags` each. The
 * second waits for the first; a failure stops there and is the answer.
 */
export function useSetScopedTags() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.soldierTags, QUERY_KEYS.soldiers], async (request: SetScopedTagsRequest) => {
    const inputs = toScopedTagInputs(
      request.soldier,
      request.openedVersion,
      request.rotationId,
      request.scopes,
      request.groups,
      request.chosen,
      request.lifetimes,
    )
    const saved: SoldierTag[] = []
    for (const input of inputs) {
      const result = await data.commands.soldiers.setTags(input)
      if (!result.ok) return result
      saved.push(...result.value)
    }
    const done: Result<SoldierTag[]> = { ok: true, value: saved }
    return done
  })
}

// ---------------------------------------------------------------------- hints

const TAG_CHECKS = {
  view: { permission: { resource: 'tags', action: 'view' }, target: { kind: 'organization' } },
  create: { permission: { resource: 'tags', action: 'create' }, target: { kind: 'organization' } },
  update: { permission: { resource: 'tags', action: 'update' }, target: { kind: 'organization' } },
  archive: { permission: { resource: 'tags', action: 'delete' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const TAG_CHECK_LIST: readonly PermissionCheck[] = Object.values(TAG_CHECKS)

/** Both tables are the `tags` resource at organization scope (D-053, D-130). */
export function useTagPermissions() {
  const can = useCan(TAG_CHECK_LIST)
  return {
    view: can(TAG_CHECKS.view),
    create: can(TAG_CHECKS.create),
    update: can(TAG_CHECKS.update),
    archive: can(TAG_CHECKS.archive),
  }
}

/** Whoever may update the soldier may set their tags (D-130). */
export function useCanSetTags(soldier: Soldier): boolean {
  const checks = useMemo(
    (): PermissionCheck[] => [checkOn({ resource: 'soldiers', action: 'update' }, soldier.id)],
    [soldier.id],
  )
  const can = useCan(checks)
  return checks.every(can)
}
