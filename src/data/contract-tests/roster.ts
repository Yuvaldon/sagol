import {
  CommandRankId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CreateCommandRankInput,
  type CreateSoldierInput,
  type CreateUnitInput,
  type DataChange,
  type OrganizationId,
  type Permission,
  type PolicyTarget,
  type TableRow,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, PAST_DATE, errorOf, hintAndCommand, issuesOf, seedActor, valueOf } from './support'

// The roster against the shared contract: ranks, soldiers, private fields and memberships, with denial
// paths through seeded grants, long before the roles screen exists (D-076, D-096). Sample data, test
// files only.

const TODAY = '2026-11-08'
const TOMORROW = '2026-11-09'
const LAST_WEEK = '2026-11-01'

const newRankId = () => CommandRankId.parse(crypto.randomUUID())
const newSoldierId = () => SoldierId.parse(crypto.randomUUID())
const newUnitId = () => UnitId.parse(crypto.randomUUID())
const newMembershipId = () => UnitMembershipId.parse(crypto.randomUUID())

function rankInput(overrides: Partial<CreateCommandRankInput> = {}): CreateCommandRankInput {
  return { id: newRankId(), title: 'Rank', short_title: null, seniority: 10, color_key: null, ...overrides }
}

function soldierInput(overrides: Partial<CreateSoldierInput> = {}): CreateSoldierInput {
  return {
    id: newSoldierId(),
    first_name: 'Yael',
    last_name: 'Bar',
    nickname: null,
    command_rank_id: null,
    status: 'active',
    properties: {},
    private: null,
    membership: null,
    ...overrides,
  }
}

function unitInput(name: string, parent_id: UnitId | null): CreateUnitInput {
  return {
    id: newUnitId(),
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
  }
}

const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const CREATE_SOLDIERS: Permission = { resource: 'soldiers', action: 'create' }
const UPDATE_SOLDIERS: Permission = { resource: 'soldiers', action: 'update' }
const UPDATE_MEMBERSHIPS: Permission = { resource: 'memberships', action: 'update' }
const VIEW_MEMBERSHIPS: Permission = { resource: 'memberships', action: 'view' }
const VIEW_PRIVATE: Permission = { resource: 'soldier_private', action: 'view' }
const UPDATE_PRIVATE: Permission = { resource: 'soldier_private', action: 'update' }
const VIEW_UNITS: Permission = { resource: 'units', action: 'view' }
const DELETE_SOLDIERS: Permission = { resource: 'soldiers', action: 'delete' }

const ON_ORGANIZATION: PolicyTarget = { kind: 'organization' }
const onUnit = (unit_id: UnitId): PolicyTarget => ({ kind: 'unit', unit_id })
const onSoldier = (soldier_id: SoldierId): PolicyTarget => ({ kind: 'soldier', soldier_id })

