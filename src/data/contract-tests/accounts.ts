import {
  AccountLinkRequestId,
  AuthUserId,
  SoldierAccountId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type AccountLinkRequest,
  type AuthIdentity,
  type DataChange,
  type OrganizationId,
  type Permission,
  type RequestAccountLinkInput,
  type ReviewAccountLinkInput,
} from '@contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from './harness'
import { NOW, PAST_DATE, errorOf, issuesOf, seedActor, valueOf } from './support'

// Account linking against the shared contract (D-148, D-149): asking, auto-link, withdrawing and reviewing, with the denial
// paths through seeded grants (D-076). Sample data, test files only.

const APPROVE: Permission = { resource: 'accounts', action: 'approve' }
const VIEW_SOLDIERS: Permission = { resource: 'soldiers', action: 'view' }
const VIEW_UNITS: Permission = { resource: 'units', action: 'view' }

function stranger(email: string, overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    auth_user_id: AuthUserId.parse(crypto.randomUUID()),
    provider: 'local',
    email,
    email_verified: true,
    display_name: null,
    ...overrides,
  }
}

function askInput(overrides: Partial<RequestAccountLinkInput> = {}): RequestAccountLinkInput {
  return {
    id: AccountLinkRequestId.parse(crypto.randomUUID()),
    account_id: SoldierAccountId.parse(crypto.randomUUID()),
    claimed_personal_id: null,
    first_name: 'Asher',
    last_name: 'Peretz',
    ...overrides,
  }
}

const newAccountId = () => SoldierAccountId.parse(crypto.randomUUID())

