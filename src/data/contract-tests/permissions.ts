import {
  AccessGrantId,
  CommandRankId,
  RankRoleBindingId,
  RoleId,
  SoldierId,
  UnitId,
  type AuthIdentity,
  type CreateRankRoleBindingInput,
  type CreateRoleInput,
  type GrantAccessInput,
  type OrganizationId,
  type Permission,
  type TableRow,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, placeSoldier, seedActor, valueOf } from './support'

// Roles, rank bindings, access grants, the baseline role and revoking a link against the shared contract
// (D-156 … D-158, D-163). Denial paths through seeded grants (D-076). Sample data, test files only.

const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const UPDATE_SOLDIERS: Permission = { resource: 'soldiers', action: 'update' }
const APPROVE_LEAVES: Permission = { resource: 'leaves', action: 'approve' }
const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const CREATE_ROLES: Permission = { resource: 'roles', action: 'create' }
const UPDATE_ROLES: Permission = { resource: 'roles', action: 'update' }
const VIEW_ROLES: Permission = { resource: 'roles', action: 'view' }
const CREATE_GRANTS: Permission = { resource: 'access_grants', action: 'create' }
const VIEW_GRANTS: Permission = { resource: 'access_grants', action: 'view' }

const newRoleId = () => RoleId.parse(crypto.randomUUID())
const newUnitId = () => UnitId.parse(crypto.randomUUID())

const NO_ANCHOR = {
  anchor_unit_id: null,
  anchor_soldier_id: null,
  anchor_level_id: null,
  anchor_steps: null,
  include_descendants: false,
  subject_rank_constraint: 'any',
} as const

function roleInput(permissions: Permission[], overrides: Partial<CreateRoleInput> = {}): CreateRoleInput {
  return { id: newRoleId(), name: 'Clerk', description: null, color_key: null, permissions, ...overrides }
}

function grantInput(
  grantee_soldier_id: SoldierId,
  role_id: RoleId,
  overrides: Partial<GrantAccessInput> = {},
): GrantAccessInput {
  return {
    id: AccessGrantId.parse(crypto.randomUUID()),
    grantee_soldier_id,
    role_id,
    anchor_type: 'organization',
    ...NO_ANCHOR,
    valid_from: null,
    valid_to: null,
    reason: null,
    ...overrides,
  }
}

function bindingInput(command_rank_id: CommandRankId, role_id: RoleId): CreateRankRoleBindingInput {
  return {
    id: RankRoleBindingId.parse(crypto.randomUUID()),
    command_rank_id,
    role_id,
    anchor_type: 'organization',
    ...NO_ANCHOR,
  }
}

