import { CHANGE_FEED_CHANNEL, REMOTE } from '@config'
import {
  AppError,
  TABLE_SCHEMAS,
  type DataChange,
  type IdentitySource,
  type Result,
  type Session,
  type TableName,
  type Unsubscribe,
} from '@contracts'
import { z } from 'zod'
import { createChangeFeed } from '../local/changes'
import type { LocalDataAdapter } from '../local/core'
import { LiveMessage } from '../server/live'
import { realtimeListener, type LiveListener } from './live'

// The remote adapter (D-204): every call is one POST to the command gateway (D-201), which runs
// the same adapter core on the server. Nothing is decided here: the server derives the actor from
// the access token and answers every check. The client only carries the call and the answer, and
// publishes what the answer says changed to its change feed, which also reaches the other tabs.
// Writes made on other devices arrive as live announcements of the tables they changed (D-348),
// which go to the same feed, so the screens read those tables again.

/** The adapter's groups and methods are the local adapter's (D-076): what exists on one exists on the other. */
export type RemoteDataAdapter = LocalDataAdapter

export interface RemoteAdapterDependencies {
  /** The backend URL, e.g. `https://<ref>.supabase.co`. */
  readonly url: string
  /** The backend's publishable key, which its gateway asks of every caller. */
  readonly apiKey: string
  readonly identity: IdentitySource
  /** The signed-in identity's current access token, from the auth provider's client (OI-020). */
  readonly accessToken: () => Promise<string | null>
  readonly fetch: typeof fetch
}

const GatewayAnswer = z.object({
  result: z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: z.unknown() }),
    z.object({ ok: z.literal(false), error: AppError }),
  ]),
  changes: z.array(
    z.object({
      table: z.string().refine((table) => Object.hasOwn(TABLE_SCHEMAS, table)),
      ids: z.array(z.string()),
    }),
  ),
})

const failed = (code: 'unavailable' | 'unauthenticated' | 'internal'): Result<never> => ({ ok: false, error: { code } })

/** Every method of every group, so a group cannot exist on one adapter and be missing on the other. */
type MethodTable<T> = { readonly [G in keyof T]-?: { readonly [M in keyof T[G]]-?: true } }

const REFERENCE = { get: true, list: true } as const
const LIST = { list: true } as const
const EDIT = { create: true, update: true, archive: true } as const
const SORTED_EDIT = { ...EDIT, reorder: true } as const

const REPOSITORY_METHODS = {
  organizations: { current: true },
  unit_levels: REFERENCE,
  units: REFERENCE,
  command_ranks: REFERENCE,
  soldiers: REFERENCE,
  soldier_private: REFERENCE,
  unit_memberships: REFERENCE,
  soldier_preferences: { mine: true },
  account_link_requests: { ...REFERENCE, candidates: true },
  soldier_accounts: REFERENCE,
  roles: REFERENCE,
  role_permissions: LIST,
  rank_role_bindings: REFERENCE,
  access_grants: REFERENCE,
  tag_categories: REFERENCE,
  tags: REFERENCE,
  soldier_tags: LIST,
  leave_type_groups: REFERENCE,
  leave_types: REFERENCE,
  leaves: REFERENCE,
  leave_events: { ...LIST, feed: true },
  leave_comments: { ...REFERENCE, feed: true },
  availability_rules: REFERENCE,
  property_definitions: REFERENCE,
  seniority_overrides: REFERENCE,
  leave_batches: REFERENCE,
  deployments: REFERENCE,
  deployment_members: LIST,
  report_confirmations: { ...LIST, confirmable: true, sections: true },
  change_counters: { current: true },
} as const satisfies MethodTable<RemoteDataAdapter['repositories']>

const COMMAND_METHODS = {
  organizations: { bootstrapOwner: true, update: true },
  accounts: { requestLink: true, cancelLinkRequest: true, reviewLink: true, revokeLink: true, updateMyPreferences: true },
  unit_levels: SORTED_EDIT,
  units: { ...SORTED_EDIT, move: true },
  command_ranks: EDIT,
  soldiers: { ...EDIT, updatePrivate: true, setTags: true, changeMembership: true },
  roles: EDIT,
  rank_role_bindings: EDIT,
  access_grants: { grant: true, revoke: true },
  tag_categories: SORTED_EDIT,
  tags: SORTED_EDIT,
  leave_type_groups: SORTED_EDIT,
  leave_types: SORTED_EDIT,
  leaves: { create: true, update: true, transition: true, createBatch: true, createMany: true, duplicate: true },
  leave_comments: { add: true, edit: true, archive: true },
  availability_rules: EDIT,
  property_definitions: SORTED_EDIT,
  seniority_overrides: { create: true, revoke: true },
  deployments: { ...EDIT, setMembers: true, close: true, reopen: true },
  day_reports: { confirm: true },
  notifications: { subscribe: true, unsubscribe: true },
} as const satisfies MethodTable<RemoteDataAdapter['commands']>

