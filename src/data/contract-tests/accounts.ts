import {
  AccountLinkRequestId,
  AuthUserId,
  SoldierAccountId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type CreateSoldierInput,
  type CreateUnitInput,
  type OrganizationId,
  type Permission,
  type RequestAccountLinkInput,
  type UnitId as UnitIdType,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, errorOf, issuesOf, seedActor, seedGrant, valueOf } from './support'

// Account linking against the shared contract (D-005, D-030, D-066, D-156): requests, auto-link, review,
// revocation, and what each side may see. Sample data, test files only.

const LAST_WEEK = '2026-11-01'

const newSoldierId = () => SoldierId.parse(crypto.randomUUID())
const newAccountId = () => SoldierAccountId.parse(crypto.randomUUID())
const newRequestId = () => AccountLinkRequestId.parse(crypto.randomUUID())

function identityOf(email: string, overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    auth_user_id: AuthUserId.parse(crypto.randomUUID()),
    provider: 'local',
    email,
    email_verified: true,
    display_name: null,
    ...overrides,
  }
}

function requestInput(overrides: Partial<RequestAccountLinkInput> = {}): RequestAccountLinkInput {
  return {
    id: newRequestId(),
    claimed_personal_id: null,
    first_name: 'Yael',
    last_name: 'Bar',
    account_id: newAccountId(),
    ...overrides,
  }
}