export function describeRosterContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('roster', () => {
    let organization: OrganizationId
    let root: UnitId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      root = claimed.input.root_unit_id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    const actorWith = (pairs: readonly Permission[], scope: Parameters<typeof seedActor>[3], home?: UnitId) =>
      seedActor(harnessOf(), organization, pairs, scope, home)

    /** Company > Platoon A, Platoon B, created by the owner. */
    async function sampleUnits() {
      const company = valueOf(await adapter().commands.units.create(unitInput('Company', root)))
      const platoonA = valueOf(await adapter().commands.units.create(unitInput('Platoon A', company.id)))
      const platoonB = valueOf(await adapter().commands.units.create(unitInput('Platoon B', company.id)))
      return { company, platoonA, platoonB }
    }

    const placement = (unit_id: UnitId, valid_from = LAST_WEEK) => ({ id: newMembershipId(), unit_id, valid_from })
    const emptyPrivate = { personal_id: null, invite_email: null, phone: null }

    async function membershipsOf(soldier_id: SoldierId) {
      return (await harnessOf().rows('unit_memberships'))
        .filter((row) => row.soldier_id === soldier_id)
        .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
    }

    const liveSoldiers = async () => valueOf(await adapter().repositories.soldiers.list({ include_archived: false }))

    describe('command ranks', () => {
      it('lists the most senior first, and allows equal seniority (D-095)', async () => {
        const junior = valueOf(await adapter().commands.command_ranks.create(rankInput({ title: 'Junior', seniority: 1 })))
        const senior = valueOf(await adapter().commands.command_ranks.create(rankInput({ title: 'Senior', seniority: 9 })))
        const peer = valueOf(await adapter().commands.command_ranks.create(rankInput({ title: 'Peer', seniority: 9 })))
        const listed = valueOf(await adapter().repositories.command_ranks.list({ include_archived: false }))
        expect(listed.map((rank) => rank.id)).toEqual([...[senior.id, peer.id].sort(), junior.id])
      })

      it('moves a rank by its number, and answers a stale version', async () => {
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const moved = valueOf(
          await adapter().commands.command_ranks.update({ id: rank.id, expected_version: 1, changes: { seniority: 50 } }),
        )
        expect(moved).toMatchObject({ seniority: 50, version: 2, updated_by: ownerId })
        const stale = await adapter().commands.command_ranks.update({ id: rank.id, expected_version: 1, changes: { title: 'New' } })
        expect(errorOf(stale).code).toBe('stale_version')
      })

      it('stores a blank short title as NULL (D-101, OI-052)', async () => {
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput({ short_title: ' ' })))
        expect(rank.short_title).toBeNull()
        const titled = valueOf(
          await adapter().commands.command_ranks.update({ id: rank.id, expected_version: 1, changes: { short_title: 'סמ"ר' } }),
        )
        const cleared = valueOf(
          await adapter().commands.command_ranks.update({ id: rank.id, expected_version: titled.version, changes: { short_title: '' } }),
        )
        expect(cleared.short_title).toBeNull()
      })

      it('checks the color against the palette (D-074)', async () => {
        const result = await adapter().commands.command_ranks.create(rankInput({ color_key: 'magenta' }))
        expect(issuesOf(result)).toEqual([{ path: ['color_key'], code: 'invalid_value' }])
      })

      it('refuses to archive a rank a live soldier holds, and allows it once nobody does (D-095)', async () => {
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const soldier = valueOf(await adapter().commands.soldiers.create(soldierInput({ command_rank_id: rank.id })))
        expect(issuesOf(await adapter().commands.command_ranks.archive({ id: rank.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'rank_in_use' },
        ])
        valueOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 1 }))
        const archived = valueOf(await adapter().commands.command_ranks.archive({ id: rank.id, expected_version: 1 }))
        expect(archived.archived_at).toBe(NOW)
        expect(valueOf(await adapter().repositories.command_ranks.list({ include_archived: false }))).toEqual([])
      })

      it('hides ranks from who may not read them, and refuses writes without the pair', async () => {
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const { identity } = await actorWith([], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.command_ranks.list({ include_archived: false }))).toEqual([])
        expect(errorOf(await adapter().repositories.command_ranks.get(rank.id)).code).toBe('not_found')
        expect(errorOf(await adapter().commands.command_ranks.create(rankInput())).code).toBe('forbidden')
        expect(
          errorOf(await adapter().commands.command_ranks.update({ id: rank.id, expected_version: 1, changes: { title: 'X' } })).code,
        ).toBe('not_found')
      })

      it('refuses an organization-wide write from a unit scope (D-053)', async () => {
        const { company } = await sampleUnits()
        const { identity } = await actorWith(
          [
            { resource: 'command_ranks', action: 'view' },
            { resource: 'command_ranks', action: 'create' },
          ],
          { anchor_type: 'unit', anchor_unit_id: company.id, include_descendants: true },
        )
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.command_ranks.create(rankInput())).code).toBe('forbidden')
      })
    })

    describe('creating a soldier', () => {
      it('needs only names (D-030), and starts at version 1 with audit columns', async () => {
        const created = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        expect(created).toMatchObject({
          first_name: 'Yael',
          organization_id: organization,
          version: 1,
          created_by: ownerId,
          created_at: NOW,
          archived_at: null,
        })
        expect(await harnessOf().rows('soldier_private')).toEqual([])
        expect(await membershipsOf(created.id)).toEqual([])
      })

      it('writes the soldier, the placement and the private fields together, and tells the feed', async () => {
        const { platoonA } = await sampleUnits()
        const heard = new Promise<readonly DataChange[]>((resolve) => {
          const stop = adapter().changes.subscribe((changes) => {
            stop()
            resolve(changes)
          })
        })
        const input = soldierInput({
          private: { personal_id: '012-345 67', invite_email: null, phone: '050-1234567' },
          membership: placement(platoonA.id),
        })
        const created = valueOf(await adapter().commands.soldiers.create(input))
        expect(await membershipsOf(created.id)).toMatchObject([
          { unit_id: platoonA.id, valid_from: LAST_WEEK, valid_to: null, membership_type: 'primary', version: 1 },
        ])
        expect(valueOf(await adapter().repositories.soldier_private.get(created.id))).toMatchObject({
          personal_id: '1234567',
          phone: '050-1234567',
          version: 1,
          updated_by: ownerId,
        })
        expect((await heard).map((change) => change.table).sort()).toEqual([
          'change_counters',
          'soldier_private',
          'soldiers',
          'unit_memberships',
        ])
      })

      it('writes no private row for empty private fields', async () => {
        valueOf(await adapter().commands.soldiers.create(soldierInput({ private: emptyPrivate })))
        expect(await harnessOf().rows('soldier_private')).toEqual([])
      })

      it('stores blank optional text as NULL, and writes no private row of blanks (D-101, OI-052)', async () => {
        const created = valueOf(
          await adapter().commands.soldiers.create(
            soldierInput({ nickname: '  ', private: { personal_id: ' ', invite_email: ' ', phone: '' } }),
          ),
        )
        expect(created.nickname).toBeNull()
        expect(await harnessOf().rows('soldier_private')).toEqual([])
        const named = valueOf(
          await adapter().commands.soldiers.update({ id: created.id, expected_version: 1, changes: { nickname: 'Yuli' } }),
        )
        const cleared = valueOf(
          await adapter().commands.soldiers.update({ id: created.id, expected_version: named.version, changes: { nickname: ' ' } }),
        )
        expect(cleared.nickname).toBeNull()
      })

      it('answers field codes from the schema (D-068), and an id that is taken (D-044)', async () => {
        const blank = await adapter().commands.soldiers.create(soldierInput({ first_name: '  ' }))
        expect(issuesOf(blank)).toEqual([{ path: ['first_name'], code: 'required' }])
        const first = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        const again = await adapter().commands.soldiers.create(soldierInput({ id: first.id }))
        expect(issuesOf(again)).toEqual([{ path: ['id'], code: 'already_exists' }])
      })

      it('refuses a rank that is unknown or archived, and a unit that is unknown or archived', async () => {
        const unknownRank = await adapter().commands.soldiers.create(soldierInput({ command_rank_id: newRankId() }))
        expect(issuesOf(unknownRank)).toEqual([{ path: ['command_rank_id'], code: 'reference_not_found' }])

        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        valueOf(await adapter().commands.command_ranks.archive({ id: rank.id, expected_version: 1 }))
        const archivedRank = await adapter().commands.soldiers.create(soldierInput({ command_rank_id: rank.id }))
        expect(issuesOf(archivedRank)).toEqual([{ path: ['command_rank_id'], code: 'reference_archived' }])

        const unknownUnit = await adapter().commands.soldiers.create(soldierInput({ membership: placement(newUnitId()) }))
        expect(issuesOf(unknownUnit)).toEqual([{ path: ['membership', 'unit_id'], code: 'reference_not_found' }])

        const unit = valueOf(await adapter().commands.units.create(unitInput('Old', root)))
        valueOf(await adapter().commands.units.archive({ id: unit.id, expected_version: 1 }))
        const archivedUnit = await adapter().commands.soldiers.create(soldierInput({ membership: placement(unit.id) }))
        expect(issuesOf(archivedUnit)).toEqual([{ path: ['membership', 'unit_id'], code: 'reference_archived' }])
      })

      it('catches one personal id typed two ways, and writes nothing (D-066)', async () => {
        const { platoonA } = await sampleUnits()
        valueOf(
          await adapter().commands.soldiers.create(
            soldierInput({ private: { ...emptyPrivate, personal_id: '0123456' } }),
          ),
        )
        const before = (await harnessOf().rows('soldiers')).length
        const placed = await harnessOf().rows('unit_memberships')
        const result = await adapter().commands.soldiers.create(
          soldierInput({ private: { ...emptyPrivate, personal_id: '12-34-56' }, membership: placement(platoonA.id) }),
        )
        expect(issuesOf(result)).toEqual([{ path: ['private', 'personal_id'], code: 'already_exists' }])
        expect((await harnessOf().rows('soldiers')).length).toBe(before)
        expect(await harnessOf().rows('unit_memberships')).toEqual(placed)
      })

      it('needs soldiers:create on the placement, or at organization scope without one (D-096)', async () => {
        const { platoonA, platoonB } = await sampleUnits()
        const { identity } = await actorWith(
          [CREATE_SOLDIERS, UPDATE_MEMBERSHIPS, VIEW_UNITS],
          { anchor_type: 'unit', anchor_unit_id: platoonA.id },
        )
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.soldiers.create(soldierInput())).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonB.id) }))).code).toBe(
          'forbidden',
        )
        valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonA.id) })))
      })

      it('is not a second way to place a soldier or to write private fields (iron rule 6)', async () => {
        const { platoonA } = await sampleUnits()
        const { identity } = await actorWith([CREATE_SOLDIERS, VIEW_UNITS], {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
        })
        harnessOf().signIn(identity)
        const before = (await harnessOf().rows('soldiers')).length
        const placed = await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonA.id) }))
        expect(errorOf(placed).code).toBe('forbidden')
        expect((await harnessOf().rows('soldiers')).length).toBe(before)

        harnessOf().signIn(owner)
        const { identity: placer } = await actorWith([CREATE_SOLDIERS, UPDATE_MEMBERSHIPS, VIEW_UNITS], {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
        })
        harnessOf().signIn(placer)
        const withPrivate = await adapter().commands.soldiers.create(
          soldierInput({ private: { ...emptyPrivate, phone: '050' }, membership: placement(platoonA.id) }),
        )
        expect(errorOf(withPrivate).code).toBe('forbidden')
        expect(await harnessOf().rows('soldier_private')).toEqual([])
      })
    })

    describe('reading and editing a soldier', () => {
      it('filters reads by the policy, and an invisible soldier answers not_found (D-046)', async () => {
        const { platoonA, platoonB } = await sampleUnits()
        const inA = valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonA.id) })))
        const inB = valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonB.id) })))
        const { identity, soldierId } = await actorWith([VIEW_SOLDIERS, UPDATE_SOLDIERS], {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
        }, platoonA.id)
        harnessOf().signIn(identity)
        expect((await liveSoldiers()).map((row) => row.id).sort()).toEqual([inA.id, soldierId].sort())
        expect(errorOf(await adapter().repositories.soldiers.get(inB.id)).code).toBe('not_found')
        expect(errorOf(await adapter().commands.soldiers.update({ id: inB.id, expected_version: 1, changes: { nickname: 'X' } })).code).toBe('not_found')
        expect(errorOf(await adapter().commands.soldiers.archive({ id: inB.id, expected_version: 1 })).code).toBe('not_found')
        expect(valueOf(await adapter().commands.soldiers.update({ id: inA.id, expected_version: 1, changes: { nickname: 'X' } })).nickname).toBe('X')
      })

      it('answers forbidden to who sees a soldier but may not change them', async () => {
        const soldier = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect((await liveSoldiers()).map((row) => row.id)).toContain(soldier.id)
        expect(errorOf(await adapter().commands.soldiers.update({ id: soldier.id, expected_version: 1, changes: { nickname: 'X' } })).code).toBe('forbidden')
        expect(errorOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 1 })).code).toBe('forbidden')
      })

      it('answers archived and stale_version in the order of D-090', async () => {
        const soldier = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        const edited = valueOf(await adapter().commands.soldiers.update({ id: soldier.id, expected_version: 1, changes: { nickname: 'A' } }))
        expect(edited.version).toBe(2)
        expect(errorOf(await adapter().commands.soldiers.update({ id: soldier.id, expected_version: 1, changes: { nickname: 'B' } })).code).toBe('stale_version')
        valueOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 2 }))
        expect(issuesOf(await adapter().commands.soldiers.update({ id: soldier.id, expected_version: 3, changes: { nickname: 'C' } }))).toEqual([
          { path: [], code: 'archived' },
        ])
      })

      it('leaves an unchanged archived rank alone, and refuses a new one', async () => {
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const held = valueOf(await adapter().commands.soldiers.create(soldierInput({ command_rank_id: rank.id })))
        const archivedRank: TableRow<'command_ranks'> = { ...rank, archived_at: NOW }
        await harnessOf().seed('command_ranks', [archivedRank])
        valueOf(await adapter().commands.soldiers.update({ id: held.id, expected_version: 1, changes: { nickname: 'Ok' } }))
        const other = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        expect(issuesOf(await adapter().commands.soldiers.update({ id: other.id, expected_version: 1, changes: { command_rank_id: rank.id } }))).toEqual([
          { path: ['changes', 'command_rank_id'], code: 'reference_archived' },
        ])
      })

      it('archives a soldier without closing the placement or the account (D-098)', async () => {
        const { platoonA } = await sampleUnits()
        const soldier = valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonA.id) })))
        valueOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 1 }))
        expect((await liveSoldiers()).map((row) => row.id)).not.toContain(soldier.id)
        const all = valueOf(await adapter().repositories.soldiers.list({ include_archived: true }))
        expect(all.map((row) => row.id)).toContain(soldier.id)
        expect(await membershipsOf(soldier.id)).toMatchObject([{ valid_to: null }])
        // D-088 ignores placements of archived soldiers.
        valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))
      })
    })

    describe('restoring a soldier (D-371)', () => {
      const restore = (id: SoldierId, expected_version: number) => adapter().commands.soldiers.restore({ id, expected_version })

      it('restores an archived soldier, who still holds their number (D-098)', async () => {
        const { platoonA } = await sampleUnits()
        const soldier = valueOf(
          await adapter().commands.soldiers.create(
            soldierInput({ membership: placement(platoonA.id), private: { ...emptyPrivate, personal_id: '777' } }),
          ),
        )
        expect(issuesOf(await restore(soldier.id, 1))).toEqual([{ path: [], code: 'not_archived' }])
        valueOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 1 }))
        expect(errorOf(await restore(soldier.id, 1)).code).toBe('stale_version')
        expect(valueOf(await restore(soldier.id, 2))).toMatchObject({ archived_at: null, version: 3, updated_by: ownerId })
        expect((await liveSoldiers()).map((row) => row.id)).toContain(soldier.id)
        expect(valueOf(await adapter().repositories.soldier_private.get(soldier.id)).personal_id).toBe('777')
      })

      it('refuses a placement in an archived unit and an archived rank, until they are back', async () => {
        const { platoonA } = await sampleUnits()
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const soldier = valueOf(
          await adapter().commands.soldiers.create(soldierInput({ membership: placement(platoonA.id), command_rank_id: rank.id })),
        )
        valueOf(await adapter().commands.soldiers.archive({ id: soldier.id, expected_version: 1 }))
        valueOf(await adapter().commands.units.archive({ id: platoonA.id, expected_version: 1 }))
        valueOf(await adapter().commands.command_ranks.archive({ id: rank.id, expected_version: 1 }))
        expect(issuesOf(await restore(soldier.id, 2))).toEqual([
          { path: ['command_rank_id'], code: 'reference_archived' },
          { path: ['unit_id'], code: 'reference_archived' },
        ])
        valueOf(await adapter().commands.units.restore({ id: platoonA.id, expected_version: 2 }))
        valueOf(await adapter().commands.command_ranks.restore({ id: rank.id, expected_version: 2 }))
        expect(valueOf(await restore(soldier.id, 2)).archived_at).toBeNull()
      })

      it('needs the delete pair, and every pair the soldier gets back (D-056, D-060)', async () => {
        const plain = valueOf(await adapter().commands.soldiers.create(soldierInput()))
        valueOf(await adapter().commands.soldiers.archive({ id: plain.id, expected_version: 1 }))
        const { soldierId: granted } = await actorWith([VIEW_PRIVATE], { anchor_type: 'organization' })
        valueOf(await adapter().commands.soldiers.archive({ id: granted, expected_version: 1 }))

        const { identity: viewer } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(viewer)
        expect(errorOf(await restore(plain.id, 2)).code).toBe('forbidden')

        harnessOf().signIn(owner)
        const { identity: deleter } = await actorWith([VIEW_SOLDIERS, DELETE_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(deleter)
        expect(errorOf(await restore(granted, 2)).code).toBe('forbidden')
        expect(valueOf(await restore(plain.id, 2)).archived_at).toBeNull()

        harnessOf().signIn(owner)
        expect(valueOf(await restore(granted, 2)).archived_at).toBeNull()
      })
    })

    describe('the last access manager (D-059)', () => {
      const lastManager = [{ path: [], code: 'last_access_manager' }]

      it('refuses to archive them or to make them inactive, and changes nothing', async () => {
        expect(issuesOf(await adapter().commands.soldiers.archive({ id: ownerId, expected_version: 1 }))).toEqual(lastManager)
        expect(issuesOf(await adapter().commands.soldiers.update({ id: ownerId, expected_version: 1, changes: { status: 'inactive' } }))).toEqual(lastManager)
        const stored = (await harnessOf().rows('soldiers')).find((row) => row.id === ownerId)
        expect(stored).toMatchObject({ status: 'active', archived_at: null, version: 1 })
      })

      it('allows it once another manager remains', async () => {
        await actorWith(
          [
            { resource: 'access_grants', action: 'create' },
            { resource: 'access_grants', action: 'delete' },
            { resource: 'roles', action: 'update' },
          ],
          { anchor_type: 'organization' },
        )
        const edited = valueOf(await adapter().commands.soldiers.update({ id: ownerId, expected_version: 1, changes: { status: 'inactive' } }))
        expect(edited.status).toBe('inactive')
      })

      it('refuses a rank change that takes the last manager away', async () => {
        // A manager only through their rank, with the owner's grant revoked.
        const rank = valueOf(await adapter().commands.command_ranks.create(rankInput()))
        const roleId = (await harnessOf().rows('roles'))[0]?.id
        if (roleId === undefined) throw new Error('no owner role')
        const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1, archived_at: null }
        await harnessOf().seed('rank_role_bindings', [
          {
            id: crypto.randomUUID() as TableRow<'rank_role_bindings'>['id'],
            organization_id: organization,
            command_rank_id: rank.id,
            role_id: roleId,
            anchor_type: 'organization',
            anchor_unit_id: null,
            anchor_soldier_id: null,
            anchor_level_id: null,
            anchor_steps: null,
            include_descendants: false,
            subject_rank_constraint: 'any',
            ...audit,
          },
        ])
        const owned = valueOf(await adapter().commands.soldiers.update({ id: ownerId, expected_version: 1, changes: { command_rank_id: rank.id } }))
        const grants = await harnessOf().rows('access_grants')
        await harnessOf().seed('access_grants', grants.map((grant) => ({ ...grant, revoked_at: NOW })))
        const result = await adapter().commands.soldiers.update({ id: ownerId, expected_version: owned.version, changes: { command_rank_id: null } })
        expect(issuesOf(result)).toEqual(lastManager)
      })

      it('does not check an edit that cannot change permissions', async () => {
        const edited = valueOf(await adapter().commands.soldiers.update({ id: ownerId, expected_version: 1, changes: { nickname: 'Boss' } }))
        expect(edited.nickname).toBe('Boss')
      })
    })

    describe('private fields (D-018, D-096)', () => {
      let soldierId: SoldierId

      beforeEach(async () => {
        soldierId = valueOf(await adapter().commands.soldiers.create(soldierInput())).id
      })

      const write = (changes: { personal_id?: string | null; phone?: string | null }, expected_version: number | null) =>
        adapter().commands.soldiers.updatePrivate({ soldier_id: soldierId, expected_version, changes })

      it('creates the row on the first write, and bumps its version after that', async () => {
        const first = valueOf(await write({ personal_id: '00-123' }, null))
        expect(first).toMatchObject({ personal_id: '123', phone: null, version: 1, updated_by: ownerId })
        const second = valueOf(await write({ phone: '050' }, 1))
        expect(second).toMatchObject({ personal_id: '123', phone: '050', version: 2 })
      })

      it('answers stale_version for a NULL version once a row exists, and for an old version', async () => {
        valueOf(await write({ phone: '050' }, null))
        expect(errorOf(await write({ phone: '051' }, null)).code).toBe('stale_version')
        valueOf(await write({ phone: '051' }, 1))
        expect(errorOf(await write({ phone: '052' }, 1)).code).toBe('stale_version')
      })

      it('stores a blank phone as NULL (D-101, OI-052)', async () => {
        valueOf(await write({ phone: '050' }, null))
        expect(valueOf(await write({ phone: '   ' }, 1)).phone).toBeNull()
      })

      it('stores no id when only separators remain (D-066)', async () => {
        expect(valueOf(await write({ personal_id: '- -' }, null)).personal_id).toBeNull()
      })

      it('refuses a number another soldier holds, archived ones too, and allows keeping its own (D-098)', async () => {
        const other = valueOf(
          await adapter().commands.soldiers.create(soldierInput({ private: { ...emptyPrivate, personal_id: '777' } })),
        )
        expect(issuesOf(await write({ personal_id: '0777' }, null))).toEqual([{ path: ['changes', 'personal_id'], code: 'already_exists' }])
        valueOf(await adapter().commands.soldiers.archive({ id: other.id, expected_version: 1 }))
        expect(issuesOf(await write({ personal_id: '777' }, null))).toEqual([{ path: ['changes', 'personal_id'], code: 'already_exists' }])
        valueOf(await write({ personal_id: '888' }, null))
        valueOf(await write({ personal_id: '0888' }, 1))
      })

      it('needs view and update, and hides the row without view', async () => {
        valueOf(await write({ phone: '050' }, null))
        const { identity: updater } = await actorWith([VIEW_SOLDIERS, UPDATE_PRIVATE], { anchor_type: 'organization' })
        harnessOf().signIn(updater)
        expect(errorOf(await write({ phone: '051' }, 1)).code).toBe('forbidden')
        expect(errorOf(await adapter().repositories.soldier_private.get(soldierId)).code).toBe('not_found')
        expect(valueOf(await adapter().repositories.soldier_private.list({ soldier_ids: null }))).toEqual([])

        harnessOf().signIn(owner)
        const { identity: reader } = await actorWith([VIEW_SOLDIERS, VIEW_PRIVATE], { anchor_type: 'organization' })
        harnessOf().signIn(reader)
        expect(errorOf(await write({ phone: '051' }, 1)).code).toBe('forbidden')
        expect(valueOf(await adapter().repositories.soldier_private.get(soldierId)).phone).toBe('050')
        expect(valueOf(await adapter().repositories.soldier_private.list({ soldier_ids: [soldierId] }))).toHaveLength(1)
      })

      it('answers not_found for a soldier the actor cannot see, even with the pairs', async () => {
        const { identity } = await actorWith([VIEW_PRIVATE, UPDATE_PRIVATE], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await write({ phone: '051' }, null)).code).toBe('not_found')
      })

      it('refuses an archived soldier', async () => {
        valueOf(await adapter().commands.soldiers.archive({ id: soldierId, expected_version: 1 }))
        expect(issuesOf(await write({ phone: '051' }, null))).toEqual([{ path: [], code: 'archived' }])
      })
    })

    describe('changing a membership (D-010, D-097)', () => {
      let units: Awaited<ReturnType<typeof sampleUnits>>
      let soldierId: SoldierId

      async function open() {
        const rows = await membershipsOf(soldierId)
        const row = rows.find((candidate) => candidate.valid_to === null)
        if (row === undefined) throw new Error('no open row')
        return row
      }

      beforeEach(async () => {
        units = await sampleUnits()
        soldierId = valueOf(
          await adapter().commands.soldiers.create(soldierInput({ membership: placement(units.platoonA.id) })),
        ).id
      })

      const change = async (effective_date: string, unit_id: UnitId | null) => {
        const current = await open()
        return adapter().commands.soldiers.changeMembership({
          soldier_id: soldierId,
          effective_date,
          current_membership: { id: current.id, expected_version: current.version },
          new_membership: unit_id === null ? null : { id: newMembershipId(), unit_id },
        })
      }

      it('closes the open row the day before and opens a new one, keeping history', async () => {
        const answer = valueOf(await change(TODAY, units.platoonB.id))
        expect(answer).toHaveLength(2)
        expect(await membershipsOf(soldierId)).toMatchObject([
          { unit_id: units.platoonA.id, valid_from: LAST_WEEK, valid_to: '2026-11-07', version: 2 },
          { unit_id: units.platoonB.id, valid_from: TODAY, valid_to: null, version: 1 },
        ])
      })

      it('numbers each membership it writes, after the placement it was created with (D-373)', async () => {
        const current = async () => valueOf(await adapter().repositories.change_counters.current())
        const before = await current()
        expect((await open()).change_seq).toBe(before)
        valueOf(await change(TODAY, units.platoonB.id))
        expect((await membershipsOf(soldierId)).map((row) => row.change_seq).sort()).toEqual([before + 1, before + 2])
        expect(await current()).toBe(before + 2)
      })

      it('accepts a future date, and the soldier stays in the old unit until then', async () => {
        valueOf(await change(TOMORROW, units.platoonB.id))
        expect(await membershipsOf(soldierId)).toMatchObject([
          { unit_id: units.platoonA.id, valid_to: TODAY },
          { unit_id: units.platoonB.id, valid_from: TOMORROW, valid_to: null },
        ])
        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'unit', anchor_unit_id: units.platoonA.id })
        harnessOf().signIn(identity)
        expect((await liveSoldiers()).map((row) => row.id)).toContain(soldierId)
      })

      it('corrects the row in place on its first day, with no new row and no history', async () => {
        const answer = valueOf(await change(LAST_WEEK, units.platoonB.id))
        expect(answer).toHaveLength(1)
        expect(await membershipsOf(soldierId)).toMatchObject([
          { unit_id: units.platoonB.id, valid_from: LAST_WEEK, valid_to: null, version: 2, updated_by: ownerId },
        ])
      })

      it('refuses a date before the open row, and leaving on its first day', async () => {
        expect(issuesOf(await change('2026-10-01', units.platoonB.id))).toEqual([{ path: ['effective_date'], code: 'range_inverted' }])
        expect(issuesOf(await change(LAST_WEEK, null))).toEqual([{ path: ['effective_date'], code: 'range_inverted' }])
        expect(await membershipsOf(soldierId)).toHaveLength(1)
      })

      it('refuses the unit the soldier is already in', async () => {
        expect(issuesOf(await change(TODAY, units.platoonA.id))).toEqual([{ path: ['new_membership', 'unit_id'], code: 'no_changes' }])
      })

      it('leaves without a unit, which lets the unit be archived (D-088)', async () => {
        expect(issuesOf(await adapter().commands.units.archive({ id: units.platoonA.id, expected_version: 1 }))).toEqual([
          { path: [], code: 'unit_not_empty' },
        ])
        valueOf(await change('2026-11-02', null))
        expect(await membershipsOf(soldierId)).toMatchObject([{ valid_to: LAST_WEEK }])
        valueOf(await adapter().commands.units.archive({ id: units.platoonA.id, expected_version: 1 }))
      })

      it('places a soldier who has no open row, and refuses what overlaps', async () => {
        const other = valueOf(await adapter().commands.soldiers.create(soldierInput())).id
        valueOf(
          await adapter().commands.soldiers.changeMembership({
            soldier_id: other,
            effective_date: TODAY,
            current_membership: null,
            new_membership: { id: newMembershipId(), unit_id: units.platoonA.id },
          }),
        )
        const overlap = await adapter().commands.soldiers.changeMembership({
          soldier_id: other,
          effective_date: TOMORROW,
          current_membership: null,
          new_membership: { id: newMembershipId(), unit_id: units.platoonB.id },
        })
        expect(issuesOf(overlap)).toEqual([{ path: ['effective_date'], code: 'membership_overlap' }])
      })

      it('answers stale_version for a closed row or an old version', async () => {
        const current = await open()
        const stale = (expected_version: number) =>
          adapter().commands.soldiers.changeMembership({
            soldier_id: soldierId,
            effective_date: TODAY,
            current_membership: { id: current.id, expected_version },
            new_membership: { id: newMembershipId(), unit_id: units.platoonB.id },
          })
        expect(errorOf(await stale(current.version + 1)).code).toBe('stale_version')
        valueOf(await stale(current.version))
        expect(errorOf(await stale(current.version + 1)).code).toBe('stale_version')
      })

      it('refuses a row of another soldier', async () => {
        const other = valueOf(await adapter().commands.soldiers.create(soldierInput())).id
        const current = await open()
        const result = await adapter().commands.soldiers.changeMembership({
          soldier_id: other,
          effective_date: TODAY,
          current_membership: { id: current.id, expected_version: current.version },
          new_membership: { id: newMembershipId(), unit_id: units.platoonB.id },
        })
        expect(issuesOf(result)).toEqual([{ path: ['current_membership', 'id'], code: 'reference_not_found' }])
      })

      it('refuses an archived soldier, and a unit that is unknown or archived', async () => {
        expect(issuesOf(await change(TODAY, newUnitId()))).toEqual([{ path: ['new_membership', 'unit_id'], code: 'reference_not_found' }])
        const old = valueOf(await adapter().commands.units.create(unitInput('Old', root)))
        valueOf(await adapter().commands.units.archive({ id: old.id, expected_version: 1 }))
        expect(issuesOf(await change(TODAY, old.id))).toEqual([{ path: ['new_membership', 'unit_id'], code: 'reference_archived' }])
        valueOf(await adapter().commands.soldiers.archive({ id: soldierId, expected_version: 1 }))
        expect(issuesOf(await change(TODAY, units.platoonB.id))).toEqual([{ path: [], code: 'archived' }])
      })

      it('needs authority over the soldier and over the new unit (D-096)', async () => {
        const inB = valueOf(
          await adapter().commands.soldiers.create(soldierInput({ membership: placement(units.platoonB.id) })),
        ).id
        const { identity } = await actorWith(
          [VIEW_SOLDIERS, UPDATE_MEMBERSHIPS, VIEW_UNITS],
          { anchor_type: 'unit', anchor_unit_id: units.platoonA.id },
        )
        harnessOf().signIn(identity)
        expect(errorOf(await change(TODAY, units.platoonB.id)).code).toBe('forbidden')
        const foreign = await adapter().commands.soldiers.changeMembership({
          soldier_id: inB,
          effective_date: TODAY,
          current_membership: null,
          new_membership: { id: newMembershipId(), unit_id: units.platoonA.id },
        })
        expect(errorOf(foreign).code).toBe('not_found')
        expect(await membershipsOf(soldierId)).toHaveLength(1)
      })

      it('moves freely with authority over both sides', async () => {
        const { identity } = await actorWith(
          [VIEW_SOLDIERS, UPDATE_MEMBERSHIPS, VIEW_UNITS],
          { anchor_type: 'unit', anchor_unit_id: units.company.id, include_descendants: true },
        )
        harnessOf().signIn(identity)
        expect(valueOf(await change(TODAY, units.platoonB.id))).toHaveLength(2)
      })

      it('reads memberships only with memberships:view, by soldier, unit and window', async () => {
        valueOf(await change(TODAY, units.platoonB.id))
        const all = valueOf(await adapter().repositories.unit_memberships.list({ soldier_ids: [soldierId], unit_ids: null, window: null }))
        expect(all.map((row) => row.valid_from)).toEqual([LAST_WEEK, TODAY])
        const inB = valueOf(await adapter().repositories.unit_memberships.list({ soldier_ids: null, unit_ids: [units.platoonB.id], window: null }))
        expect(inB).toHaveLength(1)
        const earlier = valueOf(
          await adapter().repositories.unit_memberships.list({
            soldier_ids: null,
            unit_ids: null,
            window: { start_date: PAST_DATE, end_date: '2026-11-03' },
          }),
        )
        expect(earlier.map((row) => row.unit_id)).toEqual([units.platoonA.id])
        const rowId = all[0]?.id
        if (rowId === undefined) throw new Error('no row')
        expect(valueOf(await adapter().repositories.unit_memberships.get(rowId)).id).toBe(rowId)

        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.unit_memberships.list({ soldier_ids: null, unit_ids: null, window: null }))).toEqual([])
        expect(errorOf(await adapter().repositories.unit_memberships.get(rowId)).code).toBe('not_found')

        harnessOf().signIn(owner)
        const { identity: viewer } = await actorWith([VIEW_MEMBERSHIPS], { anchor_type: 'organization' })
        harnessOf().signIn(viewer)
        expect(valueOf(await adapter().repositories.unit_memberships.list({ soldier_ids: [soldierId], unit_ids: null, window: null }))).toHaveLength(2)
      })

      it('moves the last access manager, whose organization scope does not depend on a unit (D-059)', async () => {
        // The claim placed the owner in the root unit today (D-251), so a change on the same day replaces that row.
        const current = (await membershipsOf(ownerId))[0]
        if (current === undefined) throw new Error('no row')
        valueOf(
          await adapter().commands.soldiers.changeMembership({
            soldier_id: ownerId,
            effective_date: TODAY,
            current_membership: { id: current.id, expected_version: current.version },
            new_membership: { id: newMembershipId(), unit_id: units.platoonB.id },
          }),
        )
        expect((await membershipsOf(ownerId)).map((row) => row.unit_id)).toEqual([units.platoonB.id])
      })
    })

    describe('the can hint agrees with the commands (D-091, D-096, OI-049)', () => {
      const ALL_PAIRS = [
        VIEW_SOLDIERS,
        CREATE_SOLDIERS,
        UPDATE_SOLDIERS,
        DELETE_SOLDIERS,
        UPDATE_MEMBERSHIPS,
        VIEW_PRIVATE,
        UPDATE_PRIVATE,
        VIEW_UNITS,
      ]
      let units: Awaited<ReturnType<typeof sampleUnits>>
      let squad: UnitId
      let inA: SoldierId
      let inB: SoldierId

      /** Platoon A holds a squad; the actor holds `pairs` on platoon A and below, and nothing on platoon B. */
      async function signInOnPlatoonA(pairs: readonly Permission[] = ALL_PAIRS) {
        harnessOf().signIn(owner)
        const { identity } = await actorWith(pairs, {
          anchor_type: 'unit',
          anchor_unit_id: units.platoonA.id,
          include_descendants: true,
        })
        harnessOf().signIn(identity)
      }

      beforeEach(async () => {
        units = await sampleUnits()
        squad = valueOf(await adapter().commands.units.create(unitInput('Squad', units.platoonA.id))).id
        inA = valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(units.platoonA.id) }))).id
        inB = valueOf(await adapter().commands.soldiers.create(soldierInput({ membership: placement(units.platoonB.id) }))).id
      })

      const creating = (unit: PolicyTarget) => [
        { permission: CREATE_SOLDIERS, target: unit },
        { permission: UPDATE_MEMBERSHIPS, target: unit },
      ]

      it('creates a soldier where soldiers:create and memberships:update hold on the placement', async () => {
        await signInOnPlatoonA()
        const create = (unit_id: UnitId | null) => () =>
          adapter().commands.soldiers.create(soldierInput({ membership: unit_id === null ? null : placement(unit_id) }))
        expect(await hintAndCommand(harnessOf(), creating(onUnit(squad)), create(squad))).toEqual([true, true])
        expect(await hintAndCommand(harnessOf(), creating(onUnit(units.platoonB.id)), create(units.platoonB.id))).toEqual([
          false,
          false,
        ])
        expect(await hintAndCommand(harnessOf(), [{ permission: CREATE_SOLDIERS, target: ON_ORGANIZATION }], create(null))).toEqual([
          false,
        ])
      })

      it('writes private fields on creation where soldier_private:update holds on the unit of the placement', async () => {
        const create = (unit_id: UnitId | null) => () =>
          adapter().commands.soldiers.create(
            soldierInput({
              private: { ...emptyPrivate, phone: '050' },
              membership: unit_id === null ? null : placement(unit_id),
            }),
          )
        const withPrivate = (unit: PolicyTarget) => [...creating(unit), { permission: UPDATE_PRIVATE, target: unit }]
        await signInOnPlatoonA()
        expect(await hintAndCommand(harnessOf(), withPrivate(onUnit(squad)), create(squad))).toEqual([true, true, true])
        expect(await hintAndCommand(harnessOf(), withPrivate(onUnit(units.platoonB.id)), create(units.platoonB.id))).toEqual([
          false,
          false,
          false,
        ])
        expect(
          await hintAndCommand(
            harnessOf(),
            [
              { permission: CREATE_SOLDIERS, target: ON_ORGANIZATION },
              { permission: UPDATE_PRIVATE, target: ON_ORGANIZATION },
            ],
            create(null),
          ),
        ).toEqual([false, false])

        await signInOnPlatoonA(ALL_PAIRS.filter((pair) => pair !== UPDATE_PRIVATE))
        expect(await hintAndCommand(harnessOf(), withPrivate(onUnit(squad)), create(squad))).toEqual([true, true, false])
        expect((await harnessOf().rows('soldier_private')).length).toBe(1)
      })

      it('edits and archives the soldier where soldiers:update and soldiers:delete hold on them', async () => {
        const update = (id: SoldierId) => () => adapter().commands.soldiers.update({ id, expected_version: 1, changes: { nickname: 'X' } })
        const archive = (id: SoldierId, expected_version: number) => () =>
          adapter().commands.soldiers.archive({ id, expected_version })
        await signInOnPlatoonA([VIEW_SOLDIERS])
        expect(await hintAndCommand(harnessOf(), [{ permission: UPDATE_SOLDIERS, target: onSoldier(inA) }], update(inA))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), [{ permission: DELETE_SOLDIERS, target: onSoldier(inA) }], archive(inA, 1))).toEqual([
          false,
        ])

        await signInOnPlatoonA()
        expect(await hintAndCommand(harnessOf(), [{ permission: UPDATE_SOLDIERS, target: onSoldier(inA) }], update(inA))).toEqual([true])
        expect(await hintAndCommand(harnessOf(), [{ permission: UPDATE_SOLDIERS, target: onSoldier(inB) }], update(inB))).toEqual([false])
        expect(await hintAndCommand(harnessOf(), [{ permission: DELETE_SOLDIERS, target: onSoldier(inB) }], archive(inB, 1))).toEqual([
          false,
        ])
        expect(await hintAndCommand(harnessOf(), [{ permission: DELETE_SOLDIERS, target: onSoldier(inA) }], archive(inA, 2))).toEqual([
          true,
        ])
      })

      it('writes private fields where soldier_private:view and :update hold on the soldier', async () => {
        const checks = (soldier_id: SoldierId) => [
          { permission: VIEW_PRIVATE, target: onSoldier(soldier_id) },
          { permission: UPDATE_PRIVATE, target: onSoldier(soldier_id) },
        ]
        const write = (soldier_id: SoldierId) => () =>
          adapter().commands.soldiers.updatePrivate({ soldier_id, expected_version: null, changes: { phone: '050' } })
        await signInOnPlatoonA([VIEW_SOLDIERS, UPDATE_PRIVATE])
        expect(await hintAndCommand(harnessOf(), checks(inA), write(inA))).toEqual([false, true])

        await signInOnPlatoonA()
        expect(await hintAndCommand(harnessOf(), checks(inB), write(inB))).toEqual([false, false])
        expect(await hintAndCommand(harnessOf(), checks(inA), write(inA))).toEqual([true, true])
      })

      it('moves a soldier where memberships:update holds on the soldier and on the new unit', async () => {
        const checks = (soldier_id: SoldierId, unit_id: UnitId) => [
          { permission: UPDATE_MEMBERSHIPS, target: onSoldier(soldier_id) },
          { permission: UPDATE_MEMBERSHIPS, target: onUnit(unit_id) },
        ]
        const move = (soldier_id: SoldierId, unit_id: UnitId) => async () => {
          const current = (await membershipsOf(soldier_id)).find((row) => row.valid_to === null)
          if (current === undefined) throw new Error('no open row')
          return adapter().commands.soldiers.changeMembership({
            soldier_id,
            effective_date: TOMORROW,
            current_membership: { id: current.id, expected_version: current.version },
            new_membership: { id: newMembershipId(), unit_id },
          })
        }
        await signInOnPlatoonA()
        expect(await hintAndCommand(harnessOf(), checks(inA, units.platoonB.id), move(inA, units.platoonB.id))).toEqual([true, false])
        expect(await hintAndCommand(harnessOf(), checks(inB, squad), move(inB, squad))).toEqual([false, true])
        expect(await hintAndCommand(harnessOf(), checks(inA, squad), move(inA, squad))).toEqual([true, true])
      })
    })
  })
}