export function describeAccountContract(
  harnessOf: () => ContractHarness,
  claim: () => Promise<{ input: { organization: { id: OrganizationId }; soldier: { id: SoldierId }; root_unit_id: UnitId }; owner: AuthIdentity }>,
): void {
  const harness = () => harnessOf()
  const adapter = () => harnessOf().adapter

  describe('account linking', () => {
    it('answers not_found while no organization exists', async () => {
      harness().signIn(stranger('first@example.test'))
      expect(errorOf(await adapter().commands.accounts.requestLink(askInput())).code).toBe('not_found')
    })

    describe('in a claimed organization', () => {
      let organization: OrganizationId
      let root: UnitId
      let ownerId: SoldierId
      let owner: AuthIdentity
      let unitId: UnitId

      beforeEach(async () => {
        const claimed = await claim()
        organization = claimed.input.organization.id
        root = claimed.input.root_unit_id
        ownerId = claimed.input.soldier.id
        owner = claimed.owner
        unitId = valueOf(
          await adapter().commands.units.create({
            id: UnitId.parse(crypto.randomUUID()),
            parent_id: root,
            sort_order: 0,
            name: 'Platoon A',
            code: null,
            unit_level_id: null,
            kind: 'standing',
            valid_from: null,
            valid_to: null,
            color_key: null,
            properties: {},
          }),
        ).id
      })

      /** A soldier the owner adds, optionally with a number and an invite email, placed in the unit or not. */
      async function addSoldier(
        first_name: string,
        last_name: string,
        privateFields: { personal_id: string | null; invite_email: string | null } | null = null,
        placed = true,
      ) {
        const id = SoldierId.parse(crypto.randomUUID())
        harness().signIn(owner)
        valueOf(
          await adapter().commands.soldiers.create({
            id,
            first_name,
            last_name,
            nickname: null,
            command_rank_id: null,
            status: 'active',
            properties: {},
            private: privateFields === null ? null : { ...privateFields, phone: null },
            membership: placed ? { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unitId, valid_from: PAST_DATE } : null,
          }),
        )
        return id
      }

      async function ask(identity: AuthIdentity, overrides: Partial<RequestAccountLinkInput> = {}) {
        harness().signIn(identity)
        const input = askInput(overrides)
        const result = await adapter().commands.accounts.requestLink(input)
        return { input, result }
      }

      async function review(reviewer: AuthIdentity, id: AccountLinkRequest['id'], resolution: ReviewAccountLinkInput['resolution']) {
        harness().signIn(reviewer)
        return adapter().commands.accounts.reviewLink({ id, resolution })
      }

      async function pendingOf(reviewer: AuthIdentity) {
        harness().signIn(reviewer)
        return valueOf(await adapter().repositories.account_link_requests.list({ statuses: ['pending'] }))
      }

      async function unitReviewer() {
        const reviewer = await seedActor(harness(), organization, [APPROVE, VIEW_SOLDIERS, VIEW_UNITS], {
          anchor_type: 'unit',
          anchor_unit_id: unitId,
          include_descendants: true,
        }, unitId)
        return reviewer
      }

      describe('asking', () => {
        it('writes a pending request with the number normalized, and says only that it is pending (D-148)', async () => {
          const asker = stranger('asker@example.test')
          const { input, result } = await ask(asker, { claimed_personal_id: '0123-456' })
          expect(valueOf(result)).toEqual({ outcome: 'pending_review' })
          const rows = await harness().rows('account_link_requests')
          expect(rows).toEqual([
            expect.objectContaining({
              id: input.id,
              organization_id: organization,
              auth_user_id: asker.auth_user_id,
              email: asker.email,
              claimed_personal_id: '123456',
              status: 'pending',
              resolved_soldier_id: null,
              reviewed_by: null,
            }),
          ])
          expect(valueOf(await adapter().session.onboardingState()).open_request).toEqual(rows[0])
          expect(await harness().rows('soldier_accounts')).toHaveLength(1)
        })

        it('refuses a second request while one is pending, a linked identity, and a signed-out caller', async () => {
          const asker = stranger('asker@example.test')
          valueOf((await ask(asker)).result)
          expect(issuesOf((await ask(asker)).result)).toEqual([{ path: ['id'], code: 'already_exists' }])
          harness().signIn(owner)
          expect(errorOf(await adapter().commands.accounts.requestLink(askInput())).code).toBe('forbidden')
          harness().signIn(null)
          expect(errorOf(await adapter().commands.accounts.requestLink(askInput())).code).toBe('unauthenticated')
          expect(await harness().rows('account_link_requests')).toHaveLength(1)
        })

        it('rejects a blank name and an unknown field (D-068)', async () => {
          harness().signIn(stranger('asker@example.test'))
          expect(issuesOf(await adapter().commands.accounts.requestLink(askInput({ first_name: '  ' })))).toEqual([
            { path: ['first_name'], code: 'required' },
          ])
          const extra = { ...askInput(), organization_id: organization } as unknown as RequestAccountLinkInput
          expect(issuesOf(await adapter().commands.accounts.requestLink(extra))).toEqual([
            { path: ['organization_id'], code: 'unknown_field' },
          ])
          expect(await harness().rows('account_link_requests')).toEqual([])
        })
      })

      describe('auto-link', () => {
        it('links on the personal number and the verified invite email, and keeps the claim (D-005, D-148)', async () => {
          const soldier = await addSoldier('Dana', 'Levi', { personal_id: '12345', invite_email: 'Dana@Example.test' })
          const asker = stranger('dana@example.test')
          const { input, result } = await ask(asker, { claimed_personal_id: '0-12345', first_name: 'Dana', last_name: 'Levi' })
          expect(valueOf(result)).toEqual({ outcome: 'linked' })
          expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldier, organization_id: organization })
          const account = (await harness().rows('soldier_accounts')).find((row) => row.soldier_id === soldier)
          expect(account).toMatchObject({ auth_user_id: asker.auth_user_id, provider: 'local', linked_by: null, revoked_at: null })
          expect((await harness().rows('account_link_requests'))[0]).toMatchObject({
            id: input.id,
            status: 'approved',
            resolved_soldier_id: soldier,
            reviewed_by: null,
          })
        })

        it('answers the same without a match, with a wrong email or with an unverified one', async () => {
          await addSoldier('Dana', 'Levi', { personal_id: '12345', invite_email: 'dana@example.test' })
          const cases: [AuthIdentity, string | null][] = [
            [stranger('dana@example.test', { email_verified: false }), '12345'],
            [stranger('other@example.test'), '12345'],
            [stranger('dana@example.test'), '99999'],
            [stranger('dana@example.test'), null],
          ]
          for (const [identity, claimed] of cases) {
            const { result } = await ask(identity, { claimed_personal_id: claimed })
            expect(valueOf(result)).toEqual({ outcome: 'pending_review' })
          }
          expect(await harness().rows('soldier_accounts')).toHaveLength(1)
        })
      })

      describe('withdrawing', () => {
        it("lets the asker cancel their own pending request once, and ask again after", async () => {
          const asker = stranger('asker@example.test')
          const { input } = await ask(asker)
          harness().signIn(stranger('other@example.test'))
          expect(errorOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id })).code).toBe('not_found')
          harness().signIn(asker)
          expect(valueOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id }))).toMatchObject({ id: input.id, status: 'cancelled' })
          expect(valueOf(await adapter().session.onboardingState()).open_request).toBeNull()
          expect(issuesOf(await adapter().commands.accounts.cancelLinkRequest({ id: input.id }))).toEqual([
            { path: [], code: 'invalid_transition' },
          ])
          expect(valueOf(await adapter().commands.accounts.requestLink(askInput()))).toEqual({ outcome: 'pending_review' })
        })
      })

      describe('reading requests', () => {
        it('shows an organization reviewer every request, with candidates in the order of D-066', async () => {
          const byId = await addSoldier('Someone', 'Else', { personal_id: '777', invite_email: null })
          const byName = await addSoldier('Asher', 'Peretz')
          const { input } = await ask(stranger('asker@example.test'), { claimed_personal_id: '777' })
          harness().signIn(owner)
          const listed = valueOf(await adapter().repositories.account_link_requests.list({ statuses: null }))
          expect(listed.map((row) => row.id)).toEqual([input.id])
          expect(valueOf(await adapter().repositories.account_link_requests.get(input.id)).id).toBe(input.id)
          expect(valueOf(await adapter().repositories.account_link_requests.candidates(input.id))).toEqual([
            { soldier_id: byId, match: 'personal_id' },
            { soldier_id: byName, match: 'name' },
          ])
        })

        it('shows a unit reviewer only requests with a candidate they approve, and only those candidates (D-149)', async () => {
          const inside = await addSoldier('Asher', 'Peretz')
          await addSoldier('Asher', 'Peretz', null, false)
          const { input: matching } = await ask(stranger('a@example.test'))
          await ask(stranger('b@example.test'), { first_name: 'Nobody', last_name: 'Known' })
          const { identity } = await unitReviewer()
          harness().signIn(identity)
          expect((await pendingOf(identity)).map((row) => row.id)).toEqual([matching.id])
          expect(valueOf(await adapter().repositories.account_link_requests.candidates(matching.id))).toEqual([
            { soldier_id: inside, match: 'name' },
          ])
        })

        it('shows nothing to an identity without the permission, and a request it may not read is not_found (D-046)', async () => {
          await addSoldier('Asher', 'Peretz')
          const { input } = await ask(stranger('a@example.test'))
          const nobody = await seedActor(harness(), organization, [VIEW_SOLDIERS], { anchor_type: 'organization' })
          harness().signIn(nobody.identity)
          expect(valueOf(await adapter().repositories.account_link_requests.list({ statuses: null }))).toEqual([])
          expect(errorOf(await adapter().repositories.account_link_requests.get(input.id)).code).toBe('not_found')
          expect(errorOf(await adapter().repositories.account_link_requests.candidates(input.id)).code).toBe('not_found')
          harness().signIn(stranger('c@example.test'))
          expect(errorOf(await adapter().repositories.account_link_requests.list({ statuses: null })).code).toBe('account_not_linked')
        })

        it('shows a request with no candidates to organization-scope reviewers only', async () => {
          const { input } = await ask(stranger('a@example.test'), { first_name: 'Nobody', last_name: 'Known' })
          const { identity } = await unitReviewer()
          expect(await pendingOf(identity)).toEqual([])
          expect((await pendingOf(owner)).map((row) => row.id)).toEqual([input.id])
        })
      })

      describe('reviewing: link', () => {
        it('links the identity to a candidate, fills the missing number, and lets the identity in (D-149)', async () => {
          const soldier = await addSoldier('Asher', 'Peretz')
          const asker = stranger('asker@example.test')
          const { input } = await ask(asker, { claimed_personal_id: '0-555' })
          const accountId = newAccountId()
          const row = valueOf(await review(owner, input.id, { kind: 'link', account_id: accountId, soldier_id: soldier }))
          expect(row).toMatchObject({ status: 'approved', resolved_soldier_id: soldier, reviewed_by: ownerId, reviewed_at: NOW })
          expect((await harness().rows('soldier_accounts')).find((account) => account.id === accountId)).toMatchObject({
            auth_user_id: asker.auth_user_id,
            soldier_id: soldier,
            email: asker.email,
            linked_by: ownerId,
            provider: 'local',
          })
          expect((await harness().rows('soldier_private')).find((private_) => private_.soldier_id === soldier)).toMatchObject({
            personal_id: '555',
          })
          harness().signIn(asker)
          expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldier })
          expect(await pendingOf(owner)).toEqual([])
        })

        it('keeps a personal number the soldier has, and skips one another soldier holds', async () => {
          const has = await addSoldier('Asher', 'Peretz', { personal_id: '111', invite_email: null })
          const { input } = await ask(stranger('a@example.test'), { claimed_personal_id: '222' })
          valueOf(await review(owner, input.id, { kind: 'link', account_id: newAccountId(), soldier_id: has }))
          expect((await harness().rows('soldier_private')).find((row) => row.soldier_id === has)?.personal_id).toBe('111')

          const holder = await addSoldier('Holder', 'Of', { personal_id: '333', invite_email: null })
          const free = await addSoldier('Asher', 'Peretz')
          const { input: second } = await ask(stranger('b@example.test'), { claimed_personal_id: '333' })
          harness().signIn(owner)
          const candidates = valueOf(await adapter().repositories.account_link_requests.candidates(second.id))
          expect(candidates.map((candidate) => candidate.soldier_id)).toEqual([holder, free])
          valueOf(await review(owner, second.id, { kind: 'link', account_id: newAccountId(), soldier_id: free }))
          expect((await harness().rows('soldier_private')).find((row) => row.soldier_id === free)).toBeUndefined()
        })

        it('refuses a soldier that is not a candidate, one outside the reviewer, and writes nothing (OI-034)', async () => {
          const inside = await addSoldier('Asher', 'Peretz')
          const outside = await addSoldier('Asher', 'Peretz', null, false)
          const unrelated = await addSoldier('Dan', 'Zohar')
          const { input } = await ask(stranger('a@example.test'))
          const { identity } = await unitReviewer()
          const accounts = (await harness().rows('soldier_accounts')).length
          for (const [reviewer, target] of [
            [identity, outside],
            [identity, unrelated],
            [owner, unrelated],
          ] as const) {
            expect(issuesOf(await review(reviewer, input.id, { kind: 'link', account_id: newAccountId(), soldier_id: target }))).toEqual([
              { path: ['resolution', 'soldier_id'], code: 'reference_not_found' },
            ])
          }
          expect((await harness().rows('soldier_accounts')).length).toBe(accounts)
          expect((await harness().rows('account_link_requests'))[0]?.status).toBe('pending')
          valueOf(await review(identity, input.id, { kind: 'link', account_id: newAccountId(), soldier_id: inside }))
        })

        it('names no linked soldier outside the reviewer: the candidate is checked before the uniques (OI-122)', async () => {
          // A candidate inside the reviewer's scope lets the reviewer read the request at all.
          await addSoldier('Asher', 'Peretz')
          const outside = await addSoldier('Asher', 'Peretz', null, false)
          const { input: first } = await ask(stranger('first@example.test'))
          valueOf(await review(owner, first.id, { kind: 'link', account_id: newAccountId(), soldier_id: outside }))
          const { input } = await ask(stranger('second@example.test'))
          const { identity } = await unitReviewer()
          expect(issuesOf(await review(identity, input.id, { kind: 'link', account_id: newAccountId(), soldier_id: outside }))).toEqual([
            { path: ['resolution', 'soldier_id'], code: 'reference_not_found' },
          ])
        })

        it('refuses a reviewer without the permission, and a request that is no longer pending', async () => {
          const soldier = await addSoldier('Asher', 'Peretz')
          const { input } = await ask(stranger('a@example.test'))
          const nobody = await seedActor(harness(), organization, [VIEW_SOLDIERS], { anchor_type: 'organization' })
          expect(errorOf(await review(nobody.identity, input.id, { kind: 'reject' })).code).toBe('not_found')
          valueOf(await review(owner, input.id, { kind: 'link', account_id: newAccountId(), soldier_id: soldier }))
          expect(issuesOf(await review(owner, input.id, { kind: 'reject' }))).toEqual([{ path: [], code: 'invalid_transition' }])
        })
      })

      describe('reviewing: create a soldier', () => {
        it('creates the soldier from the request with its placement and number, and links the identity', async () => {
          const asker = stranger('asker@example.test')
          const { input } = await ask(asker, { claimed_personal_id: '808', first_name: 'New', last_name: 'Recruit' })
          const soldierId = SoldierId.parse(crypto.randomUUID())
          const membershipId = UnitMembershipId.parse(crypto.randomUUID())
          const row = valueOf(
            await review(owner, input.id, {
              kind: 'create_soldier',
              account_id: newAccountId(),
              soldier_id: soldierId,
              command_rank_id: null,
              membership: { id: membershipId, unit_id: unitId, valid_from: PAST_DATE },
            }),
          )
          expect(row).toMatchObject({ status: 'approved', resolved_soldier_id: soldierId, reviewed_by: ownerId })
          expect((await harness().rows('soldiers')).find((soldier) => soldier.id === soldierId)).toMatchObject({
            first_name: 'New',
            last_name: 'Recruit',
            status: 'active',
            created_by: ownerId,
          })
          expect((await harness().rows('unit_memberships')).find((membership) => membership.id === membershipId)).toMatchObject({
            soldier_id: soldierId,
            unit_id: unitId,
          })
          expect((await harness().rows('soldier_private')).find((private_) => private_.soldier_id === soldierId)?.personal_id).toBe('808')
          harness().signIn(asker)
          expect(valueOf(await adapter().session.current())).toMatchObject({ status: 'linked', soldier_id: soldierId })
        })

        it('needs soldiers:create over the placement, beyond the right to review', async () => {
          const { input } = await ask(stranger('a@example.test'), { first_name: 'Nobody', last_name: 'Known' })
          const approver = await seedActor(harness(), organization, [APPROVE], { anchor_type: 'organization' })
          const create = (soldier: SoldierId, unit: UnitId | null): ReviewAccountLinkInput['resolution'] => ({
            kind: 'create_soldier',
            account_id: newAccountId(),
            soldier_id: soldier,
            command_rank_id: null,
            membership: unit === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: unit, valid_from: PAST_DATE },
          })
          expect(errorOf(await review(approver.identity, input.id, create(SoldierId.parse(crypto.randomUUID()), null))).code).toBe('forbidden')
          expect((await harness().rows('account_link_requests'))[0]?.status).toBe('pending')
        })
      })

      describe('reviewing: reject', () => {
        it('closes the request without an account, and the asker is told when (D-168)', async () => {
          const asker = stranger('asker@example.test')
          const { input } = await ask(asker)
          const accounts = (await harness().rows('soldier_accounts')).length
          const rejected = valueOf(await review(owner, input.id, { kind: 'reject' }))
          expect(rejected).toMatchObject({ status: 'rejected', resolved_soldier_id: null, reviewed_by: ownerId })
          expect((await harness().rows('soldier_accounts')).length).toBe(accounts)
          harness().signIn(asker)
          const state = valueOf(await adapter().session.onboardingState())
          expect(state.open_request).toBeNull()
          expect(state.last_rejected_at).toBe(rejected.reviewed_at)
        })

        it('is not told once a new request is pending', async () => {
          const asker = stranger('again@example.test')
          const { input } = await ask(asker)
          valueOf(await review(owner, input.id, { kind: 'reject' }))
          await ask(asker)
          harness().signIn(asker)
          const state = valueOf(await adapter().session.onboardingState())
          expect(state.open_request).not.toBeNull()
          expect(state.last_rejected_at).toBeNull()
        })
      })

      describe('changes', () => {
        it('announces the request and the account, so the other tabs and the asker refresh', async () => {
          const soldier = await addSoldier('Asher', 'Peretz')
          const { input } = await ask(stranger('a@example.test'))
          const accountId = newAccountId()
          const seen: DataChange[] = []
          const received = new Promise<void>((resolve) => {
            const stop = adapter().changes.subscribe((rows) => {
              seen.push(...rows)
              if (seen.some((change) => change.table === 'soldier_accounts' && change.ids.includes(accountId))) {
                stop()
                resolve()
              }
            })
          })
          valueOf(await review(owner, input.id, { kind: 'link', account_id: accountId, soldier_id: soldier }))
          await received
          expect(seen).toEqual(
            expect.arrayContaining([
              { table: 'account_link_requests', ids: [input.id] },
              { table: 'soldier_accounts', ids: [accountId] },
            ]),
          )
        })
      })
    })
  })
}
