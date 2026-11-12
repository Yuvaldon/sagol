import type { Store } from './store'
import type { CalendarDate, Organization, OrganizationId, Timestamp } from '@contracts'
import { accessManagerIssues, clockAt, createPolicyContext, type Clock, type PolicyContext } from '@domain'
import { tableOf } from './store'
import { fail, failValidation, parsedRow } from './failure'

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
  database: Store,
  organizationId: OrganizationId,
  now: Timestamp,
  /** A later day to judge on instead of today: a change that takes effect then is checked as it will be (D-179). */
  onDay?: CalendarDate,
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
      dayClock(clockAt(organization.timezone, now), onDay),
    )
    return { organization, context }
  })
}

/**
 * The access-manager invariant, on the state after a write that can take permissions away (D-059,
 * OI-021 a). Call it inside the write's transaction, so a refusal undoes the write.
 */
export async function requireAccessManager(database: Store, organizationId: OrganizationId, now: Timestamp): Promise<void> {
  const { context } = await loadPolicySnapshot(database, organizationId, now)
  const issues = accessManagerIssues(context)
  if (issues.length > 0) failValidation(issues)
}

/** Today, or a later day when one is given. */
function dayClock(clock: Clock, onDay: CalendarDate | undefined): Clock {
  return onDay === undefined || onDay <= clock.today ? clock : { ...clock, today: onDay }
}
