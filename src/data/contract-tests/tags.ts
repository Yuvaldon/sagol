import {
  DeploymentId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CreateTagCategoryInput,
  type CreateTagInput,
  type DataChange,
  type OrganizationId,
  type Permission,
  type TagCategory,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, seedActor, seedRotation, valueOf } from './support'

// Tag categories, tags and a soldier's tags against the shared contract (D-130), with denial paths through
// seeded grants (D-076). Sample data, test files only.

const LAST_WEEK = '2026-11-01'

const newCategoryId = () => TagCategoryId.parse(crypto.randomUUID())
const newTagId = () => TagId.parse(crypto.randomUUID())

function categoryInput(overrides: Partial<CreateTagCategoryInput> = {}): CreateTagCategoryInput {
  return { id: newCategoryId(), name: 'Role', selection_mode: 'multiple', default_lifetime: 'persistent', color_key: 'teal', sort_order: 0, ...overrides }
}

function tagInput(category: TagCategory, overrides: Partial<CreateTagInput> = {}): CreateTagInput {
  return { id: newTagId(), category_id: category.id, name: 'Medic', color_key: null, sort_order: 0, ...overrides }
}

const VIEW_TAGS: Permission = { resource: 'tags', action: 'view' }
const CREATE_TAGS: Permission = { resource: 'tags', action: 'create' }
const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const UPDATE_SOLDIERS: Permission = { resource: 'soldiers', action: 'update' }
const VIEW_UNITS: Permission = { resource: 'units', action: 'view' }