export function describePermissionContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('roles and access', () => {
    let organization: OrganizationId
    let ownerId: SoldierId

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
    })

    const actorWith = (pairs: readonly Permission[], scope: Parameters<typeof seedActor>[3], home?: UnitId) =>
      seedActor(harnessOf(), organization, pairs, scope, home)

    async function unit(name: string, parent_id: UnitId | null = null) {
      return valueOf(
        await adapter().commands.units.create({
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
        }),
      )
    }

    async function rank(seniority: number) {
      return valueOf(
        await adapter().commands.command_ranks.create({
          id: CommandRankId.parse(crypto.randomUUID()),
          title: `Rank ${seniority}`,
          short_title: null,
          seniority,
          color_key: null,
        }),
      )
    }

    /** A soldier with no account, created by the owner, optionally placed in a unit. */
    async function soldier(home?: UnitId) {
      const created = valueOf(
        await adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name: 'Yael',
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership: null,
        }),
      )
      if (home !== undefined) await placeSoldier(harnessOf(), organization, created.id, home, null)
      return created
    }

    const ownerGrant = async () => {
      const grant = (await harnessOf().rows('access_grants')).find((row) => row.grantee_soldier_id === ownerId)
      if (grant === undefined) throw new Error('bootstrap wrote no grant')
      return grant
    }

    describe('roles', () => {
      it('creates a role with its pairs, and replaces them on update', async () => {
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS, VIEW_LEAVES])))
        const pairsOf = async () =>
          valueOf(await adapter().repositories.role_permissions.list({ role_ids: [role.id] })).map(
            (row) => `${row.resource}:${row.action}`,
          )
        expect(await pairsOf()).toEqual(['leaves:view', 'soldiers:view'])

        const updated = valueOf(
          await adapter().commands.roles.update({
            id: role.id,
            expected_version: 1,
            changes: { name: 'Clerk 2', permissions: [VIEW_SOLDIERS] },
          }),
        )
        expect(updated).toMatchObject({ name: 'Clerk 2', version: 2, updated_by: ownerId })
        expect(await pairsOf()).toEqual(['soldiers:view'])
      })

      it('refuses a duplicate pair in the set (D-040)', async () => {
        const issues = issuesOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS, VIEW_SOLDIERS])))
        expect(issues.length).toBeGreaterThan(0)
      })

      it('lists no pairs without roles:view', async () => {
        await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS]))
        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().repositories.role_permissions.list({ role_ids: null }))).toEqual([])
      })

      it('gives only pairs the actor holds (D-060, D-156)', async () => {
        const { identity } = await actorWith([CREATE_ROLES, UPDATE_ROLES, VIEW_ROLES, VIEW_SOLDIERS], {
          anchor_type: 'organization',
        })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.roles.create(roleInput([APPROVE_LEAVES]))).code).toBe('forbidden')
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS])))
        const added = await adapter().commands.roles.update({
          id: role.id,
          expected_version: 1,
          changes: { permissions: [VIEW_SOLDIERS, APPROVE_LEAVES] },
        })
        expect(errorOf(added).code).toBe('forbidden')
        // Taking a pair away is always allowed.
        const removed = valueOf(
          await adapter().commands.roles.update({ id: role.id, expected_version: 1, changes: { permissions: [] } }),
        )
        expect(removed.version).toBe(2)
      })

      it('keeps one access manager: the owner role cannot lose its grant pairs or be archived (D-059)', async () => {
        const grant = await ownerGrant()
        const archived = await adapter().commands.roles.archive({ id: grant.role_id, expected_version: 1 })
        expect(issuesOf(archived)).toEqual([{ path: [], code: 'last_access_manager' }])
        const stripped = await adapter().commands.roles.update({
          id: grant.role_id,
          expected_version: 1,
          changes: { permissions: [VIEW_SOLDIERS] },
        })
        expect(issuesOf(stripped)).toEqual([{ path: [], code: 'last_access_manager' }])
        expect((await harnessOf().rows('role_permissions')).filter((row) => row.role_id === grant.role_id).length).toBeGreaterThan(1)
      })
    })

    describe('rank bindings', () => {
      it('binds a live role to a live rank, and refuses an archived role', async () => {
        const senior = await rank(5)
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS])))
        const binding = valueOf(await adapter().commands.rank_role_bindings.create(bindingInput(senior.id, role.id)))
        expect(binding).toMatchObject({ command_rank_id: senior.id, role_id: role.id, version: 1 })
        expect(valueOf(await adapter().repositories.rank_role_bindings.list({ include_archived: false }))).toHaveLength(1)

        const old = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS], { name: 'Old' })))
        valueOf(await adapter().commands.roles.archive({ id: old.id, expected_version: 1 }))
        const issues = issuesOf(await adapter().commands.rank_role_bindings.create(bindingInput(senior.id, old.id)))
        expect(issues).toEqual([{ path: ['role_id'], code: 'reference_archived' }])
      })

      it('binds only a role whose pairs the actor holds (D-156)', async () => {
        const senior = await rank(5)
        const role = valueOf(await adapter().commands.roles.create(roleInput([APPROVE_LEAVES])))
        const { identity } = await actorWith([CREATE_ROLES, VIEW_ROLES], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.rank_role_bindings.create(bindingInput(senior.id, role.id))).code).toBe(
          'forbidden',
        )
      })

      it('guards a rank change by the pairs its bindings give (D-156)', async () => {
        const senior = await rank(5)
        const role = valueOf(await adapter().commands.roles.create(roleInput([APPROVE_LEAVES])))
        valueOf(await adapter().commands.rank_role_bindings.create(bindingInput(senior.id, role.id)))
        const target = await soldier()
        const { identity } = await actorWith([VIEW_SOLDIERS, UPDATE_SOLDIERS, { resource: 'command_ranks', action: 'view' }], {
          anchor_type: 'organization',
        })
        harnessOf().signIn(identity)
        const result = await adapter().commands.soldiers.update({
          id: target.id,
          expected_version: target.version,
          changes: { command_rank_id: senior.id },
        })
        expect(errorOf(result).code).toBe('forbidden')
      })
    })

    describe('access grants', () => {
      it('grants, lists and revokes; a revoked grant shows only with include_inactive', async () => {
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS])))
        const grantee = await soldier()
        const grant = valueOf(await adapter().commands.access_grants.grant(grantInput(grantee.id, role.id)))
        expect(grant).toMatchObject({ granted_by: ownerId, granted_at: NOW, valid_from: NOW, revoked_at: null })

        const listed = async (include_inactive: boolean) =>
          valueOf(await adapter().repositories.access_grants.list({ grantee_soldier_ids: [grantee.id], include_inactive })).map(
            (row) => row.id,
          )
        expect(await listed(false)).toEqual([grant.id])

        const revoked = valueOf(await adapter().commands.access_grants.revoke({ id: grant.id }))
        expect(revoked).toMatchObject({ revoked_at: NOW, revoked_by: ownerId })
        expect(await listed(false)).toEqual([])
        expect(await listed(true)).toEqual([grant.id])
        expect(issuesOf(await adapter().commands.access_grants.revoke({ id: grant.id }))).toEqual([
          { path: ['id'], code: 'archived' },
        ])
      })

      it("refuses to revoke the last access manager's grant (D-059)", async () => {
        const grant = await ownerGrant()
        expect(issuesOf(await adapter().commands.access_grants.revoke({ id: grant.id }))).toEqual([
          { path: [], code: 'last_access_manager' },
        ])
      })

      it('refuses an archived role and a window that ends before it starts', async () => {
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS])))
        valueOf(await adapter().commands.roles.archive({ id: role.id, expected_version: 1 }))
        const grantee = await soldier()
        expect(issuesOf(await adapter().commands.access_grants.grant(grantInput(grantee.id, role.id)))).toEqual([
          { path: ['role_id'], code: 'reference_archived' },
        ])
        const live = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS], { name: 'Live' })))
        const backwards = await adapter().commands.access_grants.grant(
          grantInput(grantee.id, live.id, { valid_from: NOW, valid_to: '2026-01-01T00:00:00.000Z' }),
        )
        expect(errorOf(backwards).code).toBe('validation_failed')
      })

      it('gives a scope only within the actor’s own reach (D-156)', async () => {
        const company = await unit('Company')
        const platoonA = await unit('Platoon A', company.id)
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_SOLDIERS])))
        const grantee = await soldier(platoonA.id)
        const { identity } = await actorWith([CREATE_GRANTS, VIEW_GRANTS, VIEW_SOLDIERS], {
          anchor_type: 'unit',
          anchor_unit_id: platoonA.id,
          include_descendants: true,
        })
        harnessOf().signIn(identity)

        const wide = await adapter().commands.access_grants.grant(grantInput(grantee.id, role.id))
        expect(errorOf(wide).code).toBe('forbidden')
        const upward = await adapter().commands.access_grants.grant(
          grantInput(grantee.id, role.id, { anchor_type: 'unit', anchor_unit_id: company.id }),
        )
        expect(errorOf(upward).code).toBe('forbidden')
        const inside = valueOf(
          await adapter().commands.access_grants.grant(
            grantInput(grantee.id, role.id, { anchor_type: 'unit', anchor_unit_id: platoonA.id, include_descendants: true }),
          ),
        )
        expect(inside.granted_by).not.toBe(ownerId)
      })

      it('grants only a role whose pairs the actor holds (D-060)', async () => {
        const role = valueOf(await adapter().commands.roles.create(roleInput([APPROVE_LEAVES])))
        const grantee = await soldier()
        const { identity } = await actorWith([CREATE_GRANTS, VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.access_grants.grant(grantInput(grantee.id, role.id))).code).toBe('forbidden')
      })

      it('answers not_found to a grant the actor may not view', async () => {
        const grant = await ownerGrant()
        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().repositories.access_grants.get(grant.id)).code).toBe('not_found')
        expect(errorOf(await adapter().commands.access_grants.revoke({ id: grant.id })).code).toBe('not_found')
      })
    })

    describe('organization settings', () => {
      const current = async () => valueOf(await adapter().repositories.organizations.current())

      it('renames, and answers a stale version', async () => {
        const before = await current()
        const renamed = valueOf(
          await adapter().commands.organizations.update({ expected_version: before.version, changes: { name: 'Battalion' } }),
        )
        expect(renamed).toMatchObject({ name: 'Battalion', version: before.version + 1 })
        const stale = await adapter().commands.organizations.update({ expected_version: before.version, changes: { name: 'X' } })
        expect(errorOf(stale).code).toBe('stale_version')
      })

      it('reports an unknown time zone under changes (OI-044)', async () => {
        const before = await current()
        const result = await adapter().commands.organizations.update({
          expected_version: before.version,
          changes: { timezone: 'Mars/Olympus' },
        })
        expect(issuesOf(result)).toEqual([{ path: ['changes', 'timezone'], code: 'invalid_value' }])
      })

      it('sets a live baseline role, which everyone then holds', async () => {
        const role = valueOf(await adapter().commands.roles.create(roleInput([VIEW_LEAVES])))
        const before = await current()
        valueOf(
          await adapter().commands.organizations.update({ expected_version: before.version, changes: { baseline_role_id: role.id } }),
        )
        const { identity, soldierId } = await actorWith([], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        // The baseline gives its pairs on the holder's own record.
        const checks = [
          { permission: VIEW_LEAVES, target: { kind: 'soldier', soldier_id: soldierId } },
          { permission: VIEW_LEAVES, target: { kind: 'soldier', soldier_id: ownerId } },
        ] as const
        expect(valueOf(await adapter().session.can(checks))).toEqual([true, false])
      })

      it('refuses an archived baseline role, and one with pairs the actor lacks (D-156)', async () => {
        const archived = valueOf(await adapter().commands.roles.create(roleInput([VIEW_LEAVES])))
        valueOf(await adapter().commands.roles.archive({ id: archived.id, expected_version: 1 }))
        const before = await current()
        const refused = await adapter().commands.organizations.update({
          expected_version: before.version,
          changes: { baseline_role_id: archived.id },
        })
        expect(issuesOf(refused)).toEqual([{ path: ['changes', 'baseline_role_id'], code: 'reference_archived' }])

        const strong = valueOf(await adapter().commands.roles.create(roleInput([APPROVE_LEAVES], { name: 'Strong' })))
        const { identity } = await actorWith([{ resource: 'organization', action: 'update' }, { resource: 'organization', action: 'view' }], {
          anchor_type: 'organization',
        })
        harnessOf().signIn(identity)
        const guarded = await adapter().commands.organizations.update({
          expected_version: before.version,
          changes: { baseline_role_id: strong.id },
        })
        expect(errorOf(guarded).code).toBe('forbidden')
      })
    })

    describe('revoking an account link (D-163)', () => {
      async function linked() {
        const { identity, soldierId } = await actorWith([], { anchor_type: 'organization' })
        const account = (await harnessOf().rows('soldier_accounts')).find((row) => row.soldier_id === soldierId)
        if (account === undefined) throw new Error('no account seeded')
        return { identity, soldierId, account }
      }

      it('revokes a link, after which the soldier is unlinked', async () => {
        const { identity, account } = await linked()
        const revoked = valueOf(await adapter().commands.accounts.revokeLink({ id: account.id }))
        expect(revoked).toMatchObject({ revoked_at: NOW, revoked_by: ownerId })
        expect(issuesOf(await adapter().commands.accounts.revokeLink({ id: account.id }))).toEqual([
          { path: ['id'], code: 'archived' },
        ])
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().session.current())).toEqual({ status: 'unlinked', identity })
      })

      it("never revokes the actor's own link", async () => {
        const own = (await harnessOf().rows('soldier_accounts')).find((row) => row.soldier_id === ownerId)
        if (own === undefined) throw new Error('bootstrap wrote no account')
        expect(errorOf(await adapter().commands.accounts.revokeLink({ id: own.id })).code).toBe('forbidden')
      })

      it('answers not_found to a link the actor may not read', async () => {
        const { account } = await linked()
        const { identity } = await actorWith([VIEW_SOLDIERS], { anchor_type: 'organization' })
        harnessOf().signIn(identity)
        expect(errorOf(await adapter().commands.accounts.revokeLink({ id: account.id })).code).toBe('not_found')
      })
    })

    describe('rank constraints (D-157)', () => {
      it('refuses a rank write that leaves the soldier beyond the actor’s constraint', async () => {
        const junior = await rank(1)
        const senior = await rank(9)
        const target = await soldier()
        const { identity, soldierId, roleId } = await actorWith(
          [VIEW_SOLDIERS, UPDATE_SOLDIERS, { resource: 'command_ranks', action: 'view' }],
          { anchor_type: 'organization' },
        )
        // The actor holds rank 5 and may update only juniors or equals.
        const mid = await rank(5)
        const actorRow = (await harnessOf().rows('soldiers')).find((row) => row.id === soldierId) as TableRow<'soldiers'>
        await harnessOf().seed('soldiers', [{ ...actorRow, command_rank_id: mid.id }])
        const grant = (await harnessOf().rows('access_grants')).find((row) => row.role_id === roleId) as TableRow<'access_grants'>
        await harnessOf().seed('access_grants', [{ ...grant, subject_rank_constraint: 'junior_or_equal' }])
        harnessOf().signIn(identity)

        const promoted = await adapter().commands.soldiers.update({
          id: target.id,
          expected_version: target.version,
          changes: { command_rank_id: senior.id },
        })
        expect(errorOf(promoted).code).toBe('forbidden')
        const kept = valueOf(
          await adapter().commands.soldiers.update({
            id: target.id,
            expected_version: target.version,
            changes: { command_rank_id: junior.id },
          }),
        )
        expect(kept.command_rank_id).toBe(junior.id)
      })
    })
  })
}
