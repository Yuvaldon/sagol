import { STORAGE_KEYS } from '@config'
import {
  AuthIdentity,
  AuthUserId,
  LocalIdentityRequest,
  type AsyncResult,
  type LocalAuthProvider,
  type Unsubscribe,
} from '@contracts'
import { issuesFromSchema } from '@domain'
import { z } from 'zod'

// The local identity provider (development only, D-006, D-048). It says WHO acts, never what the
// policy allows. This folder is the only module allowed to touch web storage (D-074, D-086).

/** The one `localStorage` value: the current identity and everyone who signed in here. */
const StoredIdentities = z.object({
  current: AuthUserId.nullable(),
  identities: z.array(AuthIdentity),
})
type StoredIdentities = z.infer<typeof StoredIdentities>

const NOBODY: StoredIdentities = { current: null, identities: [] }

export interface IdentityStore {
  read(): string | null
  write(value: string): void
  /** Fires when another tab changes the value. */
  subscribe(listener: () => void): Unsubscribe
}

export function browserIdentityStore(): IdentityStore {
  const key = STORAGE_KEYS.localIdentity
  return {
    read: () => localStorage.getItem(key),
    write: (value) => {
      localStorage.setItem(key, value)
    },
    subscribe(listener) {
      const handle = (event: StorageEvent) => {
        if (event.key === key || event.key === null) listener()
      }
      addEventListener('storage', handle)
      return () => {
        removeEventListener('storage', handle)
      }
    },
  }
}

function load(store: IdentityStore): StoredIdentities {
  try {
    const raw = store.read()
    if (raw === null) return NOBODY
    const parsed = StoredIdentities.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : NOBODY
  } catch {
    return NOBODY
  }
}

function currentOf(state: StoredIdentities): AuthIdentity | null {
  return state.identities.find((identity) => identity.auth_user_id === state.current) ?? null
}

export function createLocalAuthProvider(store: IdentityStore): LocalAuthProvider {
  const listeners = new Set<(identity: AuthIdentity | null) => void>()

  function notify(): void {
    const identity = currentOf(load(store))
    for (const listener of [...listeners]) listener(identity)
  }

  function save(state: StoredIdentities): boolean {
    try {
      store.write(JSON.stringify(state))
      return true
    } catch {
      return false
    }
  }

  store.subscribe(notify)

  return {
    mode: 'local',
    current: () => currentOf(load(store)),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    signInAs(request): AsyncResult<AuthIdentity> {
      const parsed = LocalIdentityRequest.safeParse(request)
      if (!parsed.success) {
        const issues = issuesFromSchema(parsed.error.issues, request)
        return Promise.resolve({ ok: false, error: { code: 'validation_failed', issues } })
      }
      const email = parsed.data.email.toLowerCase()
      const state = load(store)
      const known = state.identities.find((identity) => identity.email === email)
      const identity: AuthIdentity = {
        auth_user_id: known?.auth_user_id ?? AuthUserId.parse(crypto.randomUUID()),
        provider: 'local',
        email,
        // A local identity counts as verified, so the real bootstrap flow runs (D-006, D-086).
        email_verified: true,
        display_name: parsed.data.display_name ?? known?.display_name ?? null,
      }
      const saved = save({
        current: identity.auth_user_id,
        identities: [...state.identities.filter((row) => row.auth_user_id !== identity.auth_user_id), identity],
      })
      if (!saved) return Promise.resolve({ ok: false, error: { code: 'unavailable' } })
      notify()
      return Promise.resolve({ ok: true, value: identity })
    },
    listIdentities: () => Promise.resolve({ ok: true, value: load(store).identities }),
    signOut() {
      const saved = save({ ...load(store), current: null })
      if (!saved) return Promise.resolve({ ok: false, error: { code: 'unavailable' } })
      notify()
      return Promise.resolve({ ok: true, value: null })
    },
  }
}
