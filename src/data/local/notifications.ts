import type { Store } from './store'
import { SubscribePushInput, UnsubscribePushInput, type DataCommands, type SoldierId, type TableName } from '@contracts'
import { tableOf } from './store'
import type { LocalDependencies } from './dependencies'
import { asResult, fail, parseInput, parsedRow } from './failure'
import { requireLinked, resolveSession } from './session'

// Phone notifications of the signed-in soldier's browser installs (D-351). The rows are the soldier's own, like
// their preferences: no permission resource, a linked account only. This adapter only stores them; sending is the
// server gateway's, after its transaction commits (D-355).

const SUBSCRIPTION_TABLES: readonly TableName[] = ['soldier_accounts', 'push_subscriptions']

/** Every browser install of the soldier stops getting pushes: an account revoked, a soldier archived (D-351). */
export async function deleteSubscriptionsOf(database: Store, soldierId: SoldierId): Promise<void> {
  const table = tableOf(database, 'push_subscriptions')
  const rows = await table.where('soldier_id').equals(soldierId).toArray()
  await table.bulkDelete(rows.map((row) => row.id))
}

export function createNotificationCommands(dependencies: LocalDependencies): DataCommands['notifications'] {
  const { database, identity, time } = dependencies
  return {
    subscribe: (raw) =>
      asResult(async () => {
        const input = parseInput(SubscribePushInput, raw)
        await database.transaction('rw', SUBSCRIPTION_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const table = tableOf(database, 'push_subscriptions')
          const stored = await table.where('endpoint').equals(input.endpoint).first()
          // The endpoint names the install: a row stored for another soldier moves to the caller with its id.
          await table.put(
            parsedRow('push_subscriptions', {
              id: stored?.id ?? crypto.randomUUID(),
              organization_id: actor.organization_id,
              soldier_id: actor.soldier_id,
              ...input,
              created_at: stored !== undefined && stored.soldier_id === actor.soldier_id ? stored.created_at : time.now(),
            }),
          )
        })
        return { subscribed: true as const }
      }),
    unsubscribe: (raw) =>
      asResult(async () => {
        const input = parseInput(UnsubscribePushInput, raw)
        await database.transaction('rw', SUBSCRIPTION_TABLES, async () => {
          const actor = requireLinked(await resolveSession(database, identity.current()))
          const table = tableOf(database, 'push_subscriptions')
          const stored = await table.where('endpoint').equals(input.endpoint).first()
          if (stored === undefined) return
          // Another soldier's install answers as if it did not exist (D-046).
          if (stored.soldier_id !== actor.soldier_id) fail({ code: 'not_found' })
          await table.bulkDelete([stored.id])
        })
        return { subscribed: false as const }
      }),
  }
}
