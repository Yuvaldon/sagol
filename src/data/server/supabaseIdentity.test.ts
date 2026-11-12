import { describe, expect, it, vi } from 'vitest'
import { AuthServerUnavailable, identityOfSupabaseUser, supabaseTokenVerifier } from './supabaseIdentity'

const USER_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d'
const googleUser = {
  id: USER_ID,
  email: 'dana@example.com',
  email_confirmed_at: '2026-11-01T08:00:00Z',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: '  Dana Levi ', name: 'Dana' },
}

describe('identityOfSupabaseUser', () => {
  it('reads a Google user', () => {
    expect(identityOfSupabaseUser(googleUser)).toEqual({
      auth_user_id: USER_ID,
      provider: 'google',
      email: 'dana@example.com',
      email_verified: true,
      display_name: 'Dana Levi',
    })
  })

  it('falls back to `name`, then to no name, and reads an unconfirmed email as unverified', () => {
    const user = { ...googleUser, email_confirmed_at: null, user_metadata: { name: 'Dana' } }
    expect(identityOfSupabaseUser(user)).toMatchObject({ display_name: 'Dana', email_verified: false })
    expect(identityOfSupabaseUser({ ...googleUser, user_metadata: {} })).toMatchObject({ display_name: null })
  })

  it('names no one for another provider or a malformed user', () => {
    expect(identityOfSupabaseUser({ ...googleUser, app_metadata: { provider: 'email' } })).toBeNull()
    expect(identityOfSupabaseUser({ ...googleUser, id: 'not-a-uuid' })).toBeNull()
    expect(identityOfSupabaseUser({ ...googleUser, email: undefined })).toBeNull()
    expect(identityOfSupabaseUser(null)).toBeNull()
  })
})

describe('supabaseTokenVerifier', () => {
  const server = (fetch: typeof globalThis.fetch) =>
    supabaseTokenVerifier({ url: 'https://project.supabase.co', apiKey: 'public-key', fetch })

  it('asks the auth server with the token and the public key', async () => {
    const fetch = vi.fn(async () => Response.json(googleUser))
    expect(await server(fetch)('token')).toMatchObject({ auth_user_id: USER_ID })
    expect(fetch).toHaveBeenCalledWith(new URL('https://project.supabase.co/auth/v1/user'), {
      headers: { authorization: 'Bearer token', apikey: 'public-key' },
    })
  })

  it('names no one for a refused token, and throws when the server cannot answer', async () => {
    expect(await server(async () => new Response(null, { status: 401 }))('token')).toBeNull()
    await expect(server(async () => new Response(null, { status: 503 }))('token')).rejects.toBeInstanceOf(
      AuthServerUnavailable,
    )
    await expect(
      server(async () => {
        throw new TypeError('network')
      })('token'),
    ).rejects.toBeInstanceOf(AuthServerUnavailable)
  })
})