type Call = (kind: string, group: string, method: string, args: readonly unknown[]) => Promise<Result<unknown>>

function groupsOf<T>(kind: string, table: Readonly<Record<string, Readonly<Record<string, true>>>>, call: Call): T {
  const groups = Object.entries(table).map(([group, methods]) => [
    group,
    Object.fromEntries(Object.keys(methods).map((method) => [method, (...args: unknown[]) => call(kind, group, method, args)])),
  ])
  return Object.fromEntries(groups) as T
}

const ALL_TABLES = Object.keys(TABLE_SCHEMAS) as TableName[]

export function createRemoteDataAdapter(
  { url, apiKey, identity, accessToken, fetch }: RemoteAdapterDependencies,
  channel: string = CHANGE_FEED_CHANNEL,
  listen: LiveListener = realtimeListener({ url, apiKey, accessToken }),
): RemoteDataAdapter {
  const changes = createChangeFeed(channel)
  const endpoint = new URL(REMOTE.commandsPath, url)
  /** Names this adapter in the announcements of its own writes, which it has already published. */
  const origin = crypto.randomUUID()
  const publishTables = (tables: readonly TableName[]) => changes.publish(tables.map((table) => ({ table, ids: [] })))

  // The live topic follows the latest session answer: the linked organization's, or none.
  let topic: string | null = null
  let stopListening: Unsubscribe = () => undefined
  function follow(session: Session): void {
    const next = session.status === 'linked' ? session.organization_id : null
    if (next === topic) return
    stopListening()
    stopListening = () => undefined
    topic = next
    if (next === null) return
    stopListening = listen(
      next,
      (payload) => {
        const message = LiveMessage.safeParse(payload)
        if (message.success && message.data.origin !== origin) publishTables(message.data.tables)
      },
      () => publishTables(ALL_TABLES),
    )
  }

  const call: Call = async (kind, group, method, args) => {
    let response: Response
    try {
      const token = await accessToken()
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: apiKey,
          [REMOTE.originHeader]: origin,
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ kind, group, method, args }),
        signal: AbortSignal.timeout(REMOTE.requestTimeoutMs),
      })
    } catch {
      return failed('unavailable')
    }
    // The server refused the token: it names no one, so the caller acts as no one.
    if (response.status === 401) return failed('unauthenticated')
    if (response.status >= 500) return failed('unavailable')
    if (!response.ok) return failed('internal')
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return failed('unavailable')
    }
    const answer = GatewayAnswer.safeParse(body)
    if (!answer.success) return failed('internal')
    const changed = answer.data.changes.map((change): DataChange => ({ table: change.table as TableName, ids: change.ids }))
    if (changed.length > 0) changes.publish(changed)
    return answer.data.result
  }

  const current = async () => {
    const result = (await call('session', 'session', 'current', [])) as Result<Session>
    if (result.ok) follow(result.value)
    return result
  }

  return {
    session: {
      current,
      onboardingState: () => call('session', 'session', 'onboardingState', []) as never,
      can: (checks) => call('session', 'session', 'can', [checks]) as never,
      // The session follows the identity and the soldier accounts, as on the local adapter.
      subscribe(listener: (session: Session) => void): Unsubscribe {
        let latest = 0
        const emit = () => {
          latest += 1
          const mine = latest
          void current().then((result) => {
            if (mine === latest && result.ok) listener(result.value)
          })
        }
        const stopIdentity = identity.subscribe(emit)
        const stopChanges = changes.subscribe((rows) => {
          if (rows.some((change) => change.table === 'soldier_accounts')) emit()
        })
        return () => {
          latest += 1
          stopIdentity()
          stopChanges()
        }
      },
    },
    // A batch is one request: the server runs it in that request's transaction (D-201).
    transfer: {
      importBatch: (raw) => call('transfer', 'transfer', 'importBatch', [raw]) as never,
      exportOrganization: () => call('transfer', 'transfer', 'exportOrganization', []) as never,
    },
    repositories: groupsOf('repositories', REPOSITORY_METHODS, call),
    commands: groupsOf('commands', COMMAND_METHODS, call),
    changes,
  }
}
