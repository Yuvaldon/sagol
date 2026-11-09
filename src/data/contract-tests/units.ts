import {
  AuthUserId,
  PropertyDefinitionId,
  SoldierId,
  UnitId,
  UnitLevelId,
  type AuthIdentity,
  type CreateUnitInput,
  type DataChange,
  type OrganizationId,
  type Permission,
  type PermissionCheck,
  type TableRow,
  type UnitLevel,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import {
  LATER_DATE,
  NOW,
  PAST_DATE,
  errorOf,
  issuesOf,
  placeSoldier,
  seedActor,
  valueOf,
  type ActorScopeColumns,
} from './support'

// The unit tree against the shared contract: levels, units, the `can` hint, and denial paths through
// seeded grants, long before the roles screen exists (D-076). Sample data, test files only.

const newUnitId = () => UnitId.parse(crypto.randomUUID())
const newLevelId = () => UnitLevelId.parse(crypto.randomUUID())

function unitInput(overrides: Partial<CreateUnitInput> = {}): CreateUnitInput {
  return {
    id: newUnitId(),
    parent_id: null,
    sort_order: 0,
    name: 'Unit',
    code: null,
    unit_level_id: null,
    kind: 'standing',
    valid_from: null,
    valid_to: null,
    color_key: null,
    properties: {},
    ...overrides,
  }
}

export function describeUnitContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  /** A second linked soldier holding `pairs` from one role, at the given scope. */
  const actorWith = (
    organization_id: OrganizationId,
    pairs: readonly Permission[],
    scope: ActorScopeColumns,
    home?: UnitId,
  ) => seedActor(harnessOf(), organization_id, pairs, scope, home)

  const place = (organization_id: OrganizationId, soldier_id: SoldierId, unit_id: UnitId, valid_to: string | null) =>
    placeSoldier(harnessOf(), organization_id, soldier_id, unit_id, valid_to)

  /** Company > Platoon A, Platoon B, created by the owner. */
  async function sampleTree() {
    const company = valueOf(await adapter().commands.units.create(unitInput({ name: 'Company' })))
    const platoonA = valueOf(
      await adapter().commands.units.create(unitInput({ name: 'Platoon A', parent_id: company.id, sort_order: 0 })),
    )
    const platoonB = valueOf(
      await adapter().commands.units.create(unitInput({ name: 'Platoon B', parent_id: company.id, sort_order: 1 })),
    )
    return { company, platoonA, platoonB }
  }

  const liveUnits = async () => valueOf(await adapter().repositories.units.list({ include_archived: false }))
  const namesUnder = async (parent: UnitId | null) =>
    (await liveUnits()).filter((unit) => unit.parent_id === parent).map((unit) => unit.name)

  describe('the can hint (D-091)', () => {
    const checks: PermissionCheck[] = [
      { permission: { resource: 'units', action: 'create' }, target: { kind: 'organization' } },
      { permission: { resource: 'unit_levels', action: 'update' }, target: { kind: 'organization' } },
    ]

    it('needs a linked session', async () => {
      harnessOf().signIn(null)
      expect(errorOf(await adapter().session.can(checks)).code).toBe('unauthenticated')
      harnessOf().signIn({
        auth_user_id: AuthUserId.parse(crypto.randomUUID()),
        provider: 'local',
        email: 'first@example.test',
        email_verified: true,
        display_name: null,
      })
      expect(errorOf(await adapter().session.can(checks)).code).toBe('account_not_linked')
    })

    it('answers each check in order, from the real policy', async () => {
      const { input } = await claim()
      expect(valueOf(await adapter().session.can(checks))).toEqual([true, true])
      const { identity } = await actorWith(
        input.organization.id,
        [{ resource: 'units', action: 'create' }],
        { anchor_type: 'organization' },
      )
      harnessOf().signIn(identity)
      expect(valueOf(await adapter().session.can(checks))).toEqual([true, false])
    })

    it('refuses a target the resource does not accept, and a pair outside D-040', async () => {
      await claim()
      const soldier = SoldierId.parse(crypto.randomUUID())
      expect(
        valueOf(
          await adapter().session.can([
            { permission: { resource: 'units', action: 'view' }, target: { kind: 'soldier', soldier_id: soldier } },
          ]),
        ),
      ).toEqual([false])
      const bad = [{ permission: { resource: 'units', action: 'approve' }, target: { kind: 'organization' } }]
      expect(errorOf(await adapter().session.can(bad as PermissionCheck[])).code).toBe('validation_failed')
    })
  })

  describe('unit levels', () => {
    beforeEach(async () => {
      await claim()
    })

    const levelInput = (name: string, sort_order = 0) => ({ id: newLevelId(), name, sort_order })
    const createLevel = async (name: string, sort_order = 0): Promise<UnitLevel> =>
      valueOf(await adapter().commands.unit_levels.create(levelInput(name, sort_order)))

    it('creates a level with audit columns from the session and the time source', async () => {
      const level = await createLevel('Company')
      expect(level).toMatchObject({ name: 'Company', version: 1, archived_at: null, created_at: NOW })
      expect(level.created_by).not.toBeNull()
      expect(valueOf(await adapter().repositories.unit_levels.get(level.id))).toEqual(level)
    })

    it('rejects an unknown field, a blank name and a taken id (D-044, D-045, D-068)', async () => {
      const taken = await createLevel('Company')
      const unknown = { ...levelInput('X'), organization_id: taken.organization_id }
      expect(issuesOf(await adapter().commands.unit_levels.create(unknown))).toEqual([
        { path: ['organization_id'], code: 'unknown_field' },
      ])
      expect(issuesOf(await adapter().commands.unit_levels.create(levelInput('   ')))).toEqual([
        { path: ['name'], code: 'required' },
      ])
      const again = { id: taken.id, name: 'Again', sort_order: 1 }
      expect(issuesOf(await adapter().commands.unit_levels.create(again))).toEqual([
        { path: ['id'], code: 'already_exists' },
      ])
    })

    it('updates with the expected version, and refuses a stale one (D-045)', async () => {
      const level = await createLevel('Company')
      const renamed = valueOf(
        await adapter().commands.unit_levels.update({ id: level.id, expected_version: 1, changes: { name: 'Plugah' } }),
      )
      expect(renamed).toMatchObject({ name: 'Plugah', version: 2, updated_at: NOW })
      const stale = await adapter().commands.unit_levels.update({
        id: level.id,
        expected_version: 1,
        changes: { name: 'Lost' },
      })
      expect(errorOf(stale).code).toBe('stale_version')
      expect(valueOf(await adapter().repositories.unit_levels.get(level.id)).name).toBe('Plugah')
    })

    it('nests update field codes under changes, and refuses an empty update', async () => {
      const level = await createLevel('Company')
      const blank = await adapter().commands.unit_levels.update({
        id: level.id,
        expected_version: 1,
        changes: { name: ' ' },
      })
      expect(issuesOf(blank)).toEqual([{ path: ['changes', 'name'], code: 'required' }])
      const empty = await adapter().commands.unit_levels.update({ id: level.id, expected_version: 1, changes: {} })
      expect(issuesOf(empty)).toEqual([{ path: ['changes'], code: 'no_changes' }])
    })

    it('answers not_found for a missing row', async () => {
      const id = newLevelId()
      expect(errorOf(await adapter().repositories.unit_levels.get(id)).code).toBe('not_found')
      const update = await adapter().commands.unit_levels.update({ id, expected_version: 1, changes: { name: 'X' } })
      expect(errorOf(update).code).toBe('not_found')
    })

    it('archives a level: lists hide it, it stays readable, and it cannot change (D-017)', async () => {
      const level = await createLevel('Company')
      const archived = valueOf(await adapter().commands.unit_levels.archive({ id: level.id, expected_version: 1 }))
      expect(archived).toMatchObject({ archived_at: NOW, version: 2 })
      expect(valueOf(await adapter().repositories.unit_levels.list({ include_archived: false }))).toEqual([])
      expect(valueOf(await adapter().repositories.unit_levels.list({ include_archived: true }))).toEqual([archived])
      const again = await adapter().commands.unit_levels.archive({ id: level.id, expected_version: 2 })
      expect(issuesOf(again)).toEqual([{ path: [], code: 'archived' }])
    })

    it('allows archiving a level in use, and the unit keeps it (D-088)', async () => {
      const level = await createLevel('Company')
      const unit = valueOf(await adapter().commands.units.create(unitInput({ unit_level_id: level.id })))
      valueOf(await adapter().commands.unit_levels.archive({ id: level.id, expected_version: 1 }))
      const renamed = await adapter().commands.units.update({
        id: unit.id,
        expected_version: 1,
        changes: { name: 'Renamed' },
      })
      expect(valueOf(renamed)).toMatchObject({ name: 'Renamed', unit_level_id: level.id })
    })

    it('reorders: position sets sort_order, and an unmoved row keeps its version', async () => {
      const a = await createLevel('A', 0)
      const b = await createLevel('B', 1)
      const c = await createLevel('C', 2)
      const result = valueOf(
        await adapter().commands.unit_levels.reorder({
          items: [
            { id: a.id, expected_version: 1 },
            { id: c.id, expected_version: 1 },
            { id: b.id, expected_version: 1 },
          ],
        }),
      )
      expect(result.map((row) => [row.name, row.sort_order, row.version])).toEqual([
        ['A', 0, 1],
        ['C', 1, 2],
        ['B', 2, 2],
      ])
      const listed = valueOf(await adapter().repositories.unit_levels.list({ include_archived: false }))
      expect(listed.map((row) => row.name)).toEqual(['A', 'C', 'B'])
    })

    it('refuses a partial list, and a stale row (D-045)', async () => {
      const a = await createLevel('A', 0)
      const b = await createLevel('B', 1)
      const partial = await adapter().commands.unit_levels.reorder({ items: [{ id: a.id, expected_version: 1 }] })
      expect(issuesOf(partial)).toEqual([{ path: ['items'], code: 'invalid_order' }])
      const stale = await adapter().commands.unit_levels.reorder({
        items: [
          { id: b.id, expected_version: 9 },
          { id: a.id, expected_version: 1 },
        ],
      })
      expect(errorOf(stale).code).toBe('stale_version')
    })

    it('publishes the changed rows on the feed', async () => {
      const level = await createLevel('Company')
      const seen = new Promise<readonly DataChange[]>((resolve) => {
        const stop = adapter().changes.subscribe((changes) => {
          stop()
          resolve(changes)
        })
      })
      valueOf(await adapter().commands.unit_levels.update({ id: level.id, expected_version: 1, changes: { name: 'X' } }))
      expect(await seen).toEqual([{ table: 'unit_levels', ids: [level.id] }])
    })
  })

  describe('units', () => {
    beforeEach(async () => {
      await claim()
    })

    describe('create', () => {
      it('creates a top-level unit and a child, and lists them in order', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        expect(company).toMatchObject({ name: 'Company', parent_id: null, version: 1, created_at: NOW })
        expect(platoonA.parent_id).toBe(company.id)
        expect(await namesUnder(company.id)).toEqual(['Platoon A', 'Platoon B'])
        expect(valueOf(await adapter().repositories.units.get(platoonB.id))).toEqual(platoonB)
      })

      it('checks the color against the closed palette (D-074, OI-011)', async () => {
        expect(valueOf(await adapter().commands.units.create(unitInput({ color_key: 'teal' }))).color_key).toBe('teal')
        expect(issuesOf(await adapter().commands.units.create(unitInput({ color_key: 'magenta' })))).toEqual([
          { path: ['color_key'], code: 'invalid_value' },
        ])
      })

      it('checks the references of a new row', async () => {
        const missingLevel = await adapter().commands.units.create(unitInput({ unit_level_id: newLevelId() }))
        expect(issuesOf(missingLevel)).toEqual([{ path: ['unit_level_id'], code: 'reference_not_found' }])
        const missingParent = await adapter().commands.units.create(unitInput({ parent_id: newUnitId() }))
        expect(issuesOf(missingParent)).toEqual([{ path: ['parent_id'], code: 'reference_not_found' }])

        const parent = valueOf(await adapter().commands.units.create(unitInput()))
        valueOf(await adapter().commands.units.archive({ id: parent.id, expected_version: 1 }))
        const archivedParent = await adapter().commands.units.create(unitInput({ parent_id: parent.id }))
        expect(issuesOf(archivedParent)).toEqual([{ path: ['parent_id'], code: 'reference_archived' }])

        const level = valueOf(await adapter().commands.unit_levels.create({ id: newLevelId(), name: 'L', sort_order: 0 }))
        valueOf(await adapter().commands.unit_levels.archive({ id: level.id, expected_version: 1 }))
        const archivedLevel = await adapter().commands.units.create(unitInput({ unit_level_id: level.id }))
        expect(issuesOf(archivedLevel)).toEqual([{ path: ['unit_level_id'], code: 'reference_archived' }])
      })

      it('keeps a code unique in the organization, archived units included', async () => {
        const first = valueOf(await adapter().commands.units.create(unitInput({ code: 'A1' })))
        expect(issuesOf(await adapter().commands.units.create(unitInput({ code: 'A1' })))).toEqual([
          { path: ['code'], code: 'already_exists' },
        ])
        valueOf(await adapter().commands.units.archive({ id: first.id, expected_version: 1 }))
        expect(issuesOf(await adapter().commands.units.create(unitInput({ code: 'A1' })))).toEqual([
          { path: ['code'], code: 'already_exists' },
        ])
        expect(valueOf(await adapter().commands.units.create(unitInput({ code: null }))).code).toBeNull()
        expect(valueOf(await adapter().commands.units.create(unitInput({ code: null }))).code).toBeNull()
      })

      it('checks custom property values (D-065, OI-023 b)', async () => {
        const definition = PropertyDefinitionId.parse(crypto.randomUUID())
        const unknown = await adapter().commands.units.create(unitInput({ properties: { [definition]: 'x' } }))
        expect(issuesOf(unknown)).toEqual([{ path: ['properties', definition], code: 'property_unknown' }])

        const unit = await seededDefinition(definition)
        expect(valueOf(unit).properties).toEqual({ [definition]: 'x' })
        const empty = await adapter().commands.units.create(unitInput())
        expect(issuesOf(empty)).toEqual([{ path: ['properties', definition], code: 'property_required' }])
      })

      async function seededDefinition(id: ReturnType<typeof PropertyDefinitionId.parse>) {
        const [organization] = await harnessOf().rows('organizations')
        if (organization === undefined) throw new Error('no organization')
        const row: TableRow<'property_definitions'> = {
          id,
          organization_id: organization.id,
          entity_type: 'unit',
          label: 'Note',
          data_type: 'text',
          options: [],
          is_required: true,
          sort_order: 0,
          created_at: NOW,
          created_by: null,
          updated_at: NOW,
          updated_by: null,
          version: 1,
          archived_at: null,
        }
        await harnessOf().seed('property_definitions', [row])
        return adapter().commands.units.create(unitInput({ properties: { [id]: 'x' } }))
      }
    })

    describe('update', () => {
      it('renames, and leaves parent_id to move: it is not an updatable field (D-045)', async () => {
        const { platoonA } = await sampleTree()
        const renamed = await adapter().commands.units.update({
          id: platoonA.id,
          expected_version: 1,
          changes: { name: 'Alpha', color_key: 'blue' },
        })
        expect(valueOf(renamed)).toMatchObject({ name: 'Alpha', color_key: 'blue', version: 2, parent_id: platoonA.parent_id })
        const reparent = await adapter().commands.units.update({
          id: platoonA.id,
          expected_version: 2,
          changes: { name: 'Beta', parent_id: null } as never,
        })
        expect(issuesOf(reparent)).toEqual([{ path: ['changes', 'parent_id'], code: 'unknown_field' }])
      })

      it('parses the merged row: dates are compared with what is stored (D-045)', async () => {
        const unit = valueOf(await adapter().commands.units.create(unitInput({ valid_from: LATER_DATE })))
        const result = await adapter().commands.units.update({
          id: unit.id,
          expected_version: 1,
          changes: { valid_to: PAST_DATE },
        })
        expect(issuesOf(result)).toEqual([{ path: ['changes', 'valid_to'], code: 'range_inverted' }])
      })

      it('nests row checks under changes (D-065)', async () => {
        const unit = valueOf(await adapter().commands.units.create(unitInput()))
        const result = await adapter().commands.units.update({
          id: unit.id,
          expected_version: 1,
          changes: { color_key: 'magenta', unit_level_id: newLevelId() },
        })
        expect(issuesOf(result)).toEqual([
          { path: ['changes', 'color_key'], code: 'invalid_value' },
          { path: ['changes', 'unit_level_id'], code: 'reference_not_found' },
        ])
      })

      it('allows a unit to keep its own code', async () => {
        const unit = valueOf(await adapter().commands.units.create(unitInput({ code: 'A1' })))
        const result = await adapter().commands.units.update({
          id: unit.id,
          expected_version: 1,
          changes: { code: 'A1', name: 'Same code' },
        })
        expect(valueOf(result).name).toBe('Same code')
      })

      it('refuses a change to an archived unit before comparing versions', async () => {
        const unit = valueOf(await adapter().commands.units.create(unitInput()))
        valueOf(await adapter().commands.units.archive({ id: unit.id, expected_version: 1 }))
        const result = await adapter().commands.units.update({
          id: unit.id,
          expected_version: 1,
          changes: { name: 'X' },
        })
        expect(issuesOf(result)).toEqual([{ path: [], code: 'archived' }])
      })
    })

    describe('move', () => {
      it('re-parents a unit, and it lands after its new siblings (D-087)', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const squad = valueOf(
          await adapter().commands.units.create(unitInput({ name: 'Squad', parent_id: platoonA.id })),
        )
        const moved = valueOf(
          await adapter().commands.units.move({ id: squad.id, expected_version: 1, parent_id: company.id }),
        )
        expect(moved).toMatchObject({ parent_id: company.id, sort_order: platoonB.sort_order + 1, version: 2 })
        expect(await namesUnder(company.id)).toEqual(['Platoon A', 'Platoon B', 'Squad'])
      })

      it('moves to the top level, and into a parent with no children', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const top = valueOf(await adapter().commands.units.move({ id: platoonA.id, expected_version: 1, parent_id: null }))
        expect(top).toMatchObject({ parent_id: null, sort_order: company.sort_order + 1 })
        const inside = valueOf(
          await adapter().commands.units.move({ id: platoonB.id, expected_version: 1, parent_id: platoonA.id }),
        )
        expect(inside).toMatchObject({ parent_id: platoonA.id, sort_order: 0 })
      })

      it('refuses a cycle: the unit itself or a descendant (D-009, OI-021 c)', async () => {
        const { company, platoonA } = await sampleTree()
        const self = await adapter().commands.units.move({ id: company.id, expected_version: 1, parent_id: company.id })
        expect(issuesOf(self)).toEqual([{ path: ['parent_id'], code: 'unit_cycle' }])
        const descendant = await adapter().commands.units.move({
          id: company.id,
          expected_version: 1,
          parent_id: platoonA.id,
        })
        expect(issuesOf(descendant)).toEqual([{ path: ['parent_id'], code: 'unit_cycle' }])
        expect(valueOf(await adapter().repositories.units.get(company.id)).version).toBe(1)
      })

      it('refuses the parent it already has, a missing parent and an archived one', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const same = await adapter().commands.units.move({
          id: platoonA.id,
          expected_version: 1,
          parent_id: company.id,
        })
        expect(issuesOf(same)).toEqual([{ path: ['parent_id'], code: 'no_changes' }])
        const missing = await adapter().commands.units.move({
          id: platoonA.id,
          expected_version: 1,
          parent_id: newUnitId(),
        })
        expect(issuesOf(missing)).toEqual([{ path: ['parent_id'], code: 'reference_not_found' }])
        valueOf(await adapter().commands.units.archive({ id: platoonB.id, expected_version: 1 }))
        const archived = await adapter().commands.units.move({
          id: platoonA.id,
          expected_version: 1,
          parent_id: platoonB.id,
        })
        expect(issuesOf(archived)).toEqual([{ path: ['parent_id'], code: 'reference_archived' }])
      })

      it('refuses a stale version', async () => {
        const { platoonA } = await sampleTree()
        const result = await adapter().commands.units.move({ id: platoonA.id, expected_version: 7, parent_id: null })
        expect(errorOf(result).code).toBe('stale_version')
      })
    })

    describe('reorder', () => {
      it('orders the children of one parent', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        valueOf(
          await adapter().commands.units.reorder({
            items: [
              { id: platoonB.id, expected_version: 1 },
              { id: platoonA.id, expected_version: 1 },
            ],
          }),
        )
        expect(await namesUnder(company.id)).toEqual(['Platoon B', 'Platoon A'])
      })

      it('refuses rows of two parents, and a list without every sibling (D-045)', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const mixed = await adapter().commands.units.reorder({
          items: [
            { id: company.id, expected_version: 1 },
            { id: platoonA.id, expected_version: 1 },
          ],
        })
        expect(issuesOf(mixed)).toEqual([{ path: ['items'], code: 'invalid_order' }])
        const partial = await adapter().commands.units.reorder({ items: [{ id: platoonB.id, expected_version: 1 }] })
        expect(issuesOf(partial)).toEqual([{ path: ['items'], code: 'invalid_order' }])
      })

      it('leaves archived siblings out of the list', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))
        const result = await adapter().commands.units.reorder({ items: [{ id: platoonB.id, expected_version: 1 }] })
        expect(valueOf(result)).toMatchObject([{ id: platoonB.id, sort_order: 0 }])
        expect(await namesUnder(company.id)).toEqual(['Platoon B'])
      })
    })

    describe('archive (D-088)', () => {
      async function organizationAndOwner() {
        const [organization] = await harnessOf().rows('organizations')
        const [owner] = await harnessOf().rows('soldiers')
        if (organization === undefined || owner === undefined) throw new Error('no claim')
        return { organizationId: organization.id, owner }
      }

      it('archives an empty unit, and hides it from lists', async () => {
        const { platoonA } = await sampleTree()
        const archived = valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))
        expect(archived).toMatchObject({ archived_at: NOW, version: 2 })
        expect((await liveUnits()).map((unit) => unit.id)).not.toContain(platoonA.id)
        const all = valueOf(await adapter().repositories.units.list({ include_archived: true }))
        expect(all.map((unit) => unit.id)).toContain(platoonA.id)
      })

      it('refuses a unit with a live sub-unit, until it has none', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const refused = await adapter().commands.units.archive({ id: company.id, expected_version: 1 })
        expect(issuesOf(refused)).toEqual([{ path: [], code: 'unit_not_empty' }])
        valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))
        valueOf(await adapter().commands.units.archive({ id: platoonB.id, expected_version: 1 }))
        expect(valueOf(await adapter().commands.units.archive({ id: company.id, expected_version: 1 })).archived_at).toBe(NOW)
      })

      it('refuses a unit with a soldier placed today or later', async () => {
        const { platoonA, platoonB } = await sampleTree()
        const { organizationId, owner } = await organizationAndOwner()
        await place(organizationId, owner.id, platoonA.id, null)
        await place(organizationId, owner.id, platoonB.id, LATER_DATE)
        for (const unit of [platoonA, platoonB]) {
          const refused = await adapter().commands.units.archive({ id: unit.id, expected_version: 1 })
          expect(issuesOf(refused)).toEqual([{ path: [], code: 'unit_not_empty' }])
        }
      })

      it('ignores a placement that ended, and one of an archived soldier', async () => {
        const { platoonA, platoonB } = await sampleTree()
        const { organizationId, owner } = await organizationAndOwner()
        await place(organizationId, owner.id, platoonA.id, PAST_DATE)
        valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))

        const gone = SoldierId.parse(crypto.randomUUID())
        await harnessOf().seed('soldiers', [{ ...owner, id: gone, archived_at: NOW }])
        await place(organizationId, gone, platoonB.id, null)
        valueOf(await adapter().commands.units.archive({ id: platoonB.id, expected_version: 1 }))
      })
    })

    describe('denial paths, before their screens exist (D-076, D-089)', () => {
      const VIEW: Permission = { resource: 'units', action: 'view' }
      const CREATE: Permission = { resource: 'units', action: 'create' }
      const UPDATE: Permission = { resource: 'units', action: 'update' }
      const DELETE: Permission = { resource: 'units', action: 'delete' }

      async function organizationId() {
        const [organization] = await harnessOf().rows('organizations')
        if (organization === undefined) throw new Error('no claim')
        return organization.id
      }

      it('shows nothing, and answers not_found, to a soldier with no permission (D-046)', async () => {
        const { company, platoonA } = await sampleTree()
        const { identity } = await actorWith(await organizationId(), [], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.units.list({ include_archived: true }))).toEqual([])
        expect(errorOf(await adapter().repositories.units.get(platoonA.id)).code).toBe('not_found')
        const update = await adapter().commands.units.update({
          id: company.id,
          expected_version: 1,
          changes: { name: 'X' },
        })
        expect(errorOf(update).code).toBe('not_found')
        expect(errorOf(await adapter().commands.units.archive({ id: company.id, expected_version: 1 })).code).toBe('not_found')
      })

      it('answers forbidden to a soldier who sees the row but may not change it', async () => {
        const { company } = await sampleTree()
        const { identity } = await actorWith(await organizationId(), [VIEW], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.units.create(unitInput())).code).toBe('forbidden')
        const update = await adapter().commands.units.update({
          id: company.id,
          expected_version: 1,
          changes: { name: 'X' },
        })
        expect(errorOf(update).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.units.archive({ id: company.id, expected_version: 1 })).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.units.move({ id: company.id, expected_version: 1, parent_id: null })).code).toBe(
          'forbidden',
        )
      })

      it('checks permission before state: no write permission, no answer about a code (D-090)', async () => {
        valueOf(await adapter().commands.units.create(unitInput({ code: 'A1' })))
        const { identity } = await actorWith(await organizationId(), [VIEW], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.units.create(unitInput({ code: 'A1' }))).code).toBe('forbidden')
      })

      it('holds a unit commander to their subtree (D-053)', async () => {
        const { company, platoonA, platoonB } = await sampleTree()
        const squad = valueOf(
          await adapter().commands.units.create(unitInput({ name: 'Squad', parent_id: platoonA.id })),
        )
        const other = valueOf(
          await adapter().commands.units.create(unitInput({ name: 'Other squad', parent_id: platoonB.id })),
        )
        const { identity } = await actorWith(
          await organizationId(),
          [VIEW, CREATE, UPDATE, DELETE],
          { anchor_type: 'unit', anchor_unit_id: platoonA.id, include_descendants: true },
        )
        harnessOf().signIn(identity)

        // A top-level unit shows to any non-empty scope, and siblings of the anchor do not.
        const visible = (await liveUnits()).map((unit) => unit.name).sort()
        expect(visible).toEqual(['Company', 'Platoon A', 'Squad'])
        expect(errorOf(await adapter().repositories.units.get(other.id)).code).toBe('not_found')

        // Creating inside the subtree works, and outside it does not.
        valueOf(await adapter().commands.units.create(unitInput({ name: 'New', parent_id: platoonA.id })))
        expect(errorOf(await adapter().commands.units.create(unitInput({ parent_id: platoonB.id }))).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.units.create(unitInput())).code).toBe('forbidden')

        // A top-level unit changes only with organization scope.
        const topLevel = await adapter().commands.units.update({
          id: company.id,
          expected_version: 1,
          changes: { name: 'X' },
        })
        expect(errorOf(topLevel).code).toBe('forbidden')

        // Moving needs permission on the destination too.
        const out = await adapter().commands.units.move({ id: squad.id, expected_version: 1, parent_id: platoonB.id })
        expect(errorOf(out).code).toBe('forbidden')
        const toTop = await adapter().commands.units.move({ id: squad.id, expected_version: 1, parent_id: null })
        expect(errorOf(toTop).code).toBe('forbidden')

        // The destination's permission comes before the row's state (D-090, OI-051).
        const staleOut = await adapter().commands.units.move({ id: squad.id, expected_version: 9, parent_id: platoonB.id })
        expect(errorOf(staleOut).code).toBe('forbidden')
        const sameParent = await adapter().commands.units.move({ id: squad.id, expected_version: 1, parent_id: platoonA.id })
        expect(issuesOf(sameParent)).toEqual([{ path: ['parent_id'], code: 'no_changes' }])
      })

      it('refuses a reorder when any sibling is out of reach, and does not reveal it (D-089)', async () => {
        const { platoonA, platoonB } = await sampleTree()
        const { identity } = await actorWith(
          await organizationId(),
          [VIEW, UPDATE],
          { anchor_type: 'unit', anchor_unit_id: platoonA.id },
        )
        harnessOf().signIn(identity)
        const listedOwn = await adapter().commands.units.reorder({ items: [{ id: platoonA.id, expected_version: 1 }] })
        expect(errorOf(listedOwn).code).toBe('forbidden')
        const listedOther = await adapter().commands.units.reorder({ items: [{ id: platoonB.id, expected_version: 1 }] })
        expect(errorOf(listedOther).code).toBe('not_found')
      })

      it('needs unit_levels:view to point at a level (D-046)', async () => {
        const level = valueOf(await adapter().commands.unit_levels.create({ id: newLevelId(), name: 'L', sort_order: 0 }))
        const { identity } = await actorWith(await organizationId(), [VIEW, CREATE], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        const result = await adapter().commands.units.create(unitInput({ unit_level_id: level.id }))
        expect(issuesOf(result)).toEqual([{ path: ['unit_level_id'], code: 'reference_not_found' }])
      })

      it('keeps levels behind their own permissions, at organization scope only (D-053)', async () => {
        const level = valueOf(await adapter().commands.unit_levels.create({ id: newLevelId(), name: 'L', sort_order: 0 }))
        const { platoonA } = await sampleTree()
        const pairs: Permission[] = [
          { resource: 'unit_levels', action: 'view' },
          { resource: 'unit_levels', action: 'update' },
        ]
        const { identity } = await actorWith(await organizationId(), pairs, {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
        })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.unit_levels.get(level.id)).name).toBe('L')
        const update = await adapter().commands.unit_levels.update({
          id: level.id,
          expected_version: 1,
          changes: { name: 'X' },
        })
        expect(errorOf(update).code).toBe('forbidden')
      })
    })
  })
}

