import { REMOTE } from '@config'
import { TABLE_SCHEMAS, type DataChange, type TableName } from '@contracts'
import { z } from 'zod'
import type { SqlClient } from './postgresStore'

// Live changes (D-348): a committed write is announced to the other devices of its organization.
// The gateway sends one Realtime broadcast per organization the request wrote to, on the private
// topic named by that organization's id, inside the request's own transaction: Realtime delivers it
// on commit, so a request that rolls back (or is retried) announces nothing. The message names the
// tables that changed and the adapter that wrote them, never a row or an id: a member who may not
// read a row learns only that its table moved, and reads it again through the gateway's checks.

const TABLE_NAMES = Object.keys(TABLE_SCHEMAS) as [TableName, ...TableName[]]

/** One announcement, as a listening adapter receives it. */
export const LiveMessage = z.object({
  /** The writing adapter's origin id, or null when it sent none. */
  origin: z.uuid().nullable(),
  tables: z.array(z.enum(TABLE_NAMES)).min(1),
})
export type LiveMessage = z.infer<typeof LiveMessage>

/** The origin id a request header carries: a uuid, or nothing at all. */
export const LiveOrigin = z.uuid()

/** Where a request's writes are announced: the organizations it wrote, and the identities whose own rows it wrote. */
export interface LiveAudience {
  readonly organizations: readonly string[]
  readonly identities: ReadonlyMap<string, readonly TableName[]>
}

/** The topic an identity hears alone (D-437): its link request's answer reaches it before it is a member. */
export const identityTopic = (authUserId: string) => `${REMOTE.identityTopicPrefix}${authUserId}`

export async function announceChanges(
  client: SqlClient,
  audience: LiveAudience,
  changes: readonly DataChange[],
  origin: string | null,
): Promise<void> {
  if (changes.length === 0) return
  const send = (message: LiveMessage, topic: string) =>
    client.query('SELECT realtime.send($1::text::jsonb, $2, $3, true)', [JSON.stringify(message), REMOTE.liveEvent, topic])
  const message: LiveMessage = { origin, tables: [...new Set(changes.map((change) => change.table))] }
  for (const organization of audience.organizations) await send(message, organization)
  // An identity hears only the tables of its own rows, the rows it may read about itself.
  for (const [identity, tables] of audience.identities) {
    if (tables.length > 0) await send({ origin, tables: [...tables] }, identityTopic(identity))
  }
}
