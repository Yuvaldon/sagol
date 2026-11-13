import { MembershipType, UnitKind, type TableRow, type Timestamp } from '@contracts'
import { dayBefore, todayIn } from '@domain'
import Dexie, { type Transaction } from 'dexie'
import { parsedRow } from './failure'
import { STORES, type Store } from './store'

// The IndexedDB store of the local adapter (D-021). Every table of the schema exists from the
// first version, because the policy snapshot reads most of them on every check. Table and column
// names are schema.sql names (D-038). Primary keys and uniques mirror it where IndexedDB can: a
// compound key holding NULL is not indexed, which acts as a partial index on "NOT NULL".

const DATABASE_VERSION = 8

/** Versions 1 and 2 keyed a soldier's tags by the pair; format 3 gives each row an id and a scope (D-221). */
const VERSION_2_SOLDIER_TAGS = '[soldier_id+tag_id], organization_id, tag_id'
/** IndexedDB cannot change a primary key: the rows move through this table while `soldier_tags` is made again. */
const MOVING_SOLDIER_TAGS = 'soldier_tags_moving'

/** Version 1 indexed the account links as unique; version 2 checks that among links not revoked, in code (D-163). */
const VERSION_1_ACCOUNTS = 'id, organization_id, auth_user_id, &[organization_id+auth_user_id], &soldier_id'

type Organization = Pick<TableRow<'organizations'>, 'id' | 'name' | 'timezone'>
type Unit = Pick<TableRow<'units'>, 'id' | 'organization_id' | 'parent_id' | 'archived_at' | 'updated_at' | 'version'>
type Soldier = Pick<TableRow<'soldiers'>, 'id' | 'organization_id' | 'created_at' | 'archived_at'>
type Membership = Pick<TableRow<'unit_memberships'>, 'soldier_id' | 'membership_type' | 'valid_from'>

/**
 * One root per organization and the soldiers' history in it, as the server's migration does (D-321): an organization
 * whose live top-level units are not exactly one gets a root named for it, the others move under it, and each soldier
 * is placed in the root from the day they were created to the day before their first primary membership (or on, open,
 * when a soldier not archived has none).
 */
async function oneRoot(transaction: Transaction): Promise<void> {
  const now: Timestamp = new Date().toISOString()
  const units = transaction.table<Unit>('units')
  const memberships = transaction.table<Membership>('unit_memberships')
  const allUnits = await units.toArray()
  const allMemberships = await memberships.toArray()
  const organizations = await transaction.table<Organization>('organizations').toArray()
  const roots = new Map<string, string>()
  for (const organization of organizations) {
    const tops = allUnits.filter((unit) => unit.organization_id === organization.id && unit.parent_id === null && unit.archived_at === null)
    const [only] = tops
    if (tops.length === 1 && only !== undefined) {
      roots.set(organization.id, only.id)
      continue
    }
    const root = parsedRow('units', {
      id: crypto.randomUUID(),
      organization_id: organization.id,
      name: organization.name,
      code: null,
      parent_id: null,
      unit_level_id: null,
      kind: UnitKind.enum.standing,
      valid_from: null,
      valid_to: null,
      color_key: null,
      sort_order: 0,
      properties: {},
      created_at: now,
      created_by: null,
      updated_at: now,
      updated_by: null,
      version: 1,
      archived_at: null,
    })
    await units.add(root)
    for (const top of tops) await units.update(top.id, { parent_id: root.id, updated_at: now, version: top.version + 1 })
    roots.set(organization.id, root.id)
  }
  const timezones = new Map(organizations.map((row) => [row.id, row.timezone]))
  for (const soldier of await transaction.table<Soldier>('soldiers').toArray()) {
    const root = roots.get(soldier.organization_id)
    const timezone = timezones.get(soldier.organization_id)
    if (root === undefined || timezone === undefined) continue
    const createdOn = todayIn(timezone, soldier.created_at)
    const [first] = allMemberships
      .filter((row) => row.soldier_id === soldier.id && row.membership_type === MembershipType.enum.primary)
      .map((row) => row.valid_from)
      .sort()
    if (first === undefined ? soldier.archived_at !== null : first <= createdOn) continue
    await memberships.add(
      parsedRow('unit_memberships', {
        id: crypto.randomUUID(),
        organization_id: soldier.organization_id,
        soldier_id: soldier.id,
        unit_id: root,
        membership_type: MembershipType.enum.primary,
        valid_from: createdOn,
        valid_to: first === undefined ? null : dayBefore(first),
        created_at: now,
        created_by: null,
        updated_at: now,
        updated_by: null,
        version: 1,
      }),
    )
  }
}

/** The IndexedDB store, which a test closes when it is done. */
export interface LocalStore extends Store {
  close(): void
}

export function openDatabase(name: string): LocalStore {
  const database = new Dexie(name)
  // Tables added after version 6 are declared at their own version, so an older store creates them on upgrade.
  const { report_confirmations: confirmations, ...earlier } = STORES
  const before = { ...earlier, soldier_tags: VERSION_2_SOLDIER_TAGS }
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
  database.version(6).stores({ [MOVING_SOLDIER_TAGS]: null })
  // The daily report's confirmations, a rotation's report owner, none named before, and who approves leaves may
  // confirm the report, as the server's migration grants (D-293).
  database
    .version(7)
    .stores({ report_confirmations: confirmations })
    .upgrade(async (transaction) => {
      await transaction.table('deployments').toCollection().modify({ report_owner_id: null })
      const permissions = transaction.table<{ role_id: string; organization_id: string; resource: string; action: string }>('role_permissions')
      const approving = (await permissions.toArray()).filter((row) => row.resource === 'leaves' && row.action === 'approve')
      await permissions.bulkPut(approving.map((row) => ({ ...row, resource: 'day_reports', action: 'confirm' })))
    })
  database.version(DATABASE_VERSION).upgrade(oneRoot)
  return {
    transaction: (mode, tables, work) => database.transaction(mode, [...tables], work),
    table: (name) => database.table(name),
    close: () => database.close(),
  }
}
