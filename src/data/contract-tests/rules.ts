import {
  AvailabilityRuleId,
  DeploymentId,
  SoldierId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitLevelId,
  type AuthIdentity,
  type AvailabilityRule,
  type CreateAvailabilityRuleInput,
  type FilterExpression,
  type OrganizationId,
  type Permission,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { errorOf, issuesOf, seedActor, valueOf } from './support'

// Availability rules against the shared contract (D-014, D-031, D-139): reads by target, the order of checks, references,
// the population filter (OI-071), and denial paths through seeded grants (D-076). Sample data, test files only.

const VIEW_RULES: Permission = { resource: 'availability_rules', action: 'view' }
const CREATE_RULES: Permission = { resource: 'availability_rules', action: 'create' }
const UPDATE_RULES: Permission = { resource: 'availability_rules', action: 'update' }
const DELETE_RULES: Permission = { resource: 'availability_rules', action: 'delete' }
const VIEW_UNITS: Permission = { resource: 'units', action: 'view' }

function ruleInput(overrides: Partial<CreateAvailabilityRuleInput> = {}): CreateAvailabilityRuleInput {
  return {
    id: AvailabilityRuleId.parse(crypto.randomUUID()),
    name: 'Two medics',
    description: null,
    is_enabled: true,
    priority: 0,
    enforcement: 'soft',
    scope_unit_id: null,
    scope_mode: 'unit_tree',
    scope_level_id: null,
    population_filter: {},
    group_by: 'none',
    group_tag_category_id: null,
    metric: 'count',
    min_value: 2,
    max_value: null,
    effective_from: null,
    effective_to: null,
    deployment_id: null,
    count_pending_as_unavailable: false,
    ...overrides,
  }
}

export function describeRuleContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter
  const rules = () => adapter().commands.availability_rules

  describe('availability rules', () => {
    let organization: OrganizationId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      owner = claimed.owner
    })

    const create = async (overrides: Partial<CreateAvailabilityRuleInput> = {}) => valueOf(await rules().create(ruleInput(overrides)))
    const listed = async (include_archived = false) =>
      valueOf(await adapter().repositories.availability_rules.list({ include_archived })).map((rule) => rule.name)

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

    /** A second soldier holding exactly `pairs`, anchored at a unit and below, or over the organization. */
    async function actorWith(pairs: readonly Permission[], unitId: UnitId | null) {
      harnessOf().signIn(owner)
      const scope = unitId === null ? { anchor_type: 'organization' as const } : { anchor_type: 'unit' as const, anchor_unit_id: unitId, include_descendants: true }
      const actor = await seedActor(harnessOf(), organization, pairs, scope)
      harnessOf().signIn(actor.identity)
      return actor
    }

    it('creates, lists by priority then name, updates and archives a rule', async () => {
      const company = await newUnit('Company')
      await create({ name: 'B rule' })
      const first = await create({ name: 'A rule', scope_unit_id: company.id, description: '  ' })
      await create({ name: 'Urgent', priority: 5 })
      expect(first).toMatchObject({ organization_id: organization, description: null, version: 1 })
      expect(await listed()).toEqual(['Urgent', 'A rule', 'B rule'])

      const updated = valueOf(await rules().update({ id: first.id, expected_version: 1, changes: { min_value: 3, enforcement: 'hard' } }))
      expect(updated).toMatchObject({ min_value: 3, enforcement: 'hard', version: 2 })
      expect(errorOf(await rules().update({ id: first.id, expected_version: 1, changes: { min_value: 4 } })).code).toBe('stale_version')

      valueOf(await rules().archive({ id: first.id, expected_version: 2 }))
      expect(await listed()).toEqual(['Urgent', 'B rule'])
      expect(await listed(true)).toEqual(['Urgent', 'A rule', 'B rule'])
      const again = await rules().update({ id: first.id, expected_version: 3, changes: { min_value: 1 } })
      expect(issuesOf(again)).toEqual([{ path: [], code: 'archived' }])
    })

    it('checks the row the way schema.sql does', async () => {
      const inverted = await rules().create(ruleInput({ min_value: 3, max_value: 2 }))
      expect(issuesOf(inverted)).toEqual([{ path: ['max_value'], code: 'rule_threshold_inverted' }])
      const levelless = await rules().create(ruleInput({ scope_mode: 'each_descendant_at_level' }))
      expect(issuesOf(levelless)).toEqual([{ path: ['scope_level_id'], code: 'rule_scope_level_mismatch' }])
      const rule = await create()
      const merged = await rules().update({ id: rule.id, expected_version: 1, changes: { min_value: null } })
      expect(issuesOf(merged)).toEqual([{ path: ['changes', 'min_value'], code: 'rule_threshold_missing' }])
    })

    it('needs live references: the scope unit, the level, the category and a deployment', async () => {
      const gone = await newUnit('Gone')
      valueOf(await adapter().commands.units.archive({ id: gone.id, expected_version: 1 }))
      expect(issuesOf(await rules().create(ruleInput({ scope_unit_id: gone.id })))).toEqual([
        { path: ['scope_unit_id'], code: 'reference_archived' },
      ])
      expect(issuesOf(await rules().create(ruleInput({ scope_unit_id: UnitId.parse(crypto.randomUUID()) })))).toEqual([
        { path: ['scope_unit_id'], code: 'reference_not_found' },
      ])
      const level = await rules().create(
        ruleInput({ scope_mode: 'each_descendant_at_level', scope_level_id: UnitLevelId.parse(crypto.randomUUID()) }),
      )
      expect(issuesOf(level)).toEqual([{ path: ['scope_level_id'], code: 'reference_not_found' }])
      const category = await rules().create(
        ruleInput({ group_by: 'tag', group_tag_category_id: TagCategoryId.parse(crypto.randomUUID()) }),
      )
      expect(issuesOf(category)).toEqual([{ path: ['group_tag_category_id'], code: 'reference_not_found' }])
      // No deployment can exist before V15.
      const deployment = await rules().create(ruleInput({ deployment_id: DeploymentId.parse(crypto.randomUUID()) }))
      expect(issuesOf(deployment)).toEqual([{ path: ['deployment_id'], code: 'reference_not_found' }])
      expect(await harnessOf().rows('availability_rules')).toEqual([])
    })

    it('checks the population filter and the rows it names (OI-071)', async () => {
      const category = valueOf(
        await adapter().commands.tag_categories.create({
          id: TagCategoryId.parse(crypto.randomUUID()),
          name: 'Role',
          selection_mode: 'multiple',
          color_key: 'teal',
          sort_order: 0,
        }),
      )
      const medic = valueOf(
        await adapter().commands.tags.create({ id: TagId.parse(crypto.randomUUID()), category_id: category.id, name: 'Medic', color_key: null, sort_order: 0 }),
      )
      const medics: FilterExpression = { where: { kind: 'tag', match: 'any', tag_ids: [medic.id] } }
      expect((await create({ population_filter: medics, group_by: 'tag' })).population_filter).toEqual(medics)

      const unknown: FilterExpression = { where: { kind: 'tag', match: 'any', tag_ids: [TagId.parse(crypto.randomUUID())] } }
      expect(issuesOf(await rules().create(ruleInput({ population_filter: unknown })))).toEqual([
        { path: ['population_filter'], code: 'reference_not_found' },
      ])

      // A tag archived later stays in the filter, which never breaks (D-017).
      const rule = await create({ population_filter: medics })
      valueOf(await adapter().commands.tags.archive({ id: medic.id, expected_version: 1 }))
      valueOf(await rules().update({ id: rule.id, expected_version: 1, changes: { name: 'Medics' } }))
    })

    describe('who may (D-053, D-139)', () => {
      it('reads a rule with view over its target, and a global rule from any scope', async () => {
        const platoonA = await newUnit('A')
        const platoonB = await newUnit('B')
        const global = await create({ name: 'Global' })
        const ofA = await create({ name: 'Of A', scope_unit_id: platoonA.id })
        const ofB = await create({ name: 'Of B', scope_unit_id: platoonB.id })
        await actorWith([VIEW_RULES], platoonA.id)
        expect(await listed()).toEqual(['Global', 'Of A'])
        expect(valueOf(await adapter().repositories.availability_rules.get(global.id)).id).toBe(global.id)
        expect(valueOf(await adapter().repositories.availability_rules.get(ofA.id)).id).toBe(ofA.id)
        expect(errorOf(await adapter().repositories.availability_rules.get(ofB.id)).code).toBe('not_found')
        expect(errorOf(await rules().update({ id: ofB.id, expected_version: 1, changes: { min_value: 1 } })).code).toBe('not_found')
      })

      it('writes a unit rule with authority over its unit, and a global one only at organization scope', async () => {
        const platoonA = await newUnit('A')
        const platoonB = await newUnit('B')
        await actorWith([VIEW_RULES, CREATE_RULES, UPDATE_RULES, DELETE_RULES, VIEW_UNITS], platoonA.id)
        const ofA = valueOf(await rules().create(ruleInput({ scope_unit_id: platoonA.id })))
        expect(errorOf(await rules().create(ruleInput())).code).toBe('forbidden')
        expect(errorOf(await rules().create(ruleInput({ scope_unit_id: platoonB.id }))).code).toBe('forbidden')
        // Moving the rule needs authority where it lands, checked before the version (D-090).
        const moved = await rules().update({ id: ofA.id, expected_version: 9, changes: { scope_unit_id: platoonB.id } })
        expect(errorOf(moved).code).toBe('forbidden')
        expect(valueOf(await rules().archive({ id: ofA.id, expected_version: 1 })).archived_at).not.toBeNull()
      })

      it('needs each action: view alone writes nothing', async () => {
        harnessOf().signIn(owner)
        const rule: AvailabilityRule = await create()
        await actorWith([VIEW_RULES], null)
        expect(errorOf(await rules().create(ruleInput())).code).toBe('forbidden')
        expect(errorOf(await rules().update({ id: rule.id, expected_version: 1, changes: { min_value: 1 } })).code).toBe('forbidden')
        expect(errorOf(await rules().archive({ id: rule.id, expected_version: 1 })).code).toBe('forbidden')
      })
    })
  })
}
