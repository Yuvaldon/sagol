import { REMOTE } from '@config'
import { TABLE_SCHEMAS, type DataChange, type TableName } from '@contracts'
import { z } from 'zod'
import type { SqlClient } from './postgresStore'

// Live changes (D-347): a committed write is announced to the other devices of its organization.
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

export async function announceChanges(
  client: SqlClient,
  organizations: readonly string[],
  changes: readonly DataChange[],
  origin: string | null,
): Promise<void> {
  if (organizations.length === 0 || changes.length === 0) return
  const message: LiveMessage = { origin, tables: [...new Set(changes.map((change) => change.table))] }
  for (const organization of organizations) {
    await client.query('SELECT realtime.send($1::text::jsonb, $2, $3, true)', [JSON.stringify(message), REMOTE.liveEvent, organization])
  }
}
