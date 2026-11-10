import type {
  PermissionCheck,
  Result,
  Soldier,
  SoldierTag,
  Tag,
  TagCategory,
  TagCategoryId,
  TagId,
} from '@contracts'
import { soldierTarget } from '@domain'
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
  toSetTagsInput,
  toUpdateTagCategoryInput,
  toUpdateTagInput,
  type SoldierTagGroup,
  type TagCategoryFormValues,
  type TagFormValues,
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
  const step = useCommand(
    keys,
    async ({ category, direction, all }: { category: TagCategory; direction: -1 | 1; all: readonly TagCategory[] }) => {
      const items = steppedItems(liveCategories(all), category, direction)
      const unchanged: Result<TagCategory[]> = { ok: true, value: [] }
      return items === null ? unchanged : categories.reorder({ items })
    },
  )
  return { create, update, archive, step }
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
  /** Up or down inside its category (D-130). */
  const step = useCommand(keys, async ({ tag, direction, all }: { tag: Tag; direction: -1 | 1; all: readonly Tag[] }) => {
    const items = steppedItems(tagsOfCategory(all, tag.category_id), tag, direction)
    const unchanged: Result<Tag[]> = { ok: true, value: [] }
    return items === null ? unchanged : tags.reorder({ items })
  })
  return { create, update, archive, step }
}

export interface SetSoldierTagsRequest {
  readonly soldier: Soldier
  readonly openedVersion: number
  readonly held: readonly TagId[]
  readonly groups: readonly SoldierTagGroup[]
  readonly chosen: ReadonlyMap<TagCategoryId, readonly TagId[]>
}

/** `soldiers.setTags`: the whole set, guarded by the version the form opened with (D-130). */
export function useSetSoldierTags() {
  const { data } = usePorts()
  return useCommand([QUERY_KEYS.soldierTags, QUERY_KEYS.soldiers], async (request: SetSoldierTagsRequest) => {
    const input = toSetTagsInput(request.soldier, request.openedVersion, request.held, request.groups, request.chosen)
    const unchanged: Result<SoldierTag[]> = { ok: true, value: [] }
    return input === null ? unchanged : data.commands.soldiers.setTags(input)
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
    (): PermissionCheck[] => [{ permission: { resource: 'soldiers', action: 'update' }, target: soldierTarget(soldier.id) }],
    [soldier.id],
  )
  const can = useCan(checks)
  return checks.every(can)
}
