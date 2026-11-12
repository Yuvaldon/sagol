import type { AuthIdentity } from '@contracts'
import { describe, expect, it } from 'vitest'
import { createGoogleAuthProvider, type SupabaseAuthClient } from './googleAuth'

// The Google provider over a fake auth client (D-207): what it reads from a session, what it
// tells its listeners, and how the client's failures reach the caller.

const USER_ID = '7f1c3a52-9b8e-4d61-a0f2-3c5e8d9b1a47'
const OTHER_ID = '0b6e2f94-1d3c-4a87-b5e9-6f2a8c4d7e13'

function googleUser(id = USER_ID, email = 'dana@example.test') {
  return {
    id,
    email,
    email_confirmed_at: '2026-11-12T08:00:00Z',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Dana Levi' },
  }
}

interface FakeSession {
  access_token: string
  user: unknown
}

function fakeClient(initial: FakeSession | null, failures: { signIn?: boolean; signOut?: boolean; throws?: boolean } = {}) {
  let session = initial
  const callbacks = new Set<(event: string, session: FakeSession | null) => void>()
  const calls = { signIn: [] as unknown[], signOut: 0 }
  const fail = (failed: boolean | undefined) => {
    if (failures.throws === true) return Promise.reject(new Error('network'))
    return Promise.resolve({ error: failed === true ? new Error('refused') : null })
  }
  const client: SupabaseAuthClient = {
    getSession: () => Promise.resolve({ data: { session }, error: null }),
    onAuthStateChange(callback) {
      callbacks.add(callback)
      return { data: { subscription: { unsubscribe: () => callbacks.delete(callback) } } }
    },
    signInWithOAuth(credentials) {
      calls.signIn.push(credentials)
      return fail(failures.signIn)
    },
    signOut() {
      calls.signOut += 1
      session = null
      return fail(failures.signOut)
    },
  }
  return {
    client,
    calls,
    emit(event: string, next: FakeSession | null) {
      session = next
      for (const callback of [...callbacks]) callback(event, next)
    },
  }
}

const OPTIONS = { redirectTo: 'https://sagol.test' }

describe('Google auth provider (D-207)', () => {
  it('reads the identity of a stored session as the server does', async () => {
    const { client } = fakeClient({ access_token: 'token-1', user: googleUser() })
    const { provider, accessToken } = await createGoogleAuthProvider(client, OPTIONS)
    expect(provider.mode).toBe('google')
    expect(provider.current()).toEqual<AuthIdentity>({
      auth_user_id: USER_ID as AuthIdentity['auth_user_id'],
      provider: 'google',
      email: 'dana@example.test',
      email_verified: true,
      display_name: 'Dana Levi',
    })
    expect(await accessToken()).toBe('token-1')
  })

  it('starts signed out with no session, and has no token', async () => {
    const { client } = fakeClient(null)
    const { provider, accessToken } = await createGoogleAuthProvider(client, OPTIONS)
    expect(provider.current()).toBeNull()
    expect(await accessToken()).toBeNull()
  })

  it('ends a session whose user is not a Google identity', async () => {
    const user = { ...googleUser(), app_metadata: { provider: 'email' } }
    const fake = fakeClient({ access_token: 'token-1', user })
    const { provider } = await createGoogleAuthProvider(fake.client, OPTIONS)
    expect(provider.current()).toBeNull()
    expect(fake.calls.signOut).toBe(1)
  })

  it('starts the redirect back to the app and answers null', async () => {
    const fake = fakeClient(null)
    const { provider } = await createGoogleAuthProvider(fake.client, OPTIONS)
    expect(await provider.signIn()).toEqual({ ok: true, value: null })
    expect(fake.calls.signIn).toEqual([{ provider: 'google', options: { redirectTo: 'https://sagol.test' } }])
  })

  it('tells listeners when the identity changes, not when only the token does', async () => {
    const fake = fakeClient(null)
    const { provider, accessToken } = await createGoogleAuthProvider(fake.client, OPTIONS)
    const heard: (string | null)[] = []
    provider.subscribe((identity) => heard.push(identity?.auth_user_id ?? null))
    fake.emit('SIGNED_IN', { access_token: 'token-1', user: googleUser() })
    fake.emit('TOKEN_REFRESHED', { access_token: 'token-2', user: googleUser() })
    expect(await accessToken()).toBe('token-2')
    fake.emit('SIGNED_IN', { access_token: 'token-3', user: googleUser(OTHER_ID, 'noa@example.test') })
    fake.emit('SIGNED_OUT', null)
    expect(heard).toEqual([USER_ID, OTHER_ID, null])
  })

  it('signs out on this device and tells listeners', async () => {
    const fake = fakeClient({ access_token: 'token-1', user: googleUser() })
    const { provider } = await createGoogleAuthProvider(fake.client, OPTIONS)
    const heard: unknown[] = []
    const unsubscribe = provider.subscribe((identity) => heard.push(identity))
    expect(await provider.signOut()).toEqual({ ok: true, value: null })
    expect(provider.current()).toBeNull()
    expect(heard).toEqual([null])
    unsubscribe()
  })

  it('answers unavailable when the client refuses or fails', async () => {
    const refusing = fakeClient({ access_token: 'token-1', user: googleUser() }, { signIn: true, signOut: true })
    const refused = await createGoogleAuthProvider(refusing.client, OPTIONS)
    expect(await refused.provider.signIn()).toEqual({ ok: false, error: { code: 'unavailable' } })
    expect(await refused.provider.signOut()).toEqual({ ok: false, error: { code: 'unavailable' } })
    const throwing = fakeClient(null, { throws: true })
    const thrown = await createGoogleAuthProvider(throwing.client, OPTIONS)
    expect(await thrown.provider.signIn()).toEqual({ ok: false, error: { code: 'unavailable' } })
  })
})
