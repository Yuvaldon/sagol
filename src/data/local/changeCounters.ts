import { ChangeSeq, type DataRepositories, type OrganizationId } from '@contracts'
import { loadActorScope } from './actor'
import type { LocalDependencies } from './dependencies'
import { asResult } from './failure'
import { POLICY_TABLES } from './snapshot'
import { tableOf, type Store } from './store'

// The organization's change counter (D-373): the one row every leave and membership writer reads and writes in its
// own transaction, so the numbers follow commit order. Callers list `change_counters` in their transaction.

/** The next change number of the organization, written back inside the caller's transaction. */
export async function nextChangeSeq(database: Store, organizationId: OrganizationId): Promise<ChangeSeq> {
  const table = tableOf(database, 'change_counters')
  const current = await table.get(organizationId)
  const next = ChangeSeq.parse((current?.last_seq ?? 0) + 1)
  await table.put({ organization_id: organizationId, last_seq: next })
  return next
}

/** What the feed is told when a write took a number: readers of the counter refresh. */
export function counterChange(organizationId: OrganizationId) {
  return { table: 'change_counters' as const, ids: [organizationId] }
}

export function createChangeCounterRepository(dependencies: LocalDependencies): DataRepositories['change_counters'] {
  const { database } = dependencies
  return {
    current: () =>
      asResult(() =>
        database.transaction('r', [...POLICY_TABLES, 'change_counters'], async () => {
          const scope = await loadActorScope(dependencies)
          const row = await tableOf(database, 'change_counters').get(scope.organization_id)
          return ChangeSeq.parse(row?.last_seq ?? 0)
        }),
      ),
  }
}
