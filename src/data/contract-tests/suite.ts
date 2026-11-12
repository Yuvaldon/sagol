import {
  AccessGrantId,
  UnitId,
  UnitMembershipId,
  AccountLinkRequestId,
  AuthUserId,
  OrganizationId,
  PERMISSION_ACTIONS_BY_RESOURCE,
  RoleId,
  SoldierAccountId,
  SoldierId,
  type AuthIdentity,
  type BootstrapOwnerInput,
  type DataChange,
  type Result,
  type Session,
  type TableName,
  type TableRow,
  type Timestamp,
} from '@contracts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ContractAdapter, ContractHarness } from './harness'
import { describeAccountContract } from './accounts'
import { describeDeploymentContract } from './deployments'
import { describeLeaveContract } from './leaves'
import { describePermissionContract } from './permissions'
import { describePropertyContract } from './properties'
import { describeReportContract } from './reports'
import { describeRosterContract } from './roster'
import { describeRuleContract } from './rules'
import { describeTransferContract } from './transfer'
import { describeTagContract } from './tags'
import { describeUnitContract } from './units'
import { describeLeaveWorkflowContract } from './workflow'

export type { ContractAdapter, ContractHarness } from './harness'

// The shared repository contract suite (D-076). Every adapter passes it: local now, remote in
// row 8.3, which is what makes the switch safe. It grows with each slice. Sample data lives here
// and in the test files that run it, never in production code.


export const CONTRACT_NOW: Timestamp = '2026-11-08T10:00:00.000Z'

/** The identity a server lets claim the empty organization (`BOOTSTRAP_OWNER_EMAIL`, D-005). */
export const CONTRACT_OWNER_EMAIL = 'owner@example.test'

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

/** A valid `bootstrapOwner` input with fresh ids. */
export function bootstrapInput(overrides: Partial<BootstrapOwnerInput> = {}): BootstrapOwnerInput {
  return {
    organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Company', timezone: 'Asia/Jerusalem' },
    soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
    owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
    account_id: SoldierAccountId.parse(crypto.randomUUID()),
    access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
    root_unit_id: UnitId.parse(crypto.randomUUID()),
    membership_id: UnitMembershipId.parse(crypto.randomUUID()),
    ...overrides,
  }
}

