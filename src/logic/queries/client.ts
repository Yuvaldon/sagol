import type { DataChange, TableName } from '@contracts'
import { QueryClient, type QueryKey } from '@tanstack/react-query'

// The query cache. It holds what the adapter answered and never decides anything by itself. The
// change feed tells it when an answer is out of date, so it needs no timers (ARCHITECTURE).

const TABLE_SCOPE = 'table'

export const QUERY_KEYS = {
  session: ['session'],
  identities: ['identities'],
  onboarding: ['onboarding'],
  organization: [TABLE_SCOPE, 'organizations'],
  unitLevels: [TABLE_SCOPE, 'unit_levels'],
  units: [TABLE_SCOPE, 'units'],
  commandRanks: [TABLE_SCOPE, 'command_ranks'],
  soldiers: [TABLE_SCOPE, 'soldiers'],
  soldierPrivate: [TABLE_SCOPE, 'soldier_private'],
  unitMemberships: [TABLE_SCOPE, 'unit_memberships'],
  soldierPreferences: [TABLE_SCOPE, 'soldier_preferences'],
  accountLinkRequests: [TABLE_SCOPE, 'account_link_requests'],
  tagCategories: [TABLE_SCOPE, 'tag_categories'],
  tags: [TABLE_SCOPE, 'tags'],
  soldierTags: [TABLE_SCOPE, 'soldier_tags'],
  leaveTypeGroups: [TABLE_SCOPE, 'leave_type_groups'],
  leaveTypes: [TABLE_SCOPE, 'leave_types'],
  leaves: [TABLE_SCOPE, 'leaves'],
  leaveEvents: [TABLE_SCOPE, 'leave_events'],
  leaveComments: [TABLE_SCOPE, 'leave_comments'],
  availabilityRules: [TABLE_SCOPE, 'availability_rules'],
  soldierAccounts: [TABLE_SCOPE, 'soldier_accounts'],
  roles: [TABLE_SCOPE, 'roles'],
  rolePermissions: [TABLE_SCOPE, 'role_permissions'],
  rankRoleBindings: [TABLE_SCOPE, 'rank_role_bindings'],
  accessGrants: [TABLE_SCOPE, 'access_grants'],
  /** Every table at once: an import may write to any of them (D-171). */
  tables: [TABLE_SCOPE],
  can: ['can'],
} as const satisfies Record<string, QueryKey>

/** Queries that survive a change of identity: they describe the device, not the actor's data. */
const IDENTITY_INDEPENDENT = new Set<unknown>([QUERY_KEYS.session[0], QUERY_KEYS.identities[0]])

/** Tables the onboarding answer reads. */
const ONBOARDING_TABLES: ReadonlySet<TableName> = new Set<TableName>([
  'organizations',
  'soldier_accounts',
  'account_link_requests',
])

/** Tables a link request's candidates and visibility are computed from (D-149). */
const LINK_REQUEST_TABLES: ReadonlySet<TableName> = new Set<TableName>([
  'soldiers',
  'soldier_private',
  'soldier_accounts',
  'unit_memberships',
  'access_grants',
])

/**
 * Tables the policy is computed from (D-053 … D-058). Every list the adapter answers is filtered by the policy, so a change
 * to one of them can change what any list holds.
 */
const POLICY_TABLES: ReadonlySet<TableName> = new Set<TableName>([
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
])

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // IndexedDB answers offline, and the adapter's answer is final: a refusal is not retried.
        networkMode: 'always',
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
      mutations: { networkMode: 'always', retry: false },
    },
  })
}

export function invalidateChanged(client: QueryClient, changes: readonly DataChange[]): void {
  const policyChanged = changes.some((change) => POLICY_TABLES.has(change.table))
  if (policyChanged) void client.invalidateQueries({ queryKey: [TABLE_SCOPE] })
  for (const change of changes) {
    if (ONBOARDING_TABLES.has(change.table)) void client.invalidateQueries({ queryKey: QUERY_KEYS.onboarding })
    // Under a policy change, the whole table scope above covers these already.
    if (policyChanged) continue
    void client.invalidateQueries({ queryKey: [TABLE_SCOPE, change.table] })
    if (LINK_REQUEST_TABLES.has(change.table)) void client.invalidateQueries({ queryKey: QUERY_KEYS.accountLinkRequests })
  }
  // Many tables feed the policy, and a hint is cheap to ask again (D-091).
  if (changes.length > 0) void client.invalidateQueries({ queryKey: QUERY_KEYS.can })
}

/** Nothing one identity read may stay visible to the next one. */
export function forgetIdentityData(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => !IDENTITY_INDEPENDENT.has(query.queryKey[0]) })
}
