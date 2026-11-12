import {
  OrganizationId,
  SoldierId,
  UnitId,
  UnitLevelId,
  UnitMembershipId,
  type AuthIdentity,
  type DataChange,
  type ImportBatchInput,
  type ImportOperation,
  type Permission,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, seedActor, valueOf } from './support'

// Import and export against the shared contract (D-022, D-050, D-171): the import runs the UI's commands in one
// transaction, a dry run and a refused run write nothing, a malformed list runs nothing, and the export holds the
// organization's own rows. Also OI-050: a membership id already taken is `already_exists`. Sample data, test files only.

const IMPORT: Permission = { resource: 'data_transfer', action: 'import' }
const EXPORT: Permission = { resource: 'data_transfer', action: 'export' }
const CREATE_LEVELS: Permission = { resource: 'unit_levels', action: 'create' }

const levelOperation = (name: string, id = UnitLevelId.parse(crypto.randomUUID())): ImportOperation => ({
  command: 'create_unit_level',
  input: { id, name, sort_order: 0 },
})

export function describeTransferContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter
  const transfer = () => adapter().transfer
  const levelNames = async () => (await harnessOf().rows('unit_levels')).map((level) => level.name).sort()

  describe('import and export', () => {
    let organization: OrganizationId
    let root: UnitId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      root = claimed.input.root_unit_id
      owner = claimed.owner
    })

    describe('import', () => {
      it('a dry run reports every operation and writes nothing', async () => {
        const report = valueOf(
          await transfer().importBatch({ dry_run: true, operations: [levelOperation('Company'), levelOperation('Platoon')] }),
        )
        expect(report).toEqual({
          committed: false,
          results: [
            { index: 0, error: null },
            { index: 1, error: null },
          ],
        })
        expect(await levelNames()).toEqual([])
      })

      it('a committed run writes through the commands and announces its changes once', async () => {
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const report = valueOf(
          await transfer().importBatch({ dry_run: false, operations: [levelOperation('Company'), levelOperation('Platoon')] }),
        )
        expect(report.committed).toBe(true)
        expect(await levelNames()).toEqual(['Company', 'Platoon'])
        const level = (await harnessOf().rows('unit_levels'))[0]
        expect(level).toMatchObject({ organization_id: organization, version: 1, created_by: expect.any(String) })
        // One announcement, after the commit, carrying both writes.
        expect((await heard).map((change) => change.table)).toEqual(['unit_levels', 'unit_levels'])
      })

      it('stops at the first refused operation and writes nothing', async () => {
        const id = UnitLevelId.parse(crypto.randomUUID())
        const report = valueOf(
          await transfer().importBatch({
            dry_run: false,
            operations: [levelOperation('Company', id), levelOperation('Again', id), levelOperation('Platoon')],
          }),
        )
        expect(report.committed).toBe(false)
        expect(report.results.map((result) => result.index)).toEqual([0, 1])
        expect(report.results[0]?.error).toBeNull()
        expect(report.results[1]?.error?.code).toBe('validation_failed')
        expect(await levelNames()).toEqual([])
      })

      it('a malformed operation runs nothing, and every operation is reported on its form', async () => {
        const report = valueOf(
          await transfer().importBatch({
            dry_run: false,
            operations: [levelOperation('Company'), { command: 'create_unit_level', input: { name: 'No id' } }, { command: 'drop_all' }],
          } as unknown as ImportBatchInput),
        )
        expect(report.committed).toBe(false)
        expect(report.results.map((result) => [result.index, result.error?.code ?? null])).toEqual([
          [0, null],
          [1, 'validation_failed'],
          [2, 'validation_failed'],
        ])
        expect(await levelNames()).toEqual([])
      })

      it('an input that is not a list of operations is a validation failure', async () => {
        expect(errorOf(await transfer().importBatch({ dry_run: false } as unknown as ImportBatchInput)).code).toBe('validation_failed')
        expect(errorOf(await transfer().importBatch({ dry_run: false, operations: [] })).code).toBe('validation_failed')
      })

      it('needs data_transfer:import, even for what the actor may create one by one', async () => {
        const actor = await seedActor(harnessOf(), organization, [CREATE_LEVELS], { anchor_type: 'organization' })
        harnessOf().signIn(actor.identity)
        expect(errorOf(await transfer().importBatch({ dry_run: true, operations: [levelOperation('Company')] })).code).toBe(
          'forbidden',
        )
        expect(await levelNames()).toEqual([])
      })

      it('without data_transfer:import, a malformed list is forbidden too: its shape is not described', async () => {
        const actor = await seedActor(harnessOf(), organization, [CREATE_LEVELS], { anchor_type: 'organization' })
        harnessOf().signIn(actor.identity)
        const malformed = { dry_run: false, operations: [{ command: 'drop_all' }] } as unknown as ImportBatchInput
        expect(errorOf(await transfer().importBatch(malformed)).code).toBe('forbidden')
        expect(errorOf(await transfer().importBatch({ dry_run: false } as unknown as ImportBatchInput)).code).toBe('forbidden')
      })

      it('import alone does not pass the commands: each operation is checked on its own permission', async () => {
        const actor = await seedActor(harnessOf(), organization, [IMPORT], { anchor_type: 'organization' })
        harnessOf().signIn(actor.identity)
        const report = valueOf(await transfer().importBatch({ dry_run: false, operations: [levelOperation('Company')] }))
        expect(report).toEqual({ committed: false, results: [{ index: 0, error: { code: 'forbidden' } }] })
        expect(await levelNames()).toEqual([])
      })
    })

    describe('export', () => {
      it('holds the organization and its own rows, and no other organization', async () => {
        valueOf(await adapter().commands.unit_levels.create({ id: UnitLevelId.parse(crypto.randomUUID()), name: 'Company', sort_order: 0 }))
        // Another organization and a row of its own; a server's foreign keys need the organization first.
        const [stored] = await harnessOf().rows('organizations')
        if (stored === undefined) throw new Error('no organization')
        const elsewhere = OrganizationId.parse(crypto.randomUUID())
        await harnessOf().seed('organizations', [{ ...stored, id: elsewhere, name: 'Elsewhere' }])
        await harnessOf().seed('unit_levels', [
          {
            id: UnitLevelId.parse(crypto.randomUUID()),
            organization_id: elsewhere,
            name: 'Elsewhere',
            sort_order: 0,
            created_at: NOW,
            created_by: null,
            updated_at: NOW,
            updated_by: null,
            version: 1,
            archived_at: null,
          },
        ])
        const exported = valueOf(await transfer().exportOrganization())
        expect(exported.tables.organizations.map((row) => row.id)).toEqual([organization])
        expect(exported.tables.unit_levels.map((level) => level.name)).toEqual(['Company'])
        expect(exported.tables.soldiers.length).toBeGreaterThan(0)
      })

      it('needs data_transfer:export', async () => {
        const actor = await seedActor(harnessOf(), organization, [IMPORT], { anchor_type: 'organization' })
        harnessOf().signIn(actor.identity)
        expect(errorOf(await transfer().exportOrganization()).code).toBe('forbidden')
        harnessOf().signIn(owner)
        const exporter = await seedActor(harnessOf(), organization, [EXPORT], { anchor_type: 'organization' })
        harnessOf().signIn(exporter.identity)
        expect(valueOf(await transfer().exportOrganization()).tables.organizations).toHaveLength(1)
      })
    })

    describe('membership ids (OI-050)', () => {
      const unit = async () =>
        valueOf(
          await adapter().commands.units.create({
            id: UnitId.parse(crypto.randomUUID()),
            parent_id: root,
            sort_order: 0,
            name: 'Platoon',
            code: null,
            unit_level_id: null,
            kind: 'standing',
            valid_from: null,
            valid_to: null,
            color_key: null,
            properties: {},
          }),
        ).id
      const soldier = (membership: { id: UnitMembershipId; unit_id: UnitId; valid_from: string } | null) =>
        adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership,
        })

      it('a new soldier placed with a taken membership id is already_exists', async () => {
        const unitId = await unit()
        const id = UnitMembershipId.parse(crypto.randomUUID())
        valueOf(await soldier({ id, unit_id: unitId, valid_from: '2026-11-01' }))
        expect(issuesOf(await soldier({ id, unit_id: unitId, valid_from: '2026-11-01' }))).toEqual([
          { path: ['membership', 'id'], code: 'already_exists' },
        ])
      })

      it('a membership change to a taken id is already_exists', async () => {
        const unitId = await unit()
        const id = UnitMembershipId.parse(crypto.randomUUID())
        valueOf(await soldier({ id, unit_id: unitId, valid_from: '2026-11-01' }))
        const unplaced = valueOf(await soldier(null))
        const moved = await adapter().commands.soldiers.changeMembership({
          soldier_id: unplaced.id,
          effective_date: '2026-11-02',
          current_membership: null,
          new_membership: { id, unit_id: unitId },
        })
        expect(issuesOf(moved)).toEqual([{ path: ['new_membership', 'id'], code: 'already_exists' }])
      })
    })
  })
}