function errorOf<T>(result: Result<T>) {
  if (result.ok) throw new Error('expected a refusal')
  return result.error
}

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`)
  return result.value
}

const BOOTSTRAP_WRITES = [
  'organizations',
  'units',
  'unit_memberships',
  'soldiers',
  'soldier_accounts',
  'roles',
  'role_permissions',
  'access_grants',
] as const satisfies readonly TableName[]

export function describeAdapterContract(name: string, createHarness: () => Promise<ContractHarness>): void {
  describe(`${name}: data adapter contract`, () => {
    let harness: ContractHarness
    let adapter: ContractAdapter

    beforeEach(async () => {
      harness = await createHarness()
      adapter = harness.adapter
    })

    afterEach(async () => {
      await harness.dispose()
    })

    async function expectNothingWritten() {
      for (const table of BOOTSTRAP_WRITES) expect(await harness.rows(table)).toEqual([])
    }

    /** Claims the store as a new owner and returns the identity and input. */
    async function claim() {
      const owner = identityOf(CONTRACT_OWNER_EMAIL)
      const input = bootstrapInput()
      harness.signIn(owner)
      const session = valueOf(await adapter.commands.organizations.bootstrapOwner(input))
      return { owner, input, session }
    }

    /** A second soldier and account in the claimed organization, with no permissions. */
    function secondSoldier(organization_id: OrganizationId, overrides: Partial<TableRow<'soldiers'>> = {}) {
      const soldier: TableRow<'soldiers'> = {
        id: SoldierId.parse(crypto.randomUUID()),
        organization_id,
        first_name: 'Noa',
        last_name: 'Cohen',
        nickname: null,
        command_rank_id: null,
        status: 'active',
        properties: {},
        created_at: CONTRACT_NOW,
        created_by: null,
        updated_at: CONTRACT_NOW,
        updated_by: null,
        version: 1,
        archived_at: null,
        ...overrides,
      }
      const identity = identityOf('noa@example.test')
      const account: TableRow<'soldier_accounts'> = {
        id: SoldierAccountId.parse(crypto.randomUUID()),
        organization_id,
        auth_user_id: identity.auth_user_id,
        soldier_id: soldier.id,
        provider: 'local',
        email: identity.email,
        linked_at: CONTRACT_NOW,
        linked_by: null,
        revoked_at: null,
        revoked_by: null,
      }
      return { soldier, identity, account }
    }

    describe('signed out', () => {
      it('has a signed_out session and no access', async () => {
        harness.signIn(null)
        expect(valueOf(await adapter.session.current())).toEqual({ status: 'signed_out' })
        expect(errorOf(await adapter.session.onboardingState()).code).toBe('unauthenticated')
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('unauthenticated')
      })

      it('cannot bootstrap', async () => {
        harness.signIn(null)
        const result = await adapter.commands.organizations.bootstrapOwner(bootstrapInput())
        expect(errorOf(result).code).toBe('unauthenticated')
        await expectNothingWritten()
      })
    })

    describe('unlinked on an empty store', () => {
      it('may bootstrap, and sees no organization', async () => {
        const identity = identityOf(CONTRACT_OWNER_EMAIL)
        harness.signIn(identity)
        expect(valueOf(await adapter.session.current())).toEqual({ status: 'unlinked', identity })
        expect(valueOf(await adapter.session.onboardingState())).toEqual({
          bootstrap_available: true,
          open_request: null,
          last_rejected_at: null,
        })
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('account_not_linked')
      })

      it('may not bootstrap without a verified email (D-005)', async () => {
        harness.signIn(identityOf(CONTRACT_OWNER_EMAIL, { email_verified: false }))
        expect(valueOf(await adapter.session.onboardingState()).bootstrap_available).toBe(false)
        const result = await adapter.commands.organizations.bootstrapOwner(bootstrapInput())
        expect(errorOf(result).code).toBe('bootstrap_not_allowed')
        await expectNothingWritten()
      })
    })

    describe('bootstrapOwner validation', () => {
      beforeEach(() => {
        harness.signIn(identityOf(CONTRACT_OWNER_EMAIL))
      })

      async function issuesOf(input: unknown) {
        const result = await adapter.commands.organizations.bootstrapOwner(input as BootstrapOwnerInput)
        const error = errorOf(result)
        await expectNothingWritten()
        return error.code === 'validation_failed' ? error.issues : []
      }

      it('rejects an unknown field: the organization of a row is never input (D-045)', async () => {
        const base = bootstrapInput()
        const issues = await issuesOf({ ...base, soldier: { ...base.soldier, organization_id: base.organization.id } })
        expect(issues).toEqual([{ path: ['soldier', 'organization_id'], code: 'unknown_field' }])
      })

      it('reports a blank name as required (D-068)', async () => {
        const base = bootstrapInput()
        const issues = await issuesOf({ ...base, organization: { ...base.organization, name: '   ' } })
        expect(issues).toEqual([{ path: ['organization', 'name'], code: 'required' }])
      })

      it('rejects a time zone the runtime does not know (D-084)', async () => {
        const base = bootstrapInput()
        const issues = await issuesOf({ ...base, organization: { ...base.organization, timezone: 'Mars/Olympus' } })
        expect(issues).toEqual([{ path: ['organization', 'timezone'], code: 'invalid_value' }])
      })
    })

    describe('after bootstrapOwner', () => {
      it('returns the linked session and links the identity', async () => {
        const { owner, input, session } = await claim()
        const linked: Session = {
          status: 'linked',
          identity: owner,
          soldier_id: input.soldier.id,
          organization_id: input.organization.id,
        }
        expect(session).toEqual(linked)
        expect(valueOf(await adapter.session.current())).toEqual(linked)
      })

      it('lets the owner read the organization, through a real grant (D-006)', async () => {
        const { input } = await claim()
        const organization = valueOf(await adapter.repositories.organizations.current())
        expect(organization).toMatchObject({
          id: input.organization.id,
          name: input.organization.name,
          timezone: input.organization.timezone,
          baseline_role_id: null,
          settings: { reschedule_policy: 'keep_if_can_approve' },
          version: 1,
        })
      })

      it('gives the owner role every valid pair at organization scope, without expiry (D-079)', async () => {
        const { input } = await claim()
        const expected = Object.values(PERMISSION_ACTIONS_BY_RESOURCE).flat().length
        const pairs = await harness.rows('role_permissions')
        expect(pairs).toHaveLength(expected)
        expect(pairs.every((pair) => pair.role_id === input.owner_role.id)).toBe(true)
        expect(await harness.rows('access_grants')).toMatchObject([
          {
            id: input.access_grant_id,
            grantee_soldier_id: input.soldier.id,
            role_id: input.owner_role.id,
            anchor_type: 'organization',
            subject_rank_constraint: 'any',
            valid_to: null,
            granted_by: null,
          },
        ])
      })

      it('stamps audit columns from the session and the time source, never from input', async () => {
        const { input } = await claim()
        expect(await harness.rows('soldiers')).toMatchObject([
          { id: input.soldier.id, created_by: input.soldier.id, created_at: CONTRACT_NOW, version: 1, status: 'active' },
        ])
        expect(await harness.rows('soldier_accounts')).toMatchObject([
          { id: input.account_id, linked_at: CONTRACT_NOW, linked_by: null, revoked_at: null },
        ])
      })

      it('publishes the written tables on the change feed', async () => {
        const seen: DataChange[] = []
        const received = new Promise<void>((resolve) => {
          const stop = adapter.changes.subscribe((changes) => {
            seen.push(...changes)
            stop()
            resolve()
          })
        })
        await claim()
        await received
        expect(seen.map((change) => change.table).sort()).toEqual([...BOOTSTRAP_WRITES].sort())
      })

      it('refuses a second bootstrap by anyone, and changes nothing (D-005)', async () => {
        await claim()
        const before = await harness.rows('organizations')

        const other = identityOf('other@example.test')
        harness.signIn(other)
        expect(valueOf(await adapter.session.current())).toEqual({ status: 'unlinked', identity: other })
        expect(valueOf(await adapter.session.onboardingState()).bootstrap_available).toBe(false)
        const result = await adapter.commands.organizations.bootstrapOwner(bootstrapInput())
        expect(errorOf(result).code).toBe('bootstrap_not_allowed')
        expect(await harness.rows('organizations')).toEqual(before)
      })

      it('refuses bootstrap and onboarding to a linked session', async () => {
        await claim()
        expect(errorOf(await adapter.session.onboardingState()).code).toBe('forbidden')
        const result = await adapter.commands.organizations.bootstrapOwner(bootstrapInput())
        expect(errorOf(result).code).toBe('forbidden')
      })

      it('shows an unlinked identity no organization (D-005)', async () => {
        await claim()
        harness.signIn(identityOf('other@example.test'))
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('account_not_linked')
      })
    })

    describe('denial paths, before their screens exist (D-076)', () => {
      it('answers not_found to a linked soldier without organization:view (D-046, D-056)', async () => {
        const { input } = await claim()
        const { soldier, identity, account } = secondSoldier(input.organization.id)
        await harness.seed('soldiers', [soldier])
        await harness.seed('soldier_accounts', [account])
        harness.signIn(identity)
        expect(valueOf(await adapter.session.current())).toMatchObject({ status: 'linked', soldier_id: soldier.id })
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('not_found')
      })

      it('treats a revoked account as unlinked (D-056)', async () => {
        const { input } = await claim()
        const { soldier, identity, account } = secondSoldier(input.organization.id)
        await harness.seed('soldiers', [soldier])
        await harness.seed('soldier_accounts', [{ ...account, revoked_at: CONTRACT_NOW }])
        harness.signIn(identity)
        expect(valueOf(await adapter.session.current())).toEqual({ status: 'unlinked', identity })
      })

      it('holds no permission once the owner is inactive or the grant is revoked', async () => {
        const { input } = await claim()
        const [grant] = await harness.rows('access_grants')
        if (grant === undefined) throw new Error('bootstrap wrote no grant')
        await harness.seed('access_grants', [{ ...grant, revoked_at: CONTRACT_NOW }])
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('not_found')
        await harness.seed('access_grants', [grant])
        const [owner] = await harness.rows('soldiers')
        if (owner?.id !== input.soldier.id) throw new Error('bootstrap wrote no soldier')
        await harness.seed('soldiers', [{ ...owner, status: 'inactive' }])
        expect(errorOf(await adapter.repositories.organizations.current()).code).toBe('not_found')
      })
    })

    describe('onboarding state', () => {
      it("shows an identity only its own open request, and says nothing about matches (D-030)", async () => {
        const { input } = await claim()
        const asker = identityOf('asker@example.test')
        const stranger = identityOf('stranger@example.test')
        const request: TableRow<'account_link_requests'> = {
          id: AccountLinkRequestId.parse(crypto.randomUUID()),
          organization_id: input.organization.id,
          auth_user_id: asker.auth_user_id,
          email: asker.email,
          claimed_personal_id: null,
          first_name: 'Asher',
          last_name: 'Peretz',
          status: 'pending',
          resolved_soldier_id: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: CONTRACT_NOW,
        }
        await harness.seed('account_link_requests', [request])

        harness.signIn(asker)
        expect(valueOf(await adapter.session.onboardingState())).toEqual({
          bootstrap_available: false,
          open_request: request,
          last_rejected_at: null,
        })
        harness.signIn(stranger)
        expect(valueOf(await adapter.session.onboardingState())).toEqual({
          bootstrap_available: false,
          open_request: null,
          last_rejected_at: null,
        })
      })
    })

    describe('session subscription', () => {
      it('fires when the identity changes', async () => {
        const identity = identityOf(CONTRACT_OWNER_EMAIL)
        const next = new Promise<Session>((resolve) => {
          const stop = adapter.session.subscribe((session) => {
            stop()
            resolve(session)
          })
        })
        harness.signIn(identity)
        expect(await next).toEqual({ status: 'unlinked', identity })
      })
    })

    describeUnitContract(() => harness, () => claim())
    describeRosterContract(() => harness, () => claim())
    describeTagContract(() => harness, () => claim())
    describeAccountContract(() => harness, () => claim())
    describeLeaveContract(() => harness, () => claim())
    describeLeaveWorkflowContract(() => harness, () => claim())
    describeRuleContract(() => harness, () => claim())
    describePermissionContract(() => harness, () => claim())
    describeTransferContract(() => harness, () => claim())
    describePropertyContract(() => harness, () => claim())
    describeDeploymentContract(() => harness, () => claim())
    describeReportContract(() => harness, () => claim())
  })
}
