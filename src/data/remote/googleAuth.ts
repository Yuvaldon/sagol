import { REMOTE, STORAGE_KEYS } from '@config'
import type { AsyncResult, AuthIdentity, GoogleAuthProvider, Result } from '@contracts'
import { identityOfSupabaseUser } from '../server/supabaseIdentity'

// Google sign-in through Supabase Auth (D-207). The auth client keeps the session, refreshes its
// token and finishes the OAuth redirect (PKCE); this module only reads the user from it, exactly
// as the server does, and hands the remote adapter each request's access token (OI-020).

/** The session fields read here, as the auth client reports them. */
interface AuthSession {
  readonly access_token: string
  readonly user: unknown
}

/** The part of Supabase's auth client this provider uses, so tests can drive a fake one. */
export interface SupabaseAuthClient {
  getSession(): Promise<{ data: { session: AuthSession | null }; error: unknown }>
  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
  signInWithOAuth(credentials: { provider: 'google'; options: { redirectTo: string } }): Promise<{ error: unknown }>
  signOut(options: { scope: 'local' }): Promise<{ error: unknown }>
}

export interface GoogleAuth {
  readonly provider: GoogleAuthProvider
  /** The access token of the current session, refreshed by the client; null when signed out. */
  accessToken(): Promise<string | null>
}

export interface GoogleAuthOptions {
  /** Where the OAuth redirect returns: the app's own origin. */
  readonly redirectTo: string
}

const UNAVAILABLE: Result<never> = { ok: false, error: { code: 'unavailable' } }

function sameIdentity(left: AuthIdentity | null, right: AuthIdentity | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Builds the provider once the client has read its session, which includes exchanging the code of
 * a returning redirect. A session whose user is not a Google identity is ended, never shown.
 */
export async function createGoogleAuthProvider(client: SupabaseAuthClient, { redirectTo }: GoogleAuthOptions): Promise<GoogleAuth> {
  const listeners = new Set<(identity: AuthIdentity | null) => void>()
  let identity: AuthIdentity | null = null

  // The client forbids awaiting its own calls inside this callback, so it only records and tells.
  function accept(session: AuthSession | null): void {
    const next = session === null ? null : identityOfSupabaseUser(session.user)
    if (session !== null && next === null) void client.signOut({ scope: 'local' })
    if (sameIdentity(identity, next)) return
    identity = next
    for (const listener of [...listeners]) listener(next)
  }

  const initial = await client.getSession().catch(() => null)
  accept(initial?.data.session ?? null)
  client.onAuthStateChange((_event, session) => {
    accept(session)
  })

  async function attempt(work: () => Promise<{ error: unknown }>): AsyncResult<null> {
    try {
      const { error } = await work()
      return error === null || error === undefined ? { ok: true, value: null } : UNAVAILABLE
    } catch {
      return UNAVAILABLE
    }
  }

  const provider: GoogleAuthProvider = {
    mode: 'google',
    current: () => identity,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    signIn: () => attempt(() => client.signInWithOAuth({ provider: 'google', options: { redirectTo } })),
    async signOut() {
      const result = await attempt(() => client.signOut({ scope: 'local' }))
      if (result.ok) accept(null)
      return result
    },
  }

  return {
    provider,
    async accessToken() {
      if (identity === null) return null
      const current = await client.getSession().catch(() => null)
      return current?.data.session?.access_token ?? null
    },
  }
}

export interface SupabaseAuthServerAddress {
  /** The project URL, e.g. `https://<ref>.supabase.co`. */
  readonly url: string
  /** The project's publishable key, which the auth server asks of every caller. */
  readonly apiKey: string
}

/**
 * Loads Supabase's auth client in its own chunk, so a local build never fetches it, and builds the
 * provider on it: PKCE, the session in `localStorage` under the app's key, refreshed in place.
 */
export async function loadGoogleAuth({ url, apiKey }: SupabaseAuthServerAddress, options: GoogleAuthOptions): Promise<GoogleAuth> {
  const { GoTrueClient } = await import('@supabase/auth-js')
  const client = new GoTrueClient({
    url: new URL(REMOTE.authPath, url).href,
    headers: { apikey: apiKey },
    storageKey: STORAGE_KEYS.googleSession,
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  })
  return createGoogleAuthProvider(client, options)
}
