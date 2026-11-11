import { AuthIdentity } from '@contracts'
import { z } from 'zod'

// The identity a Supabase access token names (D-201). The gateway takes it from here only: the
// auth server reads the token and answers with its user, so a forged or expired token names no
// one. Only Google identities are accepted on the server; the development modes never reach it.

const SupabaseUser = z.object({
  id: z.string(),
  email: z.string().optional(),
  email_confirmed_at: z.string().nullable().optional(),
  app_metadata: z.object({ provider: z.string().optional() }).optional(),
  user_metadata: z.record(z.string(), z.unknown()).optional(),
})

/** The keys under which Google's profile name arrives in `user_metadata`, in order of preference. */
const NAME_KEYS: readonly string[] = ['full_name', 'name']

export function identityOfSupabaseUser(user: unknown): AuthIdentity | null {
  const parsed = SupabaseUser.safeParse(user)
  if (!parsed.success || parsed.data.app_metadata?.provider !== 'google') return null
  const metadata = parsed.data.user_metadata ?? {}
  const name = NAME_KEYS.map((key) => metadata[key]).find((value) => typeof value === 'string' && value.trim() !== '')
  const identity = AuthIdentity.safeParse({
    auth_user_id: parsed.data.id,
    provider: 'google',
    email: parsed.data.email,
    email_verified: typeof parsed.data.email_confirmed_at === 'string',
    display_name: typeof name === 'string' ? name.trim() : null,
  })
  return identity.success ? identity.data : null
}

export interface SupabaseAuthServer {
  /** The project URL, e.g. `https://<ref>.supabase.co`. */
  readonly url: string
  /** The project's public (anon) key, which the auth server asks of every caller. */
  readonly apiKey: string
  readonly fetch: typeof fetch
}

/** Thrown when the auth server cannot answer: the request fails as `unavailable`, never as signed out. */
export class AuthServerUnavailable extends Error {}

/** Asks the auth server whose token this is. A token it refuses names no one (`null`). */
export function supabaseTokenVerifier({ url, apiKey, fetch }: SupabaseAuthServer) {
  return async function verify(token: string): Promise<AuthIdentity | null> {
    let response: Response
    try {
      response = await fetch(new URL('/auth/v1/user', url), {
        headers: { authorization: `Bearer ${token}`, apikey: apiKey },
      })
    } catch {
      throw new AuthServerUnavailable()
    }
    if (response.status >= 500) throw new AuthServerUnavailable()
    if (!response.ok) return null
    return identityOfSupabaseUser(await response.json())
  }
}
