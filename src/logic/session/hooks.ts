import type {
  AuthIdentity,
  AuthMode,
  LocalIdentityRequest,
  OnboardingState,
  Organization,
  Result,
  Session,
} from '@contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toBootstrapInput, type ClaimOrganizationValues } from '../organization/claim'
import { QUERY_KEYS } from '../queries/client'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'

// Hooks the UI reads the session through.

export function useSession(): Loaded<Session> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.session,
      queryFn: () => unwrap(data.session.current()),
    }),
  )
}

/** Only an `unlinked` session asks; the adapter refuses anyone else. */
export function useOnboarding(): Loaded<OnboardingState> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.onboarding,
      queryFn: () => unwrap(data.session.onboardingState()),
    }),
  )
}

/** The session's organization. NULL when the actor may not view it (`not_found`, D-046). */
export function useCurrentOrganization(): Loaded<Organization | null> {
  const { data } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.organization,
      queryFn: async () => {
        const result = await data.repositories.organizations.current()
        if (!result.ok && result.error.code === 'not_found') return null
        return unwrap(Promise.resolve(result))
      },
    }),
  )
}

/** Which provider signs people in: the sign-in screen and the menu follow it (D-207). */
export function useAuthMode(): AuthMode {
  return usePorts().auth.mode
}

const NOT_THIS_PROVIDER: Result<never> = { ok: false, error: { code: 'forbidden' } }

/**
 * Identities that signed in on this device, for the dev switcher (D-006, D-048). Local mode only:
 * the screens show the switcher in no other mode, and another provider answers `forbidden`.
 */
export function useKnownIdentities(): Loaded<readonly AuthIdentity[]> {
  const { auth } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.identities,
      queryFn: () => unwrap(auth.mode === 'local' ? auth.listIdentities() : Promise.resolve(NOT_THIS_PROVIDER)),
    }),
  )
}

/** Signing in as a development identity (D-006). Local mode only, like the switcher. */
export function useSignIn() {
  const { auth } = usePorts()
  const mutation = useMutation({
    mutationFn: (request: LocalIdentityRequest): Promise<Result<AuthIdentity>> =>
      auth.mode === 'local' ? auth.signInAs(request) : Promise.resolve(NOT_THIS_PROVIDER),
  })
  return { signIn: mutation.mutateAsync, isPending: mutation.isPending }
}

/**
 * Starts Google's sign-in (D-207). It answers once the redirect has started; the page then leaves,
 * and the session follows the identity when the browser returns.
 */
export function useGoogleSignIn() {
  const { auth } = usePorts()
  const mutation = useMutation({
    mutationFn: (): Promise<Result<null>> => (auth.mode === 'google' ? auth.signIn() : Promise.resolve(NOT_THIS_PROVIDER)),
  })
  return { signIn: mutation.mutateAsync, isPending: mutation.isPending }
}

export function useSignOut() {
  const { auth } = usePorts()
  const mutation = useMutation({ mutationFn: (): Promise<Result<null>> => auth.signOut() })
  return { signOut: mutation.mutateAsync, isPending: mutation.isPending }
}

export function useClaimOrganization() {
  const { data } = usePorts()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: ClaimOrganizationValues): Promise<Result<Session>> =>
      data.commands.organizations.bootstrapOwner(toBootstrapInput(values)),
    onSuccess: (result) => {
      if (result.ok) client.setQueryData(QUERY_KEYS.session, result.value)
    },
  })
  return { claim: mutation.mutateAsync, isPending: mutation.isPending }
}
