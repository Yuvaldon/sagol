import {
  PropertyDefinitionId,
  PropertyOptionId,
  SoldierId,
  UnitId,
  type AuthIdentity,
  type CreatePropertyDefinitionInput,
  type OrganizationId,
  type PropertyDefinition,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { errorOf, issuesOf, seedActor, valueOf } from './support'

// Custom property definitions, and the rows their reference values point to (D-016, D-065, D-176; OI-037, OI-073).
// Sample data, test files only.

const newDefinitionId = () => PropertyDefinitionId.parse(crypto.randomUUID())
const option = (label: string) => ({ id: PropertyOptionId.parse(crypto.randomUUID()), label, color_key: null, sort_order: 0 })

function definitionInput(overrides: Partial<CreatePropertyDefinitionInput> = {}): CreatePropertyDefinitionInput {
  return {
    id: newDefinitionId(),
    entity_type: 'soldier',
    data_type: 'text',
    sort_order: 0,
    label: 'Shift',
    options: [],
    is_required: false,
    ...overrides,
  }
}

export function describePropertyContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('property definitions', () => {
    let organization: OrganizationId
    let ownerId: SoldierId

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
    })

    const create = async (overrides: Partial<CreatePropertyDefinitionInput> = {}) =>
      valueOf(await adapter().commands.property_definitions.create(definitionInput(overrides)))

    it('creates, renames and lists definitions; the data type is fixed (D-016)', async () => {
      const shift = await create({ data_type: 'select', options: [option('Morning'), option('Evening')] })
      const renamed = valueOf(
        await adapter().commands.property_definitions.update({ id: shift.id, expected_version: 1, changes: { label: 'Duty' } }),
      )
      expect(renamed).toMatchObject({ label: 'Duty', data_type: 'select', version: 2 })
      const fixed = await adapter().commands.property_definitions.update({
        id: shift.id,
        expected_version: 2,
        // @ts-expect-error the data type cannot be changed
        changes: { data_type: 'text' },
      })
      expect(errorOf(fixed).code).toBe('validation_failed')
      expect(valueOf(await adapter().repositories.property_definitions.list({ include_archived: false })).map((row) => row.label)).toEqual(['Duty'])
    })

    it('checks options on every write (OI-073)', async () => {
      expect(issuesOf(await adapter().commands.property_definitions.create(definitionInput({ options: [option('A')] })))).toEqual([
        { path: ['options'], code: 'property_options_invalid' },
      ])
      const twin = await adapter().commands.property_definitions.create(
        definitionInput({ data_type: 'multi_select', options: [option('Day'), option(' day ')] }),
      )
      expect(issuesOf(twin)).toEqual([{ path: ['options', 1, 'label'], code: 'duplicate_item' }])
      const select = await create({ data_type: 'select', options: [option('Day')] })
      const update = await adapter().commands.property_definitions.update({
        id: select.id,
        expected_version: 1,
        changes: { options: [option('Night'), option('NIGHT')] },
      })
      expect(issuesOf(update)).toEqual([{ path: ['changes', 'options', 1, 'label'], code: 'duplicate_item' }])
    })

    it('orders definitions inside one entity type', async () => {
      const a = await create({ label: 'A' })
      const b = await create({ label: 'B', sort_order: 1 })
      const ofUnits = await create({ label: 'U', entity_type: 'unit' })
      const reordered = valueOf(
        await adapter().commands.property_definitions.reorder({
          items: [
            { id: b.id, expected_version: 1 },
            { id: a.id, expected_version: 1 },
          ],
        }),
      )
      expect(reordered.map((row) => [row.label, row.sort_order])).toEqual([
        ['B', 0],
        ['A', 1],
      ])
      const mixed = await adapter().commands.property_definitions.reorder({
        items: [
          { id: ofUnits.id, expected_version: 1 },
          { id: a.id, expected_version: 2 },
        ],
      })
      expect(issuesOf(mixed)).toEqual([{ path: ['items'], code: 'invalid_order' }])
    })

    it('keeps definitions behind the properties resource (D-053)', async () => {
      await create()
      const { identity } = await seedActor(harnessOf(), organization, [], { anchor_type: 'organization' })
      harnessOf().signIn(identity)
      expect(valueOf(await adapter().repositories.property_definitions.list({ include_archived: false }))).toEqual([])
      expect(errorOf(await adapter().commands.property_definitions.create(definitionInput())).code).toBe('forbidden')
    })

    it('lets who creates an entity read that entity type\'s definitions only (D-186, OI-120)', async () => {
      const soldierField = await create({ label: 'Shift' })
      const leaveField = await create({ entity_type: 'leave', label: 'Destination', is_required: true })
      const archived = await create({ entity_type: 'leave', label: 'Old' })
      valueOf(
        await adapter().commands.property_definitions.archive({ id: archived.id, expected_version: archived.version }),
      )
      const { identity } = await seedActor(harnessOf(), organization, [{ resource: 'leaves', action: 'create' }], {
        anchor_type: 'self',
      })
      harnessOf().signIn(identity)
      const live = valueOf(await adapter().repositories.property_definitions.list({ include_archived: false }))
      expect(live.map((row) => row.id)).toEqual([leaveField.id])
      const all = valueOf(await adapter().repositories.property_definitions.list({ include_archived: true }))
      expect(all.map((row) => row.id).sort()).toEqual([leaveField.id, archived.id].sort())
      expect(valueOf(await adapter().repositories.property_definitions.get(leaveField.id)).label).toBe('Destination')
      expect(errorOf(await adapter().repositories.property_definitions.get(soldierField.id)).code).toBe('not_found')
      const rename = await adapter().commands.property_definitions.update({
        id: leaveField.id,
        expected_version: leaveField.version,
        changes: { label: 'Where' },
      })
      expect(errorOf(rename).code).toBe('forbidden')
    })

    describe('reference values (OI-037, D-176)', () => {
      let buddy: PropertyDefinition

      beforeEach(async () => {
        buddy = await create({ label: 'Buddy', data_type: 'soldier_ref' })
      })

      const setBuddy = async (target: string) => {
        const soldier = valueOf(await adapter().repositories.soldiers.get(ownerId))
        return adapter().commands.soldiers.update({
          id: ownerId,
          expected_version: soldier.version,
          changes: { properties: { [buddy.id]: target } },
        })
      }

      it('accepts a live soldier of the organization', async () => {
        expect(valueOf(await setBuddy(ownerId)).properties).toEqual({ [buddy.id]: ownerId })
      })

      it('refuses a row that is not there, or of another type', async () => {
        expect(issuesOf(await setBuddy(SoldierId.parse(crypto.randomUUID())))).toEqual([
          { path: ['changes', 'properties', buddy.id], code: 'reference_not_found' },
        ])
        const unitRef = await create({ label: 'Home', data_type: 'unit_ref' })
        const soldier = valueOf(await adapter().repositories.soldiers.get(ownerId))
        const wrong = await adapter().commands.soldiers.update({
          id: ownerId,
          expected_version: soldier.version,
          changes: { properties: { [unitRef.id]: UnitId.parse(ownerId) } },
        })
        expect(issuesOf(wrong)).toEqual([{ path: ['changes', 'properties', unitRef.id], code: 'reference_not_found' }])
      })
    })
  })
}
