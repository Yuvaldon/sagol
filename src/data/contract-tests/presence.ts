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
import { NOW, errorOf, seedActor, seedRotation, valueOf } from './support'

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

    async function leave(deployment_id: DeploymentId, soldier_id: SoldierId, leave_type_id: LeaveTypeId, status: LeaveStatus) {
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
        },
      ])
    }

    it('names who of the holder\'s unit and the units under it is on base today, and nothing more', async () => {
      const platoon = await unit('Platoon')
      const squad = await unit('Squad', platoon.id)
      const sister = await unit('Sister')
      const beside = await member(platoon.id, 'Avi')
      const below = await member(squad.id, 'Ben')
      const away = await member(squad.id, 'Gil')
      const asking = await member(squad.id, 'Dan')
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
      const expected = [beside, below, asking].map(({ id, first_name, last_name }) => ({ id, first_name, last_name }))
      expect(answer?.soldiers.toSorted((a, b) => a.first_name.localeCompare(b.first_name))).toEqual(expected)
      // Names alone: no nickname, status, unit or leave travels.
      for (const row of answer?.soldiers ?? []) expect(Object.keys(row).sort()).toEqual(['first_name', 'id', 'last_name'])
      // The permission opens no leave and no soldier record.
      expect(valueOf(await adapter().repositories.leaves.list({ ids: null, window: null, soldier_ids: null, statuses: null }))).toEqual([])
      expect(valueOf(await adapter().repositories.soldiers.list({ include_archived: false }))).toEqual([])
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
