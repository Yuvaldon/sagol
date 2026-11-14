import { REMOTE } from '@config'
import {
  AccessGrantId,
  AccountLinkRequestId,
  AuthUserId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  TABLE_SCHEMAS,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
} from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCommandGateway } from './gateway'
import { LiveMessage, identityTopic } from './live'
import { CATALOG_QUERY, catalogOf, type SqlClient, type StoreCatalog } from './postgresStore'

// Live changes (D-348): a committed write is broadcast on its organization's private topic, and
// only a live member of that organization may hear the topic (the policy on `realtime.messages`).
// Plain Postgres has no Realtime: `db-reset` gives it the table and `send` the policy relies on.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const NOW = '2026-11-08T10:00:00.000Z'
let catalog: StoreCatalog

const owner: AuthIdentity = {
  auth_user_id: AuthUserId.parse(crypto.randomUUID()),
  provider: 'google',
  email: 'owner@example.test',
  email_verified: true,
  display_name: null,
}
const requester: AuthIdentity = {
  auth_user_id: AuthUserId.parse(crypto.randomUUID()),
  provider: 'google',
  email: 'requester@example.test',
  email_verified: true,
  display_name: null,
}
const organization = OrganizationId.parse(crypto.randomUUID())
const origin = crypto.randomUUID()

const clientOf = (connection: postgres.Sql | postgres.TransactionSql): SqlClient => ({
  query: (text, params) => connection.unsafe(text, params),
})

const gateway = () =>
  createCommandGateway({
    transact: (work) => sql.begin('isolation level serializable', (tx) => work(clientOf(tx))) as never,
    catalog,
    time: { now: () => NOW },
    bootstrapOwnerEmail: owner.email,
  })

const bootstrap = () => ({
  kind: 'commands',
  group: 'organizations',
  method: 'bootstrapOwner',
  args: [
    {
      organization: { id: organization, name: 'Company', timezone: 'Asia/Jerusalem' },
      root_unit_id: UnitId.parse(crypto.randomUUID()),
      soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
      owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      rotation_group: { id: LeaveTypeGroupId.parse(crypto.randomUUID()), name: 'Rotation leave' },
      rotation_type: { id: LeaveTypeId.parse(crypto.randomUUID()), name: 'Rotation leave 1' },
    },
  ],
})

const messages = async (topic?: string) => {
  const rows = (await sql.unsafe('SELECT topic, extension, event, payload, private FROM realtime.messages ORDER BY id')) as unknown as {
    topic: string
    extension: string
    event: string
    payload: unknown
    private: boolean
  }[]
  return topic === undefined ? rows : rows.filter((row) => row.topic === topic)
}

/** The tables of the latest announcement on `topic`. */
const lastTables = async (topic: string) => {
  const sent = await messages(topic)
  return [...LiveMessage.parse(sent.at(-1)?.payload).tables].sort()
}

/** How many announcements `user` may read on `topic`, as Realtime asks when that user joins it. */
async function heard(user: string | null, topic: string): Promise<number> {
  return sql.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE authenticated')
    await tx.unsafe("SELECT set_config('request.jwt.claims', $1, true), set_config('realtime.topic', $2, true)", [
      JSON.stringify(user === null ? { role: 'authenticated' } : { sub: user, role: 'authenticated' }),
      topic,
    ])
    const rows = await tx.unsafe('SELECT count(*)::int AS count FROM realtime.messages')
    return Number(rows[0]?.count ?? 0)
  }) as Promise<number>
}

beforeAll(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  await sql.unsafe('DELETE FROM realtime.messages')
  catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
})

afterAll(async () => {
  await sql.end()
})

describe('live changes (D-348)', () => {
  it("announces a committed write once, on its organization's private topic, by table name only", async () => {
    const answer = await gateway()(owner, bootstrap(), origin)
    expect(answer.result.ok).toBe(true)
    const sent = await messages(organization)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ topic: organization, extension: 'broadcast', event: REMOTE.liveEvent, private: true })
    const message = LiveMessage.parse(sent[0]?.payload)
    expect(message.origin).toBe(origin)
    expect([...message.tables].sort()).toEqual([...new Set(answer.changes.map((change) => change.table))].sort())
    expect(JSON.stringify(sent[0]?.payload)).not.toContain(owner.email)
    // The owner's own account row is announced to their identity too, and nothing else is (D-437).
    expect(await messages(identityTopic(owner.auth_user_id))).toHaveLength(1)
    expect(await lastTables(identityTopic(owner.auth_user_id))).toEqual(['soldier_accounts'])
    expect(await messages()).toHaveLength(2)
  })

  it('announces nothing for a refused call or a read', async () => {
    const before = (await messages()).length
    expect((await gateway()(owner, bootstrap(), origin)).result.ok).toBe(false)
    expect((await gateway()(owner, { kind: 'repositories', group: 'units', method: 'list', args: [{ include_archived: false }] })).result.ok).toBe(true)
    expect(await messages()).toHaveLength(before)
  })

  it("announces a link request's answer on the requester's own topic (D-437)", async () => {
    const topic = identityTopic(requester.auth_user_id)
    const id = AccountLinkRequestId.parse(crypto.randomUUID())
    const request = {
      kind: 'commands',
      group: 'accounts',
      method: 'requestLink',
      args: [{ id, claimed_personal_id: null, first_name: 'Noa', last_name: 'Cohen', account_id: SoldierAccountId.parse(crypto.randomUUID()) }],
    }
    const asked = await gateway()(requester, request, origin)
    expect(asked.result).toEqual({ ok: true, value: { outcome: 'pending_review' } })
    expect(await lastTables(topic)).toEqual(['account_link_requests'])

    const review = { kind: 'commands', group: 'accounts', method: 'reviewLink', args: [{ id, resolution: { kind: 'reject' } }] }
    expect((await gateway()(owner, review, crypto.randomUUID())).result.ok).toBe(true)
    const sent = await messages(topic)
    expect(sent).toHaveLength(2)
    expect(await lastTables(topic)).toEqual(['account_link_requests'])
    expect(JSON.stringify(sent.map((row) => row.payload))).not.toContain(requester.email)
  })

  it('lets each identity hear its own topic and no other (D-437)', async () => {
    const topic = identityTopic(requester.auth_user_id)
    expect(await heard(requester.auth_user_id, topic)).toBeGreaterThan(0)
    expect(await heard(owner.auth_user_id, topic)).toBe(0)
    expect(await heard(null, topic)).toBe(0)
    // A pending requester hears nothing of the organization.
    expect(await heard(requester.auth_user_id, organization)).toBe(0)
  })

  it("lets only a live member of the organization hear its topic", async () => {
    expect(await heard(owner.auth_user_id, organization)).toBeGreaterThan(0)
    expect(await heard(crypto.randomUUID(), organization)).toBe(0)
    expect(await heard(null, organization)).toBe(0)
    expect(await heard(owner.auth_user_id, crypto.randomUUID())).toBe(0)
    await sql.unsafe("UPDATE soldier_accounts SET revoked_at = now() WHERE auth_user_id = $1", [owner.auth_user_id])
    expect(await heard(owner.auth_user_id, organization)).toBe(0)
  })
})
