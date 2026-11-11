import {
  AuthUserId,
  OrganizationId,
  LocalIdentityRequest,
  SoldierId,
  type AppError,
  type AuthIdentity,
  type DataChange,
  type Organization,
  type Result,
  type Session,
} from '@contracts'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { claimIssues, timeZoneChoices, toBootstrapInput } from '../organization/claim'
import { fieldNameOf, formIssues } from '../forms/issues'
import { fakePorts as portsOf, wrapperOf } from '../testing/ports'
import {
  useClaimOrganization,
  useCurrentOrganization,
  useKnownIdentities,
  useOnboarding,
  useSession,
} from './hooks'

const IDENTITY: AuthIdentity = {
  auth_user_id: AuthUserId.parse('11111111-1111-4111-8111-111111111111'),
  provider: 'local',
  email: 'owner@example.test',
  email_verified: true,
  display_name: null,
}

const LINKED: Session = {
  status: 'linked',
  identity: IDENTITY,
  soldier_id: SoldierId.parse('22222222-2222-4222-8222-222222222222'),
  organization_id: OrganizationId.parse('33333333-3333-4333-8333-333333333333'),
}

const ORGANIZATION = { name: 'Company' } as Organization

/** Ports whose answers the test controls, and whose subscriptions it can fire. */
function fakePorts(initial: { session: Session; organization?: Result<Organization> }) {
  let session = initial.session
  let organization: Result<Organization> = initial.organization ?? { ok: true, value: ORGANIZATION }
  let sessionListener: ((next: Session) => void) | null = null
  let changeListener: ((changes: readonly DataChange[]) => void) | null = null
  const organizationReads = vi.fn(() => Promise.resolve(organization))
  const bootstrapOwner = vi.fn(() => Promise.resolve<Result<Session>>({ ok: true, value: LINKED }))
  // Only what these tests read: the unit groups have their own fakes.
  const ports = portsOf({
    session: {
      current: () => Promise.resolve({ ok: true, value: session }),
      onboardingState: () => Promise.resolve({ ok: true, value: { bootstrap_available: true, open_request: null } }),
      subscribe(listener: (next: Session) => void) {
        sessionListener = listener
        return () => {
          sessionListener = null
        }
      },
    },
    repositories: { organizations: { current: organizationReads } },
    commands: { organizations: { bootstrapOwner } },
    changes: {
      subscribe(listener: (changes: readonly DataChange[]) => void) {
        changeListener = listener
        return () => {
          changeListener = null
        }
      },
    },
    auth: {
      mode: 'local',
      current: () => IDENTITY,
      subscribe: () => () => undefined,
      signInAs: () => Promise.resolve({ ok: true, value: IDENTITY }),
      listIdentities: () => Promise.resolve({ ok: true, value: [IDENTITY] }),
      signOut: () => Promise.resolve({ ok: true, value: null }),
    },
  })
  return {
    ports,
    organizationReads,
    bootstrapOwner,
    setOrganization(next: Result<Organization>) {
      organization = next
    },
    fireSession(next: Session) {
      session = next
      sessionListener?.(next)
    },
    fireChanges(changes: readonly DataChange[]) {
      changeListener?.(changes)
    },
  }
}

function failure(error: AppError): Result<Organization> {
  return { ok: false, error }
}

