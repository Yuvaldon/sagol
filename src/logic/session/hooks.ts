import type {
  AppError,
  AuthIdentity,
  LocalIdentityRequest,
  OnboardingState,
  Organization,
  Result,
  Session,
} from '@contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toBootstrapInput, type ClaimOrganizationValues } from '../organization/claim'
import { QUERY_KEYS } from '../queries/client'
import { appErrorOf, unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'

// Hooks the UI reads the session through. Each read answers `loading`, `failed` with a stable
// error code the UI maps to i18n (D-046), or `ready`.

export type Loaded<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: AppError }
  | { readonly status: 'ready'; readonly value: T }

interface QueryState<T> {
  readonly isPending: boolean
  readonly isError: boolean
  readonly error: unknown
  readonly data: T | undefined
}

function loaded<T>(query: QueryState<T>): Loaded<T> {
  if (query.data !== undefined) return { status: 'ready', value: query.data }
  if (query.isError) return { status: 'failed', error: appErrorOf(query.error) }
  return { status: 'loading' }
}

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

/** Identities that signed in on this device, for the dev switcher (D-006, D-048). */
export function useKnownIdentities(): Loaded<readonly AuthIdentity[]> {
  const { auth } = usePorts()
  return loaded(
    useQuery({
      queryKey: QUERY_KEYS.identities,
      queryFn: () => unwrap(auth.listIdentities()),
    }),
  )
}

export function useSignIn() {
  const { auth } = usePorts()
  const mutation = useMutation({
    mutationFn: (request: LocalIdentityRequest): Promise<Result<AuthIdentity>> => auth.signInAs(request),
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
