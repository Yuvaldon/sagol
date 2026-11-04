import { z } from 'zod'
import { AuthUserId, OrganizationId, SoldierId } from '../common/ids'
import type { AsyncResult, Unsubscribe } from '../common/result'
import { Email, label } from '../common/scalars'
import { AccountLinkRequest } from '../entities/accounts'
import { IdentityProvider } from '../enums'

// Authentication and session contracts (D-005, D-006, D-048).

/**
 * The active identity provider of a build. Same vocabulary as `soldier_accounts.provider`,
 * which records the provider that issued an identity: one list, two uses (D-048).
 */
export const AuthMode = IdentityProvider
export type AuthMode = IdentityProvider

/** Auth modes a production build refuses (D-006). */
export const DEVELOPMENT_ONLY_AUTH_MODES = ['local'] as const satisfies readonly AuthMode[]

/** Which data adapter the app constructs (`local` = IndexedDB, D-021; `remote` = phase 8). */
export const DataAdapterMode = z.enum(['local', 'remote'])
export type DataAdapterMode = z.infer<typeof DataAdapterMode>

/** A signed-in identity as the provider reports it. Not yet resolved to a soldier. */
export const AuthIdentity = z.object({
  auth_user_id: AuthUserId,
  provider: AuthMode,
  email: Email,
  /** Auto-link and bootstrap require a verified email (D-005). */
  email_verified: z.boolean(),
  display_name: z.string().nullable(),
})
export type AuthIdentity = z.infer<typeof AuthIdentity>

/** Who is signed in, as the data adapter receives it. It never accepts an actor id (D-008). */
export interface IdentitySource {
  current(): AuthIdentity | null
  subscribe(listener: (identity: AuthIdentity | null) => void): Unsubscribe
}

/** Google sign-in (production, phase 8). */
export interface GoogleAuthProvider extends IdentitySource {
  readonly mode: 'google'
  signIn(): AsyncResult<AuthIdentity>
  signOut(): AsyncResult<null>
}

/** A development identity for the local provider (D-006). */
export const LocalIdentityRequest = z.strictObject({
  email: Email,
  display_name: label(100).nullable(),
})
export type LocalIdentityRequest = z.infer<typeof LocalIdentityRequest>

/**
 * Local identity provider (development only, D-006). Signing in as another identity is the
 * dev identity switcher; it changes WHO acts, never what the policy allows.
 */
export interface LocalAuthProvider extends IdentitySource {
  readonly mode: 'local'
  signInAs(request: LocalIdentityRequest): AsyncResult<AuthIdentity>
  /** Identities that signed in on this device, for the switcher. */
  listIdentities(): AsyncResult<AuthIdentity[]>
  signOut(): AsyncResult<null>
}

export type AuthProvider = GoogleAuthProvider | LocalAuthProvider

export const SessionStatus = z.enum(['signed_out', 'unlinked', 'linked'])
export type SessionStatus = z.infer<typeof SessionStatus>

/**
 * The session resolved by the data adapter from the identity (server-authoritative, D-008).
 * `unlinked`: signed in, no soldier account yet (onboarding or bootstrap); sees no data.
 */
export const Session = z.discriminatedUnion('status', [
  z.object({ status: z.literal('signed_out') }),
  z.object({ status: z.literal('unlinked'), identity: AuthIdentity }),
  z.object({
    status: z.literal('linked'),
    identity: AuthIdentity,
    soldier_id: SoldierId,
    organization_id: OrganizationId,
  }),
])
export type Session = z.infer<typeof Session>

/**
 * What an unlinked identity may do next. `bootstrap_available` is true only for the identity
 * allowed to claim an empty organization (D-005), so it reveals nothing to anyone else.
 */
export const OnboardingState = z.object({
  bootstrap_available: z.boolean(),
  /** The identity's own pending request, if any. Never says whether a match exists. */
  open_request: AccountLinkRequest.nullable(),
})
export type OnboardingState = z.infer<typeof OnboardingState>

/** Session reads of the data adapter. */
export interface SessionService {
  current(): AsyncResult<Session>
  /** Only for `unlinked` sessions; otherwise `forbidden`. */
  onboardingState(): AsyncResult<OnboardingState>
  /** Fires when the identity changes or the identity's account link changes. */
  subscribe(listener: (session: Session) => void): Unsubscribe
}
