import Dexie from 'dexie'
import { STORES, type Store } from './store'

// The IndexedDB store of the local adapter (D-021). Every table of the schema exists from the
// first version, because the policy snapshot reads most of them on every check. Table and column
// names are schema.sql names (D-038). Primary keys and uniques mirror it where IndexedDB can: a
// compound key holding NULL is not indexed, which acts as a partial index on "NOT NULL".

const DATABASE_VERSION = 2

/** Version 1 indexed the account links as unique; version 2 checks that among links not revoked, in code (D-163). */
const VERSION_1_ACCOUNTS = 'id, organization_id, auth_user_id, &[organization_id+auth_user_id], &soldier_id'

/** The IndexedDB store, which a test closes when it is done. */
export interface LocalStore extends Store {
  close(): void
}

export function openDatabase(name: string): LocalStore {
  const database = new Dexie(name)
  database.version(1).stores({ ...STORES, soldier_accounts: VERSION_1_ACCOUNTS })
  database.version(DATABASE_VERSION).stores(STORES)
  return {
    transaction: (mode, tables, work) => database.transaction(mode, [...tables], work),
    table: (name) => database.table(name),
    close: () => database.close(),
  }
}
