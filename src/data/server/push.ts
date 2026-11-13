import {
  SoldierPreferences,
  type AuthIdentity,
  type DataChange,
  type LeaveId,
  type PushPayload,
  type PushSubscriptionRecord,
  type SoldierId,
  type TableName,
  type TableRow,
  type TimeSource,
} from '@contracts'
import { NOTIFICATIONS } from '@config'
import { pushPayloadOf, pushRecipients, type PushAudience, type PushCommandEffect } from '@domain'
import { parsedRow } from '../local/failure'
import { resolveSession } from '../local/session'
import { loadPolicySnapshot } from '../local/snapshot'
import { tableOf, type Store } from '../local/store'
import type { Transact } from './gateway'
import { createPostgresStore, type StoreCatalog } from './postgresStore'

// The push dispatch (D-354): after a call committed, who gets a push about what it wrote (D-355), sent through the
// `PushSender` port. Best effort: it never throws, and nothing it does changes the call's answer.

/** One browser install, as the push service knows it. */
export type PushDevice = Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>

/**
 * Sends one encrypted push. Answers `gone` when the push service says the install no longer exists (404 or 410), so
 * its row goes; throws on any other failure.
 */
export interface PushSender {
  send(device: PushDevice, payload: PushPayload): Promise<'sent' | 'gone'>
}

export interface PushDispatchDependencies {
  readonly transact: Transact
  readonly catalog: StoreCatalog
  readonly time: TimeSource
  readonly sender: PushSender
  /** The function's log: counts and codes only, never an endpoint or a payload (D-335). */
  readonly log: (line: string) => void
}

/** One committed call: who made it, and what it changed. */
export interface CommittedCall {
  readonly identity: AuthIdentity
  readonly changes: readonly DataChange[]
}

const READ_TABLES: readonly TableName[] = [
  'leaves',
  'leave_events',
  'leave_comments',
  'soldier_preferences',
  'push_subscriptions',
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
]

interface Delivery {
  readonly subscriptionId: PushSubscriptionRecord['id']
  readonly device: PushDevice
  readonly payload: PushPayload
}

function idsOf(changes: readonly DataChange[], table: TableName): string[] {
  return [...new Set(changes.filter((change) => change.table === table).flatMap((change) => change.ids))]
}

async function rowsById<T extends TableName>(store: Store, table: T, ids: readonly string[]): Promise<TableRow<T>[]> {
  const rows = await Promise.all(ids.map((id) => tableOf(store, table).get(id)))
  return rows.filter((row) => row !== undefined).map((row) => parsedRow(table, row))
}

/** Everything the pushes of one call need, from one read of the committed state. */
async function deliveriesOf(store: Store, call: CommittedCall, now: string): Promise<Delivery[]> {
  const session = await resolveSession(store, call.identity)
  if (session.status !== 'linked') return []
  const events = await rowsById(store, 'leave_events', idsOf(call.changes, 'leave_events'))
  const comments = await rowsById(store, 'leave_comments', idsOf(call.changes, 'leave_comments'))
  if (events.length === 0 && comments.length === 0) return []
  const leaveIds = [...new Set([...events, ...comments].map((row) => row.leave_id))]
  const leaves = new Map((await rowsById(store, 'leaves', leaveIds)).map((leave) => [leave.id, leave]))
  const effect: PushCommandEffect = { actorId: session.soldier_id, leaves, events, comments }

  const { context } = await loadPolicySnapshot(store, session.organization_id, now)
  const subscriptions = (await tableOf(store, 'push_subscriptions').where('organization_id').equals(session.organization_id).toArray()).map(
    (row) => parsedRow('push_subscriptions', row),
  )
  const devicesOf = new Map<SoldierId, PushSubscriptionRecord[]>()
  for (const subscription of subscriptions) devicesOf.set(subscription.soldier_id, [...(devicesOf.get(subscription.soldier_id) ?? []), subscription])

  // Who would get one, then their own choices: only the candidates' preferences are read.
  const audience: PushAudience = { policy: context, wants: () => true, subscribed: new Set(devicesOf.keys()) }
  const candidates = pushRecipients(effect, audience)
  const preferences = new Map<SoldierId, SoldierPreferences>()
  for (const soldierId of new Set(candidates.map((candidate) => candidate.soldier_id))) {
    const stored = await tableOf(store, 'soldier_preferences').get(soldierId)
    preferences.set(soldierId, SoldierPreferences.parse(stored === undefined ? {} : parsedRow('soldier_preferences', stored).preferences))
  }
  const recipients = pushRecipients(effect, {
    ...audience,
    wants: (soldierId, kind) => preferences.get(soldierId)?.notifications[kind] ?? true,
  })

  const names = new Map<SoldierId, string>()
  const nameOf = async (soldierId: SoldierId) => {
    const known = names.get(soldierId)
    if (known !== undefined) return known
    const stored = await tableOf(store, 'soldiers').get(soldierId)
    const soldier = stored === undefined ? null : parsedRow('soldiers', stored)
    const name = soldier === null ? '' : `${soldier.first_name} ${soldier.last_name}`
    names.set(soldierId, name)
    return name
  }

  const deliveries: Delivery[] = []
  for (const recipient of recipients) {
    const first: LeaveId | undefined = recipient.leave_ids[0]
    const leave = first === undefined ? undefined : leaves.get(first)
    if (leave === undefined) continue
    const payload = pushPayloadOf(recipient, leave, await nameOf(leave.soldier_id))
    for (const device of devicesOf.get(recipient.soldier_id) ?? []) {
      deliveries.push({
        subscriptionId: device.id,
        device: { endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth },
        payload,
      })
    }
  }
  return deliveries
}

export function createPushDispatch({ transact, catalog, time, sender, log }: PushDispatchDependencies) {
  const write = (line: Record<string, unknown>) => {
    log(JSON.stringify({ push: line }))
  }
  return async function dispatch(call: CommittedCall): Promise<void> {
    try {
      if (idsOf(call.changes, 'leave_events').length === 0 && idsOf(call.changes, 'leave_comments').length === 0) return
      const all = await transact(async (client) => {
        const store = createPostgresStore(client, catalog)
        return store.transaction('r', READ_TABLES, () => deliveriesOf(store, call, time.now()))
      })
      if (all.length === 0) return
      const deliveries = all.slice(0, NOTIFICATIONS.maxPushesPerCommand)
      if (all.length > deliveries.length) write({ skipped: all.length - deliveries.length })
      const outcomes = await Promise.allSettled(deliveries.map((delivery) => sender.send(delivery.device, delivery.payload)))
      const gone = deliveries.filter((_, index) => {
        const outcome = outcomes[index]
        return outcome?.status === 'fulfilled' && outcome.value === 'gone'
      })
      const failed = outcomes.filter((outcome) => outcome.status === 'rejected').length
      if (gone.length > 0) {
        // Its own short transaction: a dead install is forgotten whatever the rest did.
        await transact(async (client) => {
          const store = createPostgresStore(client, catalog)
          await tableOf(store, 'push_subscriptions').bulkDelete(gone.map((delivery) => delivery.subscriptionId))
        })
      }
      write({ sent: deliveries.length - gone.length - failed, gone: gone.length, failed })
    } catch {
      write({ code: 'dispatch_failed' })
    }
  }
}
