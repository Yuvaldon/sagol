import type Dexie from 'dexie'
import type { Organization, OrganizationId, Timestamp } from '@contracts'
import { clockAt, createPolicyContext, type PolicyContext } from '@domain'
import { tableOf } from './database'
import { fail, parsedRow } from './failure'

// Everything the policy reads, loaded in one read transaction, so every check of a command or a
// query sees one consistent state (D-003, D-008).

export const POLICY_TABLES = [
  'organizations',
  'units',
  'soldiers',
  'command_ranks',
  'seniority_overrides',
  'unit_memberships',
  'soldier_accounts',
  'roles',
  'role_permissions',
  'rank_role_bindings',
  'access_grants',
] as const

export interface PolicySnapshot {
  readonly organization: Organization
  readonly context: PolicyContext
}

export function loadPolicySnapshot(
  database: Dexie,
  organizationId: OrganizationId,
  now: Timestamp,
): Promise<PolicySnapshot> {
  const rowsOf = <T extends Exclude<(typeof POLICY_TABLES)[number], 'organizations'>>(table: T) =>
    tableOf(database, table).where('organization_id').equals(organizationId).toArray()

  return database.transaction('r', POLICY_TABLES, async () => {
    const stored = await tableOf(database, 'organizations').get(organizationId)
    if (stored === undefined) return fail({ code: 'internal' })
    const organization = parsedRow('organizations', stored)
    const [units, soldiers, command_ranks, seniority_overrides, unit_memberships] = await Promise.all([
      rowsOf('units'),
      rowsOf('soldiers'),
      rowsOf('command_ranks'),
      rowsOf('seniority_overrides'),
      rowsOf('unit_memberships'),
    ])
    const [soldier_accounts, roles, role_permissions, rank_role_bindings, access_grants] = await Promise.all([
      rowsOf('soldier_accounts'),
      rowsOf('roles'),
      rowsOf('role_permissions'),
      rowsOf('rank_role_bindings'),
      rowsOf('access_grants'),
    ])
    const context = createPolicyContext(
      {
        baseline_role_id: organization.baseline_role_id,
        units,
        soldiers,
        command_ranks,
        seniority_overrides,
        unit_memberships,
        soldier_accounts,
        roles,
        role_permissions,
        rank_role_bindings,
        access_grants,
      },
      clockAt(organization.timezone, now),
    )
    return { organization, context }
  })
}
