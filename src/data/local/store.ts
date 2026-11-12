import type { TableName, TableRow } from '@contracts'

// The storage port of the command code (D-201). The local adapter runs it over IndexedDB (Store),
// the server over Postgres, so both answer with the same checks in the same order (D-090).
// It holds only what the commands use, with Store's semantics: `put` is an upsert on the primary
// key, a compound key is an array in the index's column order. A transaction is ambient: work inside it
// reaches the tables through `table`, and a throw rolls back everything it wrote.

/** A primary key or index value: one column, or the columns of a compound index in order. */
export type StoreKey = string | number | readonly (string | number)[]

export interface StoreCollection<Row> {
  toArray(): Promise<Row[]>
  first(): Promise<Row | undefined>
  count(): Promise<number>
}

export interface StoreTable<Row> {
  get(key: StoreKey): Promise<Row | undefined>
  /** An index named as in `STORES`: a column, or `[a+b]` for a compound one. */
  where(index: string): { equals(value: StoreKey): StoreCollection<Row> }
  toArray(): Promise<Row[]>
  count(): Promise<number>
  add(row: Row): Promise<unknown>
  put(row: Row): Promise<unknown>
  bulkAdd(rows: Row[]): Promise<unknown>
  bulkPut(rows: Row[]): Promise<unknown>
  bulkDelete(keys: StoreKey[]): Promise<void>
}

/** The error name a store gives when it cannot reach its storage; callers may retry. */
export const STORE_UNAVAILABLE = 'StoreUnavailableError'

export type StoreMode = 'r' | 'rw'

export interface Store {
  transaction<T>(mode: StoreMode, tables: readonly TableName[], work: () => Promise<T>): Promise<T>
  table<Row>(name: TableName): StoreTable<Row>
}

/**
 * Primary key first, then the indexes, in Dexie's notation. Keys and indexes are the local
 * store's, and the Postgres store answers the same lookups by them (D-201).
 */
export const STORES = {
  organizations: 'id',
  unit_levels: 'id, organization_id',
  units: 'id, organization_id, parent_id, &[organization_id+code]',
  command_ranks: 'id, organization_id',
  soldiers: 'id, organization_id, command_rank_id',
  soldier_private: 'soldier_id, organization_id, &[organization_id+personal_id]',
  seniority_overrides: 'id, organization_id, soldier_id',
  unit_memberships: 'id, organization_id, soldier_id, unit_id',
  soldier_accounts: 'id, organization_id, auth_user_id, soldier_id',
  account_link_requests: 'id, organization_id, auth_user_id',
  soldier_preferences: 'soldier_id, organization_id',
  roles: 'id, organization_id',
  role_permissions: '[role_id+resource+action], organization_id, role_id',
  rank_role_bindings: 'id, organization_id, command_rank_id',
  access_grants: 'id, organization_id, grantee_soldier_id',
  tag_categories: 'id, organization_id',
  tags: 'id, organization_id, category_id',
  soldier_tags: '[soldier_id+tag_id], organization_id, tag_id',
  leave_type_groups: 'id, organization_id',
  leave_types: 'id, organization_id',
  leave_batches: 'id, organization_id',
  leaves: 'id, organization_id, soldier_id, status, [organization_id+start_date]',
  leave_events: 'id, organization_id, leave_id',
  leave_comments: 'id, organization_id, leave_id',
  deployments: 'id, organization_id, unit_id',
  deployment_members: '[deployment_id+soldier_id], organization_id, soldier_id',
  availability_rules: 'id, organization_id, scope_unit_id',
  property_definitions: 'id, organization_id',
} as const satisfies Record<TableName, string>

/** The typed table. Rows reach callers only after `parsedRow`. */
export function tableOf<T extends TableName>(database: Store, name: T): StoreTable<TableRow<T>> {
  return database.table(name)
}