function unitInput(name: string): CreateUnitInput {
  return {
    id: UnitId.parse(crypto.randomUUID()),
    parent_id: null,
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

const APPROVE_ACCOUNTS: Permission = { resource: 'accounts', action: 'approve' }
const VIEW_ACCOUNTS: Permission = { resource: 'accounts', action: 'view' }
const CREATE_SOLDIERS: Permission = { resource: 'soldiers', action: 'create' }
const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }

export function describeAccountContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId } }; owner: AuthIdentity }>,
): void {
  const adapter = () => harnessOf().adapter

  describe('account linking', () => {
    let organization: OrganizationId
    let ownerId: SoldierId
    let owner: AuthIdentity

    beforeEach(async () => {
      const claimed = await claim()
      organization = claimed.input.organization.id
      ownerId = claimed.input.soldier.id
      owner = claimed.owner
    })

    /** A soldier the owner creates, optionally placed and with private fields. */
    async function rosterSoldier(overrides: Partial<CreateSoldierInput> = {}) {
      harnessOf().signIn(owner)
      return valueOf(
        await adapter().commands.soldiers.create({
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
        }),
      )
    }

    async function unit(name: string) {
      harnessOf().signIn(owner)
      return valueOf(await adapter().commands.units.create(unitInput(name)))
    }

    const placement = (unit_id: UnitIdType) => ({ id: UnitMembershipId.parse(crypto.randomUUID()), unit_id, valid_from: LAST_WEEK })

    /** Signs in a new identity and files a request; returns both. */
    async function asks(overrides: Partial<RequestAccountLinkInput> = {}, identity = identityOf('asker@example.test')) {
      harnessOf().signIn(identity)
      const input = requestInput(overrides)
      const result = valueOf(await adapter().commands.accounts.requestLink(input))
      return { identity, input, result }
    }

    describe('requesting', () => {
      it('files a pending request, stores the personal id normalized, and says nothing of matches (D-005, D-066)', async () => {
        await rosterSoldier()
        const { input, result } = await asks({ claimed_personal_id: ' 0012-345 ' })
        expect(result).toEqual({ outcome: 'pending_review' })
        const state = valueOf(await adapter().session.onboardingState())
        expect(state.open_request).toMatchObject({
          id: input.id,
          status: 'pending',
          claimed_personal_id: '12345',
          email: 'asker@example.test',
          created_at: NOW,
        })
        expect(await harnessOf().rows('soldier_accounts')).toHaveLength(1)
      })

      it('allows one open request per identity, and a new one after cancelling', async () => {
        const { input } = await asks()
        expect(issuesOf(await adapter().commands.accounts.requestLink(requestInput()))).toEqual([
          { path: [], code: 'already_exists' },
        ])
        const cancelled = valueOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id }))
        expect(cancelled.status).toBe('cancelled')
        expect(valueOf(await adapter().session.onboardingState()).open_request).toBeNull()
        expect(issuesOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id }))).toEqual([
          { path: [], code: 'invalid_transition' },
        ])
        expect(valueOf(await adapter().commands.accounts.requestLink(requestInput())).outcome).toBe('pending_review')
      })

      it("answers not_found to another identity's cancel", async () => {
        const { input } = await asks()
        harnessOf().signIn(identityOf('stranger@example.test'))
        expect(errorOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id })).code).toBe('not_found')
      })

      it('auto-links on personal id and an invite email equal to the verified email (D-030)', async () => {
        const soldier = await rosterSoldier({
          private: { personal_id: '7654321', invite_email: 'Asker@Example.test', phone: null },
        })
        const { identity, input, result } = await asks({ claimed_personal_id: '765-4321', first_name: 'X', last_name: 'Y' })
        expect(result).toEqual({ outcome: 'linked' })
        expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldier.id })
        expect(await harnessOf().rows('account_link_requests')).toEqual([])
        const accounts = await harnessOf().rows('soldier_accounts')
        expect(accounts.find((row) => row.id === input.account_id)).toMatchObject({
          auth_user_id: identity.auth_user_id,
          soldier_id: soldier.id,
          linked_by: null,
          linked_at: NOW,
        })
      })

      it('never auto-links an unverified email, and answers the same way (D-005)', async () => {
        await rosterSoldier({ private: { personal_id: '7654321', invite_email: 'asker@example.test', phone: null } })
        const { result } = await asks(
          { claimed_personal_id: '7654321' },
          identityOf('asker@example.test', { email_verified: false }),
        )
        expect(result).toEqual({ outcome: 'pending_review' })
        expect(valueOf(await adapter().session.current()).status).toBe('unlinked')
      })

      it('refuses a linked session and a signed-out one', async () => {
        harnessOf().signIn(owner)
        expect(issuesOf(await adapter().commands.accounts.requestLink(requestInput()))).toEqual([
          { path: [], code: 'already_linked' },
        ])
        harnessOf().signIn(null)
        expect(errorOf(await adapter().commands.accounts.requestLink(requestInput())).code).toBe('unauthenticated')
      })
    })

    describe('reviewing', () => {
      it('shows the owner the request and its candidates, personal id first (D-066)', async () => {
        const byName = await rosterSoldier()
        const byId = await rosterSoldier({
          first_name: 'Other',
          last_name: 'Name',
          private: { personal_id: '555', invite_email: null, phone: null },
        })
        const { input } = await asks({ claimed_personal_id: '555' })
        harnessOf().signIn(owner)
        const listed = valueOf(await adapter().repositories.account_link_requests.list({ statuses: ['pending'] }))
        expect(listed.map((row) => row.id)).toEqual([input.id])
        expect(valueOf(await adapter().repositories.account_link_requests.candidates(input.id))).toEqual([
          { soldier_id: byId.id, match: 'personal_id' },
          { soldier_id: byName.id, match: 'name' },
        ])
      })

      it('links to a candidate, fills a missing personal id, and links the requester (D-030)', async () => {
        const soldier = await rosterSoldier()
        const { identity, input } = await asks({ claimed_personal_id: '888' })
        harnessOf().signIn(owner)
        const accountId = newAccountId()
        const reviewed = valueOf(
          await adapter().commands.accounts.reviewLink({
            id: input.id,
            resolution: { kind: 'link', account_id: accountId, soldier_id: soldier.id },
          }),
        )
        expect(reviewed).toMatchObject({ status: 'approved', resolved_soldier_id: soldier.id, reviewed_by: ownerId, reviewed_at: NOW })
        expect(valueOf(await adapter().repositories.soldier_private.get(soldier.id)).personal_id).toBe('888')
        expect(valueOf(await adapter().repositories.soldier_accounts.list({ soldier_ids: [soldier.id] }))).toMatchObject([
          { id: accountId, auth_user_id: identity.auth_user_id, linked_by: ownerId, revoked_at: null },
        ])
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldier.id })
      })

      it('refuses a soldier who is not a candidate, and a second review (D-156)', async () => {
        await rosterSoldier()
        const stranger = await rosterSoldier({ first_name: 'Other', last_name: 'Name' })
        const { input } = await asks()
        harnessOf().signIn(owner)
        const link = (soldier_id: SoldierId) =>
          adapter().commands.accounts.reviewLink({ id: input.id, resolution: { kind: 'link', account_id: newAccountId(), soldier_id } })
        expect(issuesOf(await link(stranger.id))).toEqual([{ path: ['resolution', 'soldier_id'], code: 'not_a_candidate' }])
        expect(await harnessOf().rows('soldier_accounts')).toHaveLength(1)
        valueOf(await adapter().commands.accounts.reviewLink({ id: input.id, resolution: { kind: 'reject' } }))
        expect(issuesOf(await adapter().commands.accounts.reviewLink({ id: input.id, resolution: { kind: 'reject' } }))).toEqual([
          { path: [], code: 'invalid_transition' },
        ])
      })

      it('creates a soldier from the request, placed, with the claimed personal id', async () => {
        const platoon = await unit('Platoon')
        const { identity, input } = await asks({ claimed_personal_id: '999', first_name: 'Asher', last_name: 'Peretz' })
        harnessOf().signIn(owner)
        const soldierId = newSoldierId()
        const reviewed = valueOf(
          await adapter().commands.accounts.reviewLink({
            id: input.id,
            resolution: {
              kind: 'create_soldier',
              account_id: newAccountId(),
              soldier_id: soldierId,
              command_rank_id: null,
              membership: placement(platoon.id),
            },
          }),
        )
        expect(reviewed).toMatchObject({ status: 'approved', resolved_soldier_id: soldierId })
        expect(valueOf(await adapter().repositories.soldiers.get(soldierId))).toMatchObject({
          first_name: 'Asher',
          last_name: 'Peretz',
          status: 'active',
          created_by: ownerId,
        })
        expect(valueOf(await adapter().repositories.soldier_private.get(soldierId)).personal_id).toBe('999')
        expect(valueOf(await adapter().repositories.unit_memberships.list({ soldier_ids: [soldierId], unit_ids: null, window: null }))).toMatchObject([
          { unit_id: platoon.id },
        ])
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldierId })
      })

      it('reports a placement problem under the resolution', async () => {
        const { input } = await asks()
        harnessOf().signIn(owner)
        const result = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: {
            kind: 'create_soldier',
            account_id: newAccountId(),
            soldier_id: newSoldierId(),
            command_rank_id: null,
            membership: placement(UnitId.parse(crypto.randomUUID())),
          },
        })
        expect(issuesOf(result)).toEqual([{ path: ['resolution', 'membership', 'unit_id'], code: 'reference_not_found' }])
        expect(await harnessOf().rows('soldiers')).toHaveLength(1)
      })

      it('shows a unit reviewer only requests and candidates in reach (D-066, D-156)', async () => {
        const mine = await unit('Mine')
        const theirs = await unit('Theirs')
        const inReach = await rosterSoldier({ membership: placement(mine.id) })
        const outOfReach = await rosterSoldier({ membership: placement(theirs.id) })
        const { input } = await asks()
        const loner = await asks({ first_name: 'Nobody', last_name: 'Known' }, identityOf('loner@example.test'))
        const reviewer = await seedActor(harnessOf(), organization, [APPROVE_ACCOUNTS, VIEW_SOLDIERS], {
          anchor_type: 'unit',
          anchor_unit_id: mine.id,
          include_descendants: true,
        })
        harnessOf().signIn(reviewer.identity)
        const listed = valueOf(await adapter().repositories.account_link_requests.list({ statuses: null }))
        expect(listed.map((row) => row.id)).toEqual([input.id])
        expect(errorOf(await adapter().repositories.account_link_requests.get(loner.input.id)).code).toBe('not_found')
        expect(valueOf(await adapter().repositories.account_link_requests.candidates(input.id))).toEqual([
          { soldier_id: inReach.id, match: 'name' },
        ])
        const outside = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: { kind: 'link', account_id: newAccountId(), soldier_id: outOfReach.id },
        })
        expect(errorOf(outside).code).toBe('forbidden')
        const created = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: { kind: 'create_soldier', account_id: newAccountId(), soldier_id: newSoldierId(), command_rank_id: null, membership: null },
        })
        expect(errorOf(created).code).toBe('forbidden')
        // A soldier out of reach is refused the same way whether or not it is a candidate (D-157).
        const stranger = await rosterSoldier({ first_name: 'Other', last_name: 'Name', membership: placement(theirs.id) })
        harnessOf().signIn(reviewer.identity)
        const notCandidate = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: { kind: 'link', account_id: newAccountId(), soldier_id: stranger.id },
        })
        expect(errorOf(notCandidate).code).toBe('forbidden')
      })

      it('offers only candidates the reviewer may see (D-157)', async () => {
        const mine = await unit('Mine')
        await rosterSoldier({ membership: placement(mine.id) })
        const { input } = await asks()
        const reviewer = await seedActor(harnessOf(), organization, [APPROVE_ACCOUNTS], {
          anchor_type: 'unit',
          anchor_unit_id: mine.id,
          include_descendants: true,
        })
        harnessOf().signIn(reviewer.identity)
        expect(valueOf(await adapter().repositories.account_link_requests.candidates(input.id))).toEqual([])
      })

      it('fills the personal id only for a reviewer who may write private fields (D-157)', async () => {
        const mine = await unit('Mine')
        const soldier = await rosterSoldier({ membership: placement(mine.id) })
        const { input } = await asks({ claimed_personal_id: '5554443' })
        const reviewer = await seedActor(harnessOf(), organization, [APPROVE_ACCOUNTS, VIEW_SOLDIERS], {
          anchor_type: 'unit',
          anchor_unit_id: mine.id,
          include_descendants: true,
        })
        harnessOf().signIn(reviewer.identity)
        const reviewed = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: { kind: 'link', account_id: newAccountId(), soldier_id: soldier.id },
        })
        expect(valueOf(reviewed).status).toBe('approved')
        expect(await harnessOf().rows('soldier_private')).toEqual([])
      })

      it('creates a soldier only where the reviewer may also approve accounts (D-157)', async () => {
        const mine = await unit('Mine')
        const theirs = await unit('Theirs')
        await rosterSoldier({ membership: placement(mine.id) })
        const { input } = await asks()
        const reviewer = await seedActor(harnessOf(), organization, [APPROVE_ACCOUNTS], {
          anchor_type: 'unit',
          anchor_unit_id: mine.id,
          include_descendants: true,
        })
        await seedGrant(
          harnessOf(),
          organization,
          reviewer.soldierId,
          [CREATE_SOLDIERS, { resource: 'memberships', action: 'update' }, { resource: 'units', action: 'view' }],
          { anchor_type: 'organization' },
        )
        harnessOf().signIn(reviewer.identity)
        const elsewhere = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: {
            kind: 'create_soldier',
            account_id: newAccountId(),
            soldier_id: newSoldierId(),
            command_rank_id: null,
            membership: placement(theirs.id),
          },
        })
        expect(errorOf(elsewhere).code).toBe('forbidden')
      })

      it('lets a reviewer with soldiers:create in the unit create there', async () => {
        const mine = await unit('Mine')
        await rosterSoldier({ membership: placement(mine.id) })
        const { input } = await asks()
        const reviewer = await seedActor(
          harnessOf(),
          organization,
          [APPROVE_ACCOUNTS, CREATE_SOLDIERS, { resource: 'memberships', action: 'update' }, { resource: 'units', action: 'view' }],
          { anchor_type: 'unit', anchor_unit_id: mine.id, include_descendants: true },
        )
        harnessOf().signIn(reviewer.identity)
        const reviewed = await adapter().commands.accounts.reviewLink({
          id: input.id,
          resolution: {
            kind: 'create_soldier',
            account_id: newAccountId(),
            soldier_id: newSoldierId(),
            command_rank_id: null,
            membership: placement(mine.id),
          },
        })
        expect(valueOf(reviewed).status).toBe('approved')
      })
    })

    describe('revoking', () => {
      async function linkedSoldier() {
        const soldier = await rosterSoldier()
        const { identity, input } = await asks()
        harnessOf().signIn(owner)
        const accountId = newAccountId()
        valueOf(
          await adapter().commands.accounts.reviewLink({
            id: input.id,
            resolution: { kind: 'link', account_id: accountId, soldier_id: soldier.id },
          }),
        )
        return { soldier, identity, accountId }
      }

      it('leaves a revoked soldier to review, even with a matching invite email (D-157)', async () => {
        const soldier = await rosterSoldier({
          private: { personal_id: '7654321', invite_email: 'asker@example.test', phone: null },
        })
        const { identity, result } = await asks({ claimed_personal_id: '7654321' })
        expect(result).toEqual({ outcome: 'linked' })
        harnessOf().signIn(owner)
        const [account] = valueOf(await adapter().repositories.soldier_accounts.list({ soldier_ids: [soldier.id] }))
        if (account === undefined) throw new Error('no account was linked')
        valueOf(await adapter().commands.accounts.revokeLink({ id: account.id }))
        harnessOf().signIn(identity)
        const again = valueOf(await adapter().commands.accounts.requestLink(requestInput({ claimed_personal_id: '7654321' })))
        expect(again).toEqual({ outcome: 'pending_review' })
      })

      it('ends the link, keeps the row, and makes the soldier a candidate again (D-156)', async () => {
        const { soldier, identity, accountId } = await linkedSoldier()
        const revoked = valueOf(await adapter().commands.accounts.revokeLink({ id: accountId }))
        expect(revoked).toMatchObject({ revoked_at: NOW, revoked_by: ownerId })
        expect(issuesOf(await adapter().commands.accounts.revokeLink({ id: accountId }))).toEqual([
          { path: [], code: 'invalid_transition' },
        ])
        harnessOf().signIn(identity)
        expect(valueOf(await adapter().session.current()).status).toBe('unlinked')
        const again = requestInput()
        expect(valueOf(await adapter().commands.accounts.requestLink(again)).outcome).toBe('pending_review')
        harnessOf().signIn(owner)
        expect(valueOf(await adapter().repositories.account_link_requests.candidates(again.id))).toEqual([
          { soldier_id: soldier.id, match: 'name' },
        ])
        const relinked = await adapter().commands.accounts.reviewLink({
          id: again.id,
          resolution: { kind: 'link', account_id: newAccountId(), soldier_id: soldier.id },
        })
        expect(valueOf(relinked).status).toBe('approved')
      })

      it('never revokes the own account', async () => {
        harnessOf().signIn(owner)
        const [account] = valueOf(await adapter().repositories.soldier_accounts.list({ soldier_ids: [ownerId] }))
        if (account === undefined) throw new Error('the owner has no account')
        expect(errorOf(await adapter().commands.accounts.revokeLink({ id: account.id })).code).toBe('forbidden')
      })

      it('answers not_found without accounts:view and forbidden without accounts:approve', async () => {
        const { accountId } = await linkedSoldier()
        const blind = await seedActor(harnessOf(), organization, [], { anchor_type: 'organization' })
        harnessOf().signIn(blind.identity)
        expect(errorOf(await adapter().commands.accounts.revokeLink({ id: accountId })).code).toBe('not_found')
        expect(valueOf(await adapter().repositories.soldier_accounts.list({ soldier_ids: null }))).toEqual([])
        const viewer = await seedActor(harnessOf(), organization, [VIEW_ACCOUNTS], { anchor_type: 'organization' })
        harnessOf().signIn(viewer.identity)
        expect(errorOf(await adapter().commands.accounts.revokeLink({ id: accountId })).code).toBe('forbidden')
      })
    })
  })
}