describe('session hooks', () => {
  it('answers loading, then the session', async () => {
    const fake = fakePorts({ session: LINKED })
    const { result } = renderHook(() => useSession(), { wrapper: wrapperOf(fake.ports) })
    expect(result.current.status).toBe('loading')
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: LINKED })
    })
  })

  it('follows the session subscription', async () => {
    const fake = fakePorts({ session: { status: 'signed_out' } })
    const { result } = renderHook(() => useSession(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: { status: 'signed_out' } })
    })
    act(() => {
      fake.fireSession(LINKED)
    })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: LINKED })
    })
  })

  it('answers NULL when the organization is not visible (D-046)', async () => {
    const fake = fakePorts({ session: LINKED, organization: failure({ code: 'not_found' }) })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: null })
    })
  })

  it('hands the UI the error code of any other refusal', async () => {
    const fake = fakePorts({ session: LINKED, organization: failure({ code: 'unavailable' }) })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'failed', error: { code: 'unavailable' } })
    })
  })

  it('re-reads a table when the change feed names it, and only then', async () => {
    const fake = fakePorts({ session: LINKED })
    const { result } = renderHook(() => useCurrentOrganization(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    expect(fake.organizationReads).toHaveBeenCalledTimes(1)

    act(() => {
      fake.fireChanges([{ table: 'tags', ids: [] }])
    })
    expect(fake.organizationReads).toHaveBeenCalledTimes(1)

    fake.setOrganization({ ok: true, value: { ...ORGANIZATION, name: 'Renamed' } })
    act(() => {
      fake.fireChanges([{ table: 'organizations', ids: [] }])
    })
    await waitFor(() => {
      expect(result.current).toMatchObject({ status: 'ready', value: { name: 'Renamed' } })
    })
  })

  it("forgets one identity's data when another identity takes over", async () => {
    const fake = fakePorts({ session: LINKED })
    const other: Session = {
      status: 'unlinked',
      identity: { ...IDENTITY, auth_user_id: AuthUserId.parse('44444444-4444-4444-8444-444444444444') },
    }
    function Probe() {
      const session = useSession()
      const organization = useCurrentOrganization()
      const linked = session.status === 'ready' && session.value.status === 'linked'
      return <p>{linked && organization.status === 'ready' ? organization.value?.name : 'nothing'}</p>
    }
    const view = render(<Probe />, { wrapper: wrapperOf(fake.ports) })
    await screen.findByText('Company')
    fake.setOrganization(failure({ code: 'account_not_linked' }))
    act(() => {
      fake.fireSession(other)
    })
    await screen.findByText('nothing')
    expect(view.container.textContent).not.toContain('Company')
  })

  it('reads onboarding and known identities through the ports', async () => {
    const fake = fakePorts({ session: { status: 'unlinked', identity: IDENTITY } })
    const onboarding = renderHook(() => useOnboarding(), { wrapper: wrapperOf(fake.ports) })
    const identities = renderHook(() => useKnownIdentities(), { wrapper: wrapperOf(fake.ports) })
    await waitFor(() => {
      expect(onboarding.result.current).toMatchObject({ status: 'ready', value: { bootstrap_available: true } })
      expect(identities.result.current).toEqual({ status: 'ready', value: [IDENTITY] })
    })
  })

  it('moves the cache to the new session after a claim, without waiting for the feed', async () => {
    const fake = fakePorts({ session: { status: 'unlinked', identity: IDENTITY } })
    const { result } = renderHook(() => ({ claim: useClaimOrganization(), session: useSession() }), {
      wrapper: wrapperOf(fake.ports),
    })
    await waitFor(() => {
      expect(result.current.session.status).toBe('ready')
    })
    await act(async () => {
      await result.current.claim.claim({
        organization: { name: 'Company', timezone: 'UTC' },
        soldier: { first_name: 'Dana', last_name: 'Levi' },
        owner_role_name: 'Owner',
      })
    })
    expect(fake.bootstrapOwner).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(result.current.session).toEqual({ status: 'ready', value: LINKED })
    })
  })
})

describe('claiming an organization', () => {
  const values = {
    organization: { name: 'Company', timezone: 'Asia/Jerusalem' },
    soldier: { first_name: 'Dana', last_name: 'Levi' },
    owner_role_name: 'Owner',
  }

  it('generates new ids on the caller side (D-044)', () => {
    const first = toBootstrapInput(values)
    const second = toBootstrapInput(values)
    expect(first.organization.id).not.toBe(second.organization.id)
    expect(first.soldier.id).not.toBe(second.soldier.id)
    expect(first.account_id).not.toBe(second.account_id)
  })

  it('reports nothing for valid values', () => {
    expect(claimIssues(values)).toEqual([])
  })

  it('reports the same codes as the adapter (D-068, OI-024)', () => {
    const issues = claimIssues({
      ...values,
      organization: { name: '  ', timezone: 'Asia/Jerusalem' },
      soldier: { first_name: '', last_name: 'Levi' },
    })
    expect(issues).toEqual([
      { path: ['organization', 'name'], code: 'required' },
      { path: ['soldier', 'first_name'], code: 'required' },
    ])
    expect(issues.map(fieldNameOf)).toEqual(['organization.name', 'soldier.first_name'])
  })

  it('reports an unknown time zone (D-084)', () => {
    expect(claimIssues({ ...values, organization: { name: 'Company', timezone: 'Mars/Olympus' } })).toEqual([
      { path: ['organization', 'timezone'], code: 'invalid_value' },
    ])
  })

  it('offers valid zones, with the device zone among them (D-086)', () => {
    const { device, zones } = timeZoneChoices()
    expect(zones).toContain(device)
    expect(zones.length).toBeGreaterThan(100)
    expect(new Set(zones).size).toBe(zones.length)
  })
})

describe('form issues', () => {
  it('uses the contract schema', () => {
    expect(formIssues(LocalIdentityRequest, { email: 'a@example.test', display_name: null })).toEqual([])
    expect(formIssues(LocalIdentityRequest, { email: 'nope', display_name: null })).toEqual([
      { path: ['email'], code: 'invalid_format' },
    ])
  })
})
