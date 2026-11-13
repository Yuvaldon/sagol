import {
  AuthUserId,
  LeaveCommentId,
  LeaveId,
  LeaveTypeId,
  SoldierId,
  type AuthIdentity,
  type OrganizationId,
  type Permission,
  type SubscribePushInput,
  type UnitId,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, PAST_DATE, errorOf, seedActor, seedRotation, valueOf } from './support'

// Notifications against the shared contract (D-351, D-352): a soldier's browser installs, and the feed the updates
// are derived from. Sample data, test files only.

const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const ORGANIZATION = { anchor_type: 'organization' } as const

function device(overrides: Partial<SubscribePushInput> = {}): SubscribePushInput {
  return {
    endpoint: `https://push.example.test/${crypto.randomUUID()}`,
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
    ...overrides,
  }
}

export function describeNotificationContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter
  const rows = () => harnessOf().rows('push_subscriptions')

  describe('notifications', () => {
    let organization: OrganizationId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    describe('browser installs (D-351)', () => {
      it('stores the caller install once per endpoint, in the caller organization', async () => {
        const install = device()
        expect(valueOf(await adapter().commands.notifications.subscribe(install))).toEqual({ subscribed: true })
        expect(valueOf(await adapter().commands.notifications.subscribe(install))).toEqual({ subscribed: true })
        expect(await rows()).toMatchObject([{ ...install, soldier_id: ownerId, organization_id: organization, created_at: NOW }])
      })

      it('moves an endpoint to the soldier who signed in on the device, keeping its row', async () => {
        const install = device()
        valueOf(await adapter().commands.notifications.subscribe(install))
        const [before] = await rows()
        const noa = await seedActor(harnessOf(), organization, [], ORGANIZATION)
        harnessOf().signIn(noa.identity)
        valueOf(await adapter().commands.notifications.subscribe({ ...install, auth: 'aBHItJI5svbpez7KI4CCXg' }))
        expect(await rows()).toMatchObject([{ id: before?.id, soldier_id: noa.soldierId, auth: 'aBHItJI5svbpez7KI4CCXg' }])
      })

      it('forgets only the caller install, and a missing one is success', async () => {
        const install = device()
        valueOf(await adapter().commands.notifications.subscribe(install))
        const noa = await seedActor(harnessOf(), organization, [], ORGANIZATION)
        harnessOf().signIn(noa.identity)
        expect(errorOf(await adapter().commands.notifications.unsubscribe({ endpoint: install.endpoint })).code).toBe('not_found')
        expect(await rows()).toHaveLength(1)
        harnessOf().signIn(owner)
        expect(valueOf(await adapter().commands.notifications.unsubscribe({ endpoint: install.endpoint }))).toEqual({ subscribed: false })
        expect(valueOf(await adapter().commands.notifications.unsubscribe({ endpoint: install.endpoint }))).toEqual({ subscribed: false })
        expect(await rows()).toEqual([])
      })

      it('refuses an unlinked identity and an endpoint that is not https', async () => {
        expect(errorOf(await adapter().commands.notifications.subscribe(device({ endpoint: 'http://push.example.test/x' }))).code).toBe(
          'validation_failed',
        )
        harnessOf().signIn({ ...owner, auth_user_id: AuthUserId.parse(crypto.randomUUID()) })
        expect(errorOf(await adapter().commands.notifications.subscribe(device())).code).toBe('account_not_linked')
        expect(await rows()).toEqual([])
      })

      it('drops every install of a soldier whose account is revoked or who is archived', async () => {
        const noa = await seedActor(harnessOf(), organization, [], ORGANIZATION)
        const dan = await seedActor(harnessOf(), organization, [], ORGANIZATION)
        for (const actor of [noa, dan]) {
          harnessOf().signIn(actor.identity)
          valueOf(await adapter().commands.notifications.subscribe(device()))
          valueOf(await adapter().commands.notifications.subscribe(device()))
        }
        harnessOf().signIn(owner)
        valueOf(await adapter().commands.notifications.subscribe(device()))
        const account = (await harnessOf().rows('soldier_accounts')).find((row) => row.soldier_id === noa.soldierId)
        if (account === undefined) throw new Error('no account')
        valueOf(await adapter().commands.accounts.revokeLink({ id: account.id }))
        expect((await rows()).map((row) => row.soldier_id).sort()).toEqual([dan.soldierId, dan.soldierId, ownerId].sort())
        valueOf(await adapter().commands.soldiers.archive({ id: dan.soldierId, expected_version: 1 }))
        expect((await rows()).map((row) => row.soldier_id)).toEqual([ownerId])
      })
    })

    describe('the updates feed (D-352)', () => {
      async function ownLeave() {
        const rotation = await seedRotation(harnessOf(), organization, [ownerId])
        const type = valueOf(
          await adapter().commands.leave_types.create({
            id: LeaveTypeId.parse(crypto.randomUUID()),
            group_id: null,
            name: 'Home',
            color_key: 'teal',
            icon_key: null,
            availability_effect: 'unavailable',
            requires_reason: false,
            sort_order: 0,
          }),
        )
        return valueOf(
          await adapter().commands.leaves.create({
            id: LeaveId.parse(crypto.randomUUID()),
            soldier_id: ownerId,
            leave_type_id: type.id,
            deployment_id: rotation,
            start_date: '2026-11-15',
            end_date: '2026-11-16',
            availability_effect_override: null,
            reason: null,
            properties: {},
            as_approved: false,
            acknowledged_rule_ids: [],
            comment: null,
          }),
        )
      }

      it('answers the events and comments on the soldier leaves from a time on, and nothing after it', async () => {
        const leave = await ownLeave()
        const comment = valueOf(
          await adapter().commands.leave_comments.add({ id: LeaveCommentId.parse(crypto.randomUUID()), leave_id: leave.id, body: 'Hi', visibility: 'shared' }),
        )
        const since = `${PAST_DATE}T00:00:00.000Z`
        const events = valueOf(await adapter().repositories.leave_events.feed({ soldier_id: ownerId, since }))
        expect(events).toEqual([expect.objectContaining({ leave_id: leave.id, event_type: 'created' })])
        expect(valueOf(await adapter().repositories.leave_comments.feed({ soldier_id: ownerId, since }))).toEqual([
          expect.objectContaining({ id: comment.id }),
        ])
        expect(valueOf(await adapter().repositories.leave_events.feed({ soldier_id: ownerId, since: NOW }))).toHaveLength(1)
        const later = '2026-11-08T10:00:00.001Z'
        expect(valueOf(await adapter().repositories.leave_events.feed({ soldier_id: ownerId, since: later }))).toEqual([])
      })

      it('filters the feed by the policy, like any read (D-046)', async () => {
        await ownLeave()
        const since = `${PAST_DATE}T00:00:00.000Z`
        const blind = await seedActor(harnessOf(), organization, [], ORGANIZATION)
        harnessOf().signIn(blind.identity)
        expect(valueOf(await adapter().repositories.leave_events.feed({ soldier_id: ownerId, since }))).toEqual([])
        const viewer = await seedActor(harnessOf(), organization, [VIEW_LEAVES], ORGANIZATION)
        harnessOf().signIn(viewer.identity)
        expect(valueOf(await adapter().repositories.leave_events.feed({ soldier_id: ownerId, since }))).toHaveLength(1)
        expect(valueOf(await adapter().repositories.leave_events.feed({ soldier_id: SoldierId.parse(crypto.randomUUID()), since }))).toEqual([])
      })
    })
  })
}
