import 'fake-indexeddb/auto'
import { openDatabase } from './database'
import { STORES, tableOf } from './store'
import {
  AuthUserId,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  AccessGrantId,
  UnitId,
  UnitMembershipId,
  TABLE_SCHEMAS,
  type AuthIdentity,
  type TableName,
  type Unsubscribe,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import { CONTRACT_NOW, describeAdapterContract, type ContractHarness } from '../contract-tests/suite'
import { createLocalDataAdapter } from './adapter'
import { createLocalAuthProvider, type IdentityStore } from './identity'

// The local adapter against the shared contract suite. The `seed` port is local: direct store
// writes, in this test file only (D-076). `fake-indexeddb` runs Dexie under Node (D-080).

function memoryIdentity() {
  let current: AuthIdentity | null = null
  const listeners = new Set<(identity: AuthIdentity | null) => void>()
  return {
    current: () => current,
    subscribe(listener: (identity: AuthIdentity | null) => void): Unsubscribe {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(identity: AuthIdentity | null) {
      current = identity
      for (const listener of [...listeners]) listener(identity)
    },
  }
}

function uniqueNames() {
  const id = crypto.randomUUID()
  return { database: `test-${id}`, channel: `test-${id}` }
}

async function createHarness(): Promise<ContractHarness> {
  const identity = memoryIdentity()
  const names = uniqueNames()
  const adapter = createLocalDataAdapter({ identity, time: { now: () => CONTRACT_NOW } }, names)
  const store = openDatabase(names.database)
  return {
    adapter,
    signIn: identity.set,
    async seed(table, rows) {
      await tableOf(store, table).bulkPut([...rows])
    },
    rows: (table) => tableOf(store, table).toArray(),
    async dispose() {
      store.close()
    },
  }
}

describeAdapterContract('local', createHarness)

describe('local store', () => {
  it('keys every table on columns the schema has (D-038)', () => {
    for (const [table, spec] of Object.entries(STORES)) {
      const shape = TABLE_SCHEMAS[table as TableName].shape
      const columns = spec
        .split(',')
        .flatMap((part) => part.trim().replace(/^&/, '').replace(/[[\]]/g, '').split('+'))
      for (const column of columns) expect(Object.keys(shape), `${table}.${column}`).toContain(column)
    }
  })

  it('writes nothing when any write of a command fails (one transaction)', async () => {
    const harness = await createHarness()
    harness.signIn({
      auth_user_id: AuthUserId.parse(crypto.randomUUID()),
      provider: 'local',
      email: 'first@example.test',
      email_verified: true,
      display_name: null,
    })
    const roleId = RoleId.parse(crypto.randomUUID())
    // A role that already holds the id: the role insert fails after three other inserts.
    await harness.seed('roles', [
      {
        id: roleId,
        organization_id: OrganizationId.parse(crypto.randomUUID()),
        name: 'Taken',
        description: null,
        color_key: null,
        created_at: CONTRACT_NOW,
        created_by: null,
        updated_at: CONTRACT_NOW,
        updated_by: null,
        version: 1,
        archived_at: null,
      },
    ])
    const result = await harness.adapter.commands.organizations.bootstrapOwner({
      organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Company', timezone: 'UTC' },
      soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: roleId, name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      root_unit_id: UnitId.parse(crypto.randomUUID()),
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
    })
    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    expect(await harness.rows('organizations')).toEqual([])
    expect(await harness.rows('soldiers')).toEqual([])
    expect(await harness.rows('soldier_accounts')).toEqual([])
    await harness.dispose()
  })

  it('tells another tab about a committed write', async () => {
    const identity = memoryIdentity()
    const names = uniqueNames()
    const time = { now: () => CONTRACT_NOW }
    const tabA = createLocalDataAdapter({ identity, time }, names)
    const tabB = createLocalDataAdapter({ identity, time }, names)
    const heard = new Promise<string[]>((resolve) => {
      const stop = tabB.changes.subscribe((changes) => {
        stop()
        resolve(changes.map((change) => change.table))
      })
    })
    identity.set({
      auth_user_id: AuthUserId.parse(crypto.randomUUID()),
      provider: 'local',
      email: 'first@example.test',
      email_verified: true,
      display_name: null,
    })
    const result = await tabA.commands.organizations.bootstrapOwner({
      organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Company', timezone: 'UTC' },
      soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      root_unit_id: UnitId.parse(crypto.randomUUID()),
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
    })
    expect(result.ok).toBe(true)
    expect(await heard).toContain('soldier_accounts')
    expect(await tabB.repositories.organizations.current()).toMatchObject({ ok: true })
  })
})

function memoryStore(initial: string | null = null): IdentityStore & { external(value: string): void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    external(next) {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

describe('local identity provider (D-006)', () => {
  it('starts signed out and treats stored garbage as signed out', () => {
    expect(createLocalAuthProvider(memoryStore()).current()).toBeNull()
    expect(createLocalAuthProvider(memoryStore('{not json')).current()).toBeNull()
    expect(createLocalAuthProvider(memoryStore('{"current":1}')).current()).toBeNull()
  })

  it('signs in with a verified local identity and survives a reload', async () => {
    const store = memoryStore()
    const provider = createLocalAuthProvider(store)
    const result = await provider.signInAs({ email: 'Dana@Example.test', display_name: 'Dana' })
    expect(result).toMatchObject({
      ok: true,
      value: { provider: 'local', email: 'dana@example.test', email_verified: true, display_name: 'Dana' },
    })
    const reloaded = createLocalAuthProvider(store)
    expect(reloaded.current()?.email).toBe('dana@example.test')
  })

  it('keeps one identity per email, and lists who signed in', async () => {
    const provider = createLocalAuthProvider(memoryStore())
    const first = await provider.signInAs({ email: 'a@example.test', display_name: null })
    await provider.signInAs({ email: 'b@example.test', display_name: null })
    const again = await provider.signInAs({ email: 'A@example.test', display_name: null })
    if (!first.ok || !again.ok) throw new Error('sign-in refused')
    expect(again.value.auth_user_id).toBe(first.value.auth_user_id)
    const listed = await provider.listIdentities()
    expect(listed.ok && listed.value.map((identity) => identity.email).sort()).toEqual([
      'a@example.test',
      'b@example.test',
    ])
  })

  it('reports field codes for a bad request (D-068)', async () => {
    const provider = createLocalAuthProvider(memoryStore())
    const result = await provider.signInAs({ email: 'not-an-email', display_name: null })
    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_failed', issues: [{ path: ['email'], code: 'invalid_format' }] },
    })
  })

  it('notifies on sign-out and on a change from another tab', async () => {
    const store = memoryStore()
    const provider = createLocalAuthProvider(store)
    const seen: (string | null)[] = []
    const stop = provider.subscribe((identity) => seen.push(identity?.email ?? null))
    await provider.signInAs({ email: 'a@example.test', display_name: null })
    await provider.signOut()
    expect(provider.current()).toBeNull()
    const signedOutValue = store.read()
    await provider.signInAs({ email: 'a@example.test', display_name: null })
    if (signedOutValue !== null) store.external(signedOutValue)
    stop()
    expect(seen).toEqual(['a@example.test', null, 'a@example.test', null])
  })

  it('answers `unavailable` when the store refuses a write', async () => {
    const store = memoryStore()
    store.write = () => {
      throw new Error('quota')
    }
    const result = await createLocalAuthProvider(store).signInAs({ email: 'a@example.test', display_name: null })
    expect(result).toEqual({ ok: false, error: { code: 'unavailable' } })
  })
})
