import {
  LeaveId,
  LeaveTypeId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type DeploymentId,
  type LeaveStatus,
  type OrganizationId,
  type Permission,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, PAST_DATE, errorOf, seedActor, seedRotation, valueOf } from './support'

// "איתך היום" (D-478): `presence:view` on oneself answers the names of who of one's own unit is on base today, and
// nothing of their leaves. Sample data, test files only.

/** The contract's today, in the organization's zone. */
const TODAY = '2026-11-08'
const START = '2026-01-01'

const pair = (resource: Permission['resource'], action: Permission['action']) => ({ resource, action }) as Permission
const PRESENCE = pair('presence', 'view')
const SELF = { anchor_type: 'self' } as const

export function describePresenceContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{
    input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }
    owner: AuthIdentity
  }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('who is on base with me (D-478)', () => {
    let organization: OrganizationId
    let owner: AuthIdentity
    let root: UnitId

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      root = claimed.input.root_unit_id
      owner = claimed.owner
    })

    async function unit(name: string, parent_id: UnitId = root) {
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

    async function member(unit_id: UnitId, first_name: string) {
      return valueOf(
        await adapter().commands.soldiers.create({
          id: SoldierId.parse(crypto.randomUUID()),
          first_name,
          last_name: 'Bar',
          nickname: 'Nick',
          command_rank_id: null,
          status: 'active',
          properties: {},
          private: null,
          membership: { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id, valid_from: START },
        }),
      )
    }

    const audit = { created_at: NOW, created_by: null, updated_at: NOW, updated_by: null, version: 1 }

    async function leaveType() {
      const id = LeaveTypeId.parse(crypto.randomUUID())
      await harnessOf().seed('leave_types', [
        {
          id,
          organization_id: organization,
          group_id: null,
          name: 'Home',
          color_key: 'teal',
          icon_key: null,
          availability_effect: 'unavailable',
          requires_reason: false,
          sort_order: 0,
          ...audit,
          archived_at: null,
        },
      ])
      return id
    }

    async function leave(
      deployment_id: DeploymentId,
      soldier_id: SoldierId,
      leave_type_id: LeaveTypeId,
      status: LeaveStatus,
      overrides: { start_date?: string; end_date?: string; availability_effect_override?: 'available' | 'unavailable' | null } = {},
    ) {
      await harnessOf().seed('leaves', [
        {
          id: LeaveId.parse(crypto.randomUUID()),
          organization_id: organization,
          soldier_id,
          leave_type_id,
          batch_id: null,
          deployment_id,
          start_date: TODAY,
          end_date: TODAY,
          status,
          availability_effect_override: null,
          reason: 'Private',
          reviewed_by: null,
          reviewed_at: null,
          properties: {},
          ...audit,
          ...overrides,
        },
      ])
    }

    /** A soldier written past the commands, placed in `unit_id` from PAST_DATE by a membership of `type`. */
    async function seeded(
      first_name: string,
      unit_id: UnitId,
      overrides: { status?: 'active' | 'inactive'; archived_at?: string | null } = {},
      membership_type: 'primary' | 'attached' = 'primary',
    ) {
      const id = SoldierId.parse(crypto.randomUUID())
      await harnessOf().seed('soldiers', [
        {
          id,
          organization_id: organization,
          first_name,
          last_name: 'Bar',
          nickname: null,
          command_rank_id: null,
          status: 'active',
          properties: {},
          ...audit,
          archived_at: null,
          ...overrides,
        },
      ])
      await harnessOf().seed('unit_memberships', [
        {
          id: UnitMembershipId.parse(crypto.randomUUID()),
          organization_id: organization,
          soldier_id: id,
          unit_id,
          membership_type,
          valid_from: PAST_DATE,
          valid_to: null,
          ...audit,
          change_seq: 0,
        },
      ])
      return id
    }

    const names = async () =>
      (valueOf(await adapter().repositories.soldiers.presentWithMe())?.soldiers ?? []).map((row) => row.first_name).sort()

    it('names who of the holder\'s own unit is on base today, not the units under it, and nothing more', async () => {
      const platoon = await unit('Platoon')
      const squad = await unit('Squad', platoon.id)
      const sister = await unit('Sister')
      const beside = await member(platoon.id, 'Avi')
      const asking = await member(platoon.id, 'Dan')
      const away = await member(platoon.id, 'Gil')
      await member(squad.id, 'Ben')
      await member(sister.id, 'Eli')
      await member(root, 'Uri')
      const type = await leaveType()
      // One rotation runs at a time (D-257): both requests belong to it.
      const rotation = await seedRotation(harnessOf(), organization, [away.id, asking.id])
      await leave(rotation, away.id, type, 'approved')
      await leave(rotation, asking.id, type, 'pending')
      const holder = await seedActor(harnessOf(), organization, [PRESENCE], SELF, platoon.id)

      harnessOf().signIn(holder.identity)
      const answer = valueOf(await adapter().repositories.soldiers.presentWithMe())
      expect(answer?.date).toBe(TODAY)
      const expected = [beside, asking].map(({ id, first_name, last_name }) => ({ id, first_name, last_name }))
      expect(answer?.soldiers.toSorted((a, b) => a.first_name.localeCompare(b.first_name))).toEqual(expected)
      // Names alone: no nickname, status, unit or leave travels.
      for (const row of answer?.soldiers ?? []) expect(Object.keys(row).sort()).toEqual(['first_name', 'id', 'last_name'])
      // The permission opens no leave and no soldier record.
      expect(valueOf(await adapter().repositories.leaves.list({ ids: null, window: null, soldier_ids: null, statuses: null }))).toEqual([])
      expect(valueOf(await adapter().repositories.soldiers.list({ include_archived: false }))).toEqual([])
      // What a caller sends is ignored: the actor, the unit and the day are the server's (D-479).
      const crafted = adapter().repositories.soldiers.presentWithMe as (...args: unknown[]) => ReturnType<ContractHarness['adapter']['repositories']['soldiers']['presentWithMe']>
      expect(valueOf(await crafted({ unit_id: root, date: '2026-01-01', soldier_id: owner.auth_user_id }))).toEqual(answer)
    })

    it('reaches only the root for a holder placed at the root (D-479)', async () => {
      const platoon = await unit('Platoon')
      await member(platoon.id, 'Avi')
      await member(root, 'Uri')
      const holder = await seedActor(harnessOf(), organization, [PRESENCE], SELF, root)
      harnessOf().signIn(holder.identity)
      // The owner was placed at the root by the claim.
      expect(await names()).toEqual(['Dana', 'Uri'])
    })

    it('leaves out an inactive or archived soldier and one only attached to the unit, and counts only an approved absence of today', async () => {
      const platoon = await unit('Platoon')
      await seeded('Ina', platoon.id, { status: 'inactive' })
      await seeded('Arc', platoon.id, { archived_at: NOW })
      await seeded('Att', platoon.id, {}, 'attached')
      const marked = await seeded('Mor', platoon.id)
      const later = await seeded('Lev', platoon.id)
      const type = await leaveType()
      const rotation = await seedRotation(harnessOf(), organization, [marked, later])
      await leave(rotation, marked, type, 'approved', { availability_effect_override: 'available' })
      await leave(rotation, later, type, 'approved', { start_date: '2026-11-09', end_date: '2026-11-10' })
      const holder = await seedActor(harnessOf(), organization, [PRESENCE], SELF, platoon.id)
      harnessOf().signIn(holder.identity)
      expect(await names()).toEqual(['Lev', 'Mor'])
    })

    it('answers through a rank-constrained source, on the holder themself (D-479)', async () => {
      const platoon = await unit('Platoon')
      await member(platoon.id, 'Avi')
      for (const constraint of ['junior', 'junior_or_equal'] as const) {
        harnessOf().signIn(owner)
        const holder = await seedActor(harnessOf(), organization, [PRESENCE], { anchor_type: 'self', subject_rank_constraint: constraint }, platoon.id)
        harnessOf().signIn(holder.identity)
        expect(valueOf(await harnessOf().adapter.session.can([{ permission: PRESENCE, target: { kind: 'soldier', soldier_id: holder.soldierId } }]))).toEqual([true])
        expect(await names()).toContain('Avi')
      }
    })

    it('is refused without the permission on oneself, and NULL for a holder with no unit today', async () => {
      const platoon = await unit('Platoon')
      await member(platoon.id, 'Avi')
      const reader = await seedActor(harnessOf(), organization, [pair('leaves', 'view')], SELF, platoon.id)
      harnessOf().signIn(reader.identity)
      expect(errorOf(await adapter().repositories.soldiers.presentWithMe()).code).toBe('forbidden')

      // Held over another unit, the pair does not reach its holder.
      harnessOf().signIn(owner)
      const elsewhere = await seedActor(
        harnessOf(),
        organization,
        [PRESENCE],
        { anchor_type: 'unit', anchor_unit_id: platoon.id, include_descendants: true },
        root,
      )
      harnessOf().signIn(elsewhere.identity)
      expect(errorOf(await adapter().repositories.soldiers.presentWithMe()).code).toBe('forbidden')

      harnessOf().signIn(owner)
      const placeless = await seedActor(harnessOf(), organization, [PRESENCE], SELF)
      harnessOf().signIn(placeless.identity)
      expect(valueOf(await adapter().repositories.soldiers.presentWithMe())).toBeNull()
    })
  })
}