export function describeTagContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('tags', () => {
    let organization: OrganizationId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    const createCategory = async (overrides: Partial<CreateTagCategoryInput> = {}) =>
      valueOf(await adapter().commands.tag_categories.create(categoryInput(overrides)))
    const createTag = async (category: TagCategory, overrides: Partial<CreateTagInput> = {}) =>
      valueOf(await adapter().commands.tags.create(tagInput(category, overrides)))
    const versionOf = async (soldierId: SoldierId) => valueOf(await adapter().repositories.soldiers.get(soldierId)).version
    const tagsOf = async (soldierId: SoldierId) =>
      valueOf(await adapter().repositories.soldier_tags.list({ soldier_ids: [soldierId] })).map((row) => row.tag_id)

    async function newSoldier(unitId: UnitId | null = null) {
      const id = SoldierId.parse(crypto.randomUUID())
      valueOf(
        await adapter().commands.soldiers.create({
          id,
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership: unitId === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unitId, valid_from: LAST_WEEK },
        }),
      )
      return id
    }

    async function newUnit(name: string, parent_id: UnitId | null = null) {
      return valueOf(
        await adapter().commands.units.create({
          id: UnitId.parse(crypto.randomUUID()),
          parent_id,
          sort_order: 0,
          name,
          code: null,
          unit_level_id: null,
          kind: 'standing',
          valid_from: null,
          valid_to: null,
          color_key: null,
          properties: {},
        }),
      )
    }

    describe('categories and tags', () => {
      it('creates, lists in order, and checks the color', async () => {
        const second = await createCategory({ name: 'Skills', sort_order: 1 })
        const first = await createCategory({ name: 'Marital', selection_mode: 'single', sort_order: 0 })
        const listed = valueOf(await adapter().repositories.tag_categories.list({ include_archived: false }))
        expect(listed.map((row) => row.id)).toEqual([first.id, second.id])
        expect(listed[0]).toMatchObject({ selection_mode: 'single', created_by: ownerId, version: 1 })
        expect(issuesOf(await adapter().commands.tag_categories.create(categoryInput({ color_key: 'not-a-color' })))).toEqual([
          { path: ['color_key'], code: 'invalid_value' },
        ])
      })

      it('needs a live, visible category for a new tag, and a free name inside it', async () => {
        const category = await createCategory()
        const tag = await createTag(category)
        expect(tag).toMatchObject({ category_id: category.id, color_key: null, created_by: ownerId })
        expect(issuesOf(await adapter().commands.tags.create(tagInput(category)))).toEqual([{ path: ['name'], code: 'already_exists' }])
        const other = await createCategory({ name: 'Other' })
        expect(valueOf(await adapter().commands.tags.create(tagInput(other))).name).toBe('Medic')
        expect(
          issuesOf(await adapter().commands.tags.create({ ...tagInput(category, { name: 'X' }), category_id: newCategoryId() })),
        ).toEqual([{ path: ['category_id'], code: 'reference_not_found' }])
        // An archived tag frees its name.
        valueOf(await adapter().commands.tags.archive({ id: tag.id, expected_version: 1 }))
        expect(valueOf(await adapter().commands.tags.create(tagInput(category))).archived_at).toBeNull()
      })

      it('refuses archiving a category with a live tag, and picking an archived one', async () => {
        const category = await createCategory()
        const tag = await createTag(category)
        expect(issuesOf(await adapter().commands.tag_categories.archive({ id: category.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'group_in_use' },
        ])
        valueOf(await adapter().commands.tags.archive({ id: tag.id, expected_version: 1 }))
        valueOf(await adapter().commands.tag_categories.archive({ id: category.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.tags.create(tagInput(category, { name: 'New' })))).toEqual([
          { path: ['category_id'], code: 'reference_archived' },
        ])
      })

      it('reorders tags inside their category only', async () => {
        const category = await createCategory()
        const other = await createCategory({ name: 'Other', sort_order: 1 })
        const a = await createTag(category, { name: 'A', sort_order: 0 })
        const b = await createTag(category, { name: 'B', sort_order: 1 })
        const elsewhere = await createTag(other, { name: 'C' })
        const reordered = valueOf(
          await adapter().commands.tags.reorder({
            items: [
              { id: b.id, expected_version: 1 },
              { id: a.id, expected_version: 1 },
            ],
          }),
        )
        expect(reordered.map((tag) => [tag.name, tag.sort_order])).toEqual([
          ['B', 0],
          ['A', 1],
        ])
        const mixed = await adapter().commands.tags.reorder({
          items: [
            { id: a.id, expected_version: 2 },
            { id: elsewhere.id, expected_version: 1 },
          ],
        })
        expect(issuesOf(mixed)).toEqual([{ path: ['items'], code: 'invalid_order' }])
      })

      it('refuses switching to single while a soldier holds two of its tags', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const driver = await createTag(category, { name: 'Driver' })
        const soldier = await newSoldier()
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id: null, tag_ids: [medic.id, driver.id] }))
        const change = { id: category.id, expected_version: 1, changes: { selection_mode: 'single' as const } }
        expect(issuesOf(await adapter().commands.tag_categories.update(change))).toEqual([
          { path: ['changes', 'selection_mode'], code: 'tag_single_selection' },
        ])
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 2, deployment_id: null, tag_ids: [medic.id] }))
        expect(valueOf(await adapter().commands.tag_categories.update(change)).selection_mode).toBe('single')
      })

      it('lets any scope read them and only the organization write them (D-053)', async () => {
        const category = await createCategory()
        const unit = await newUnit('Company')
        const { identity } = await seedActor(
          harnessOf(),
          organization,
          [VIEW_TAGS, CREATE_TAGS],
          { anchor_type: 'unit', anchor_unit_id: unit.id, include_descendants: true },
          unit.id,
        )
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.tag_categories.list({ include_archived: false })).map((row) => row.id)).toEqual([
          category.id,
        ])
        expect(errorOf(await adapter().commands.tags.create(tagInput(category))).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.tag_categories.create(categoryInput())).code).toBe('forbidden')
      })
    })

    describe("a soldier's tags (setTags)", () => {
      it('replaces the set, bumps the soldier and tells the feed', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const driver = await createTag(category, { name: 'Driver' })
        const soldier = await newSoldier()
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const rows = valueOf(
          await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id: null, tag_ids: [medic.id, driver.id] }),
        )
        expect(rows.map((row) => row.tag_id)).toEqual([medic.id, driver.id])
        expect(rows[0]).toMatchObject({ soldier_id: soldier, organization_id: organization, created_at: NOW, created_by: ownerId })
        expect(new Set(await tagsOf(soldier))).toEqual(new Set([medic.id, driver.id]))
        const stored = valueOf(await adapter().repositories.soldiers.get(soldier))
        expect(stored).toMatchObject({ version: 2, updated_by: ownerId })
        expect((await heard).map((change) => change.table).sort()).toEqual(['soldier_tags', 'soldiers'])

        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 2, deployment_id: null, tag_ids: [driver.id] }))
        expect(await tagsOf(soldier)).toEqual([driver.id])
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 3, deployment_id: null, tag_ids: [] }))
        expect(await tagsOf(soldier)).toEqual([])
      })

      it('keeps a rotation set apart from the persistent one, each holding single on its own (D-221)', async () => {
        const category = await createCategory({ selection_mode: 'single' })
        const medic = await createTag(category)
        const driver = await createTag(category, { name: 'Driver' })
        const soldier = await newSoldier()
        const rotation = await seedRotation(harnessOf(), organization)
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id: null, tag_ids: [medic.id] }))
        const scoped = valueOf(
          await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 2, deployment_id: rotation, tag_ids: [driver.id] }),
        )
        expect(scoped.map((row) => [row.tag_id, row.deployment_id])).toEqual([[driver.id, rotation]])
        const rows = valueOf(await adapter().repositories.soldier_tags.list({ soldier_ids: [soldier] }))
        expect(new Set(rows.map((row) => `${row.tag_id}|${row.deployment_id ?? ''}`))).toEqual(
          new Set([`${medic.id}|`, `${driver.id}|${rotation}`]),
        )

        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 3, deployment_id: rotation, tag_ids: [] }))
        expect(await tagsOf(soldier)).toEqual([medic.id])
      })

      it('refuses a rotation that is unknown or closed (D-221)', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const soldier = await newSoldier()
        const set = (deployment_id: DeploymentId) =>
          adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id, tag_ids: [medic.id] })
        expect(issuesOf(await set(DeploymentId.parse(crypto.randomUUID())))).toEqual([{ path: ['deployment_id'], code: 'reference_not_found' }])
        const rotation = await seedRotation(harnessOf(), organization)
        valueOf(await adapter().commands.deployments.close({ id: rotation, expected_version: 1 }))
        expect(issuesOf(await set(rotation))).toEqual([{ path: ['deployment_id'], code: 'rotation_closed' }])
      })

      it('answers stale_version for an old version and writes nothing', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const soldier = await newSoldier()
        expect(
          errorOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 9, deployment_id: null, tag_ids: [medic.id] })).code,
        ).toBe('stale_version')
        expect(await harnessOf().rows('soldier_tags')).toEqual([])
      })

      it('checks the tags it adds: unknown, archived, and one of a single category', async () => {
        const marital = await createCategory({ name: 'Marital', selection_mode: 'single' })
        const single = await createTag(marital, { name: 'Single' })
        const married = await createTag(marital, { name: 'Married' })
        const skills = await createCategory({ name: 'Skills' })
        const old = await createTag(skills, { name: 'Old' })
        valueOf(await adapter().commands.tags.archive({ id: old.id, expected_version: 1 }))
        const soldier = await newSoldier()
        const set = (tag_ids: TagId[], expected_version = 1) => adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version, deployment_id: null, tag_ids })

        expect(issuesOf(await set([newTagId()]))).toEqual([{ path: ['tag_ids', 0], code: 'reference_not_found' }])
        expect(issuesOf(await set([single.id, old.id]))).toEqual([{ path: ['tag_ids', 1], code: 'reference_archived' }])
        expect(issuesOf(await set([single.id, married.id]))).toEqual([{ path: ['tag_ids', 1], code: 'tag_single_selection' }])
        expect(await harnessOf().rows('soldier_tags')).toEqual([])
      })

      it('keeps a held tag that was archived since (D-065)', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const driver = await createTag(category, { name: 'Driver' })
        const soldier = await newSoldier()
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id: null, tag_ids: [medic.id] }))
        valueOf(await adapter().commands.tags.archive({ id: medic.id, expected_version: 1 }))
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 2, deployment_id: null, tag_ids: [medic.id, driver.id] }))
        expect(new Set(await tagsOf(soldier))).toEqual(new Set([medic.id, driver.id]))
      })

      it('refuses an archived soldier', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const soldier = await newSoldier()
        valueOf(await adapter().commands.soldiers.archive({ id: soldier, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 2, deployment_id: null, tag_ids: [medic.id] }))).toEqual([
          { path: [], code: 'archived' },
        ])
      })

      it('needs soldiers:update over the soldier, and soldiers:view to read the tags (D-130)', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const company = await newUnit('Company')
        const platoonA = await newUnit('Platoon A', company.id)
        const platoonB = await newUnit('Platoon B', company.id)
        const mine = await newSoldier(platoonA.id)
        const theirs = await newSoldier(platoonB.id)
        valueOf(await adapter().commands.soldiers.setTags({ soldier_id: theirs, expected_version: 1, deployment_id: null, tag_ids: [medic.id] }))
        const scope = { anchor_type: 'unit', anchor_unit_id: platoonA.id, include_descendants: true } as const

        const viewer = await seedActor(harnessOf(), organization, [VIEW_SOLDIERS, VIEW_TAGS, VIEW_UNITS], scope, platoonA.id)
        harnessOf().signIn(viewer.identity)
        expect(errorOf(await adapter().commands.soldiers.setTags({ soldier_id: mine, expected_version: 1, deployment_id: null, tag_ids: [medic.id] })).code).toBe(
          'forbidden',
        )
        // A soldier the actor cannot see answers not_found, and their tags are not read (D-046).
        expect(
          errorOf(await adapter().commands.soldiers.setTags({ soldier_id: theirs, expected_version: 2, deployment_id: null, tag_ids: [] })).code,
        ).toBe('not_found')
        expect(valueOf(await adapter().repositories.soldier_tags.list({ soldier_ids: null }))).toEqual([])

        harnessOf().signIn(owner)
        const editor = await seedActor(harnessOf(), organization, [VIEW_SOLDIERS, UPDATE_SOLDIERS, VIEW_TAGS], scope, platoonA.id)
        harnessOf().signIn(editor.identity)
        expect(valueOf(await adapter().commands.soldiers.setTags({ soldier_id: mine, expected_version: 1, deployment_id: null, tag_ids: [medic.id] }))).toHaveLength(1)
        expect(await versionOf(mine)).toBe(2)
      })

      it('needs tags:view to add a tag', async () => {
        const category = await createCategory()
        const medic = await createTag(category)
        const soldier = await newSoldier()
        const blind = await seedActor(harnessOf(), organization, [VIEW_SOLDIERS, UPDATE_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(blind.identity)
        expect(issuesOf(await adapter().commands.soldiers.setTags({ soldier_id: soldier, expected_version: 1, deployment_id: null, tag_ids: [medic.id] }))).toEqual([
          { path: ['tag_ids', 0], code: 'reference_not_found' },
        ])
      })
    })
  })
}
