import Dexie from 'dexie'
import { STORES, type Store } from './store'

// The IndexedDB store of the local adapter (D-021). Every table of the schema exists from the
// first version, because the policy snapshot reads most of them on every check. Table and column
// names are schema.sql names (D-038). Primary keys and uniques mirror it where IndexedDB can: a
// compound key holding NULL is not indexed, which acts as a partial index on "NOT NULL".

const DATABASE_VERSION = 6

/** Versions 1 and 2 keyed a soldier's tags by the pair; format 3 gives each row an id and a scope (D-221). */
const VERSION_2_SOLDIER_TAGS = '[soldier_id+tag_id], organization_id, tag_id'
/** IndexedDB cannot change a primary key: the rows move through this table while `soldier_tags` is made again. */
const MOVING_SOLDIER_TAGS = 'soldier_tags_moving'

/** Version 1 indexed the account links as unique; version 2 checks that among links not revoked, in code (D-163). */
const VERSION_1_ACCOUNTS = 'id, organization_id, auth_user_id, &[organization_id+auth_user_id], &soldier_id'

/** The IndexedDB store, which a test closes when it is done. */
export interface LocalStore extends Store {
  close(): void
}

export function openDatabase(name: string): LocalStore {
  const database = new Dexie(name)
  const before = { ...STORES, soldier_tags: VERSION_2_SOLDIER_TAGS }
  database.version(1).stores({ ...before, soldier_accounts: VERSION_1_ACCOUNTS })
  database.version(2).stores(before)
  // Format 3 (D-221): the stored rows take the new columns' values, persistent and open.
  database
    .version(3)
    .stores({ [MOVING_SOLDIER_TAGS]: 'id' })
    .upgrade(async (transaction) => {
      const held = await transaction.table('soldier_tags').toArray()
      await transaction
        .table(MOVING_SOLDIER_TAGS)
        .bulkAdd(held.map((row: object) => ({ ...row, id: crypto.randomUUID(), deployment_id: null })))
      await transaction.table('tag_categories').toCollection().modify({ default_lifetime: 'persistent' })
      await transaction.table('deployments').toCollection().modify({ closed_at: null, closed_by: null })
    })
  database.version(4).stores({ soldier_tags: null })
  database
    .version(5)
    .stores({ soldier_tags: STORES.soldier_tags })
    .upgrade(async (transaction) => {
      await transaction.table('soldier_tags').bulkAdd(await transaction.table(MOVING_SOLDIER_TAGS).toArray())
    })
  database.version(DATABASE_VERSION).stores({ [MOVING_SOLDIER_TAGS]: null })
  return {
    transaction: (mode, tables, work) => database.transaction(mode, [...tables], work),
    table: (name) => database.table(name),
    close: () => database.close(),
  }
}
