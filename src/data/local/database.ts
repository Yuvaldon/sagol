import Dexie, { type Table } from 'dexie'
import type { TableName, TableRow } from '@contracts'

// The IndexedDB store of the local adapter (D-021). Every table of the schema exists from the
// first version, because the policy snapshot reads most of them on every check. Table and column
// names are schema.sql names (D-038). Primary keys and uniques mirror it where IndexedDB can: a
// compound key holding NULL is not indexed, which acts as a partial index on "NOT NULL".

const DATABASE_VERSION = 1

export const STORES = {
  organizations: 'id',
  unit_levels: 'id, organization_id',
  units: 'id, organization_id, parent_id, &[organization_id+code]',
  command_ranks: 'id, organization_id',
  soldiers: 'id, organization_id, command_rank_id',
  soldier_private: 'soldier_id, organization_id, &[organization_id+personal_id]',
  seniority_overrides: 'id, organization_id, soldier_id',
  unit_memberships: 'id, organization_id, soldier_id, unit_id',
  soldier_accounts: 'id, organization_id, auth_user_id, &[organization_id+auth_user_id], &soldier_id',
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

export function openDatabase(name: string): Dexie {
  const database = new Dexie(name)
  database.version(DATABASE_VERSION).stores(STORES)
  return database
}

/** The typed table. Rows reach callers only after `parsedRow`. */
export function tableOf<T extends TableName>(database: Dexie, name: T): Table<TableRow<T>, unknown> {
  return database.table(name)
}
