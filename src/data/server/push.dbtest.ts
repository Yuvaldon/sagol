import {
  AccessGrantId,
  AuthUserId,
  LeaveId,
  LeaveTypeGroupId,
  LeaveTypeId,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  SoldierPreferences,
  TABLE_SCHEMAS,
  UnitId,
  UnitMembershipId,
  LeaveCommentId,
  type AuthIdentity,
  type PushPayload,
  type Result,
} from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ContractHarness } from '../contract-tests/harness'
import { seedActor, seedRotation } from '../contract-tests/support'
import { createCommandGateway, type GatewayResponse } from './gateway'
import { CATALOG_QUERY, catalogOf, createPostgresStore, type SqlClient, type StoreCatalog } from './postgresStore'
import { createPushDispatch, type CommittedCall, type PushDevice, type PushSender } from './push'

// The push dispatch (D-354, D-355) over the migrated schema: the gateway hands each committed call over, and the
// dispatch reads who should hear about it from the committed state. The push service is a fake sender.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const NOW = '2026-11-08T10:00:00.000Z'
const ORGANIZATION = { anchor_type: 'organization' } as const
let catalog: StoreCatalog

const clientOf = (connection: postgres.Sql | postgres.TransactionSql): SqlClient => ({
  query: (text, params) => connection.unsafe(text, params),
})
const transact = ((work: (client: SqlClient) => Promise<unknown>) =>
  sql.begin('isolation level serializable', (tx) => work(clientOf(tx)))) as never

/** The support helpers only seed rows: this is the one port of the contract harness they use. */
const seeder = {
  seed: (table, rows) => createPostgresStore(clientOf(sql), catalog).table(table).bulkPut(rows as never),
} as Pick<ContractHarness, 'seed'> as ContractHarness

const owner: AuthIdentity = {
  auth_user_id: AuthUserId.parse(crypto.randomUUID()),
  provider: 'google',
  email: 'owner@example.test',
  email_verified: true,
  display_name: null,
}

let committed: CommittedCall[] = []
let gateway: ReturnType<typeof createCommandGateway>

const command = async (identity: AuthIdentity, group: string, method: string, input: unknown): Promise<GatewayResponse> =>
  gateway(identity, { kind: 'commands', group, method, args: [input] })

function valueOf(result: Result<unknown>): Record<string, unknown> {
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`)
  return result.value as Record<string, unknown>
}

class FakeSender implements PushSender {
  sent: { endpoint: string; payload: PushPayload }[] = []
  answers = new Map<string, 'gone' | 'fail'>()
  send(device: PushDevice, payload: PushPayload): Promise<'sent' | 'gone'> {
    const answer = this.answers.get(device.endpoint)
    if (answer === 'fail') return Promise.reject(new Error('push service down'))
    this.sent.push({ endpoint: device.endpoint, payload })
    return Promise.resolve(answer ?? 'sent')
  }
}

const deviceOf = (name: string) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${name}-${crypto.randomUUID()}`,
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
})

const organization = OrganizationId.parse(crypto.randomUUID())
const ownerId = SoldierId.parse(crypto.randomUUID())
let noa: Awaited<ReturnType<typeof seedActor>>
let ari: Awaited<ReturnType<typeof seedActor>>
let devices: Record<'owner' | 'noa' | 'ari', ReturnType<typeof deviceOf>>
let rotation: string
let typeId: LeaveTypeId
let sender: FakeSender
let logs: string[]
let dispatch: (call: CommittedCall) => Promise<void>

/** Runs the dispatch of every call committed since the last one. */
async function dispatchCommitted() {
  const calls = committed
  committed = []
  for (const call of calls) await dispatch(call)
  return calls.length
}

const pendingLeave = async () => {
  const response = await command(owner, 'leaves', 'create', {
    id: LeaveId.parse(crypto.randomUUID()),
    soldier_id: noa.soldierId,
    leave_type_id: typeId,
    deployment_id: rotation,
    start_date: '2026-11-15',
    end_date: '2026-11-16',
    availability_effect_override: null,
    reason: null,
    properties: {},
    as_approved: false,
    acknowledged_rule_ids: [],
    comment: null,
  })
  return valueOf(response.result) as { id: LeaveId; version: number }
}

const subscriptionsOf = async () => (await sql.unsafe('SELECT endpoint FROM push_subscriptions')).map((row) => row.endpoint as string)

beforeAll(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
  gateway = createCommandGateway({
    transact,
    catalog,
    time: { now: () => NOW },
    bootstrapOwnerEmail: owner.email,
    afterCommit: (call) => {
      committed.push(call)
    },
  })
  valueOf(
    (
      await command(owner, 'organizations', 'bootstrapOwner', {
        organization: { id: organization, name: 'Company', timezone: 'Asia/Jerusalem' },
        root_unit_id: UnitId.parse(crypto.randomUUID()),
        soldier: { id: ownerId, first_name: 'Dana', last_name: 'Levi' },
        membership_id: UnitMembershipId.parse(crypto.randomUUID()),
        owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
        account_id: SoldierAccountId.parse(crypto.randomUUID()),
        access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
        rotation_group: { id: LeaveTypeGroupId.parse(crypto.randomUUID()), name: 'Rotation leave' },
        rotation_type: { id: LeaveTypeId.parse(crypto.randomUUID()), name: 'Rotation leave 1' },
      })
    ).result,
  )
  noa = await seedActor(seeder, organization, [], ORGANIZATION)
  ari = await seedActor(seeder, organization, [{ resource: 'leaves', action: 'approve' }], ORGANIZATION)
  rotation = await seedRotation(seeder, organization, [noa.soldierId])
  typeId = LeaveTypeId.parse(crypto.randomUUID())
  valueOf(
    (
      await command(owner, 'leave_types', 'create', {
        id: typeId,
        group_id: null,
        name: 'Home',
        color_key: 'teal',
        icon_key: null,
        availability_effect: 'unavailable',
        requires_reason: false,
        sort_order: 0,
      })
    ).result,
  )
  devices = { owner: deviceOf('owner'), noa: deviceOf('noa'), ari: deviceOf('ari') }
  valueOf((await command(owner, 'notifications', 'subscribe', devices.owner)).result)
  valueOf((await command(noa.identity, 'notifications', 'subscribe', devices.noa)).result)
  valueOf((await command(ari.identity, 'notifications', 'subscribe', devices.ari)).result)
})

beforeEach(() => {
  committed = []
  sender = new FakeSender()
  logs = []
  dispatch = createPushDispatch({ transact, catalog, time: { now: () => NOW }, sender, log: (line) => logs.push(line) })
})

afterAll(async () => {
  await sql.end()
})

describe('push dispatch (D-354, D-355)', () => {
  it('tells the approvers of a new pending leave, never its actor or its soldier', async () => {
    await pendingLeave()
    expect(await dispatchCommitted()).toBe(1)
    expect(sender.sent).toEqual([
      {
        endpoint: devices.ari.endpoint,
        payload: expect.objectContaining({ kind: 'awaiting_me', soldier_name: 'Noa Cohen', count: 1, start_date: '2026-11-15' }),
      },
    ])
    expect(logs).toEqual([JSON.stringify({ push: { sent: 1, gone: 0, failed: 0 } })])
    expect(logs.join()).not.toContain('push.example.test')
  })

  it("tells the leave's soldier of a step on it, and of a shared comment", async () => {
    const leave = await pendingLeave()
    await dispatchCommitted()
    sender.sent = []
    const step = await command(owner, 'leaves', 'transition', {
      id: leave.id,
      expected_version: leave.version,
      transition: 'approve',
      acknowledged_rule_ids: [],
      comment: null,
    })
    valueOf(step.result)
    await command(owner, 'leave_comments', 'add', { id: LeaveCommentId.parse(crypto.randomUUID()), leave_id: leave.id, body: 'Enjoy', visibility: 'shared' })
    await dispatchCommitted()
    expect(sender.sent.map((push) => [push.endpoint, push.payload.kind, 'outcome' in push.payload ? push.payload.outcome : null])).toEqual([
      [devices.noa.endpoint, 'my_request', 'approved'],
      [devices.noa.endpoint, 'my_request', 'comment'],
    ])
  })

  it('hands over nothing for a refused call, a read, or a write the clients never sync', async () => {
    const refused = await command(owner, 'leaves', 'transition', {
      id: LeaveId.parse(crypto.randomUUID()),
      expected_version: 1,
      transition: 'approve',
      acknowledged_rule_ids: [],
      comment: null,
    })
    expect(refused.result.ok).toBe(false)
    await gateway(owner, { kind: 'repositories', group: 'units', method: 'list', args: [{ include_archived: false }] })
    expect(committed).toEqual([])
    // An install is not synced to any client (D-351), so its write publishes no change.
    valueOf((await command(owner, 'notifications', 'subscribe', deviceOf('owner'))).result)
    expect(await dispatchCommitted()).toBe(0)
    expect(sender.sent).toEqual([])
    expect(logs).toEqual([])
  })

  it('respects the soldier own choice of kinds (D-358)', async () => {
    const preferences = SoldierPreferences.parse({ notifications: { awaiting_me: false } })
    valueOf((await command(ari.identity, 'accounts', 'updateMyPreferences', { expected_version: null, preferences })).result)
    await pendingLeave()
    await dispatchCommitted()
    expect(sender.sent).toEqual([])
    const stored = await sql.unsafe('SELECT version FROM soldier_preferences WHERE soldier_id = $1', [ari.soldierId])
    const restored = SoldierPreferences.parse({})
    valueOf(
      (await command(ari.identity, 'accounts', 'updateMyPreferences', { expected_version: stored[0]?.version, preferences: restored })).result,
    )
  })

  it('forgets an install the push service no longer knows, and survives a failing service', async () => {
    const leave = await pendingLeave()
    committed = []
    sender.answers.set(devices.noa.endpoint, 'gone')
    valueOf(
      (await command(owner, 'leaves', 'transition', { id: leave.id, expected_version: leave.version, transition: 'reject', acknowledged_rule_ids: [], comment: null }))
        .result,
    )
    await dispatchCommitted()
    expect(await subscriptionsOf()).not.toContain(devices.noa.endpoint)
    expect(logs).toEqual([JSON.stringify({ push: { sent: 0, gone: 1, failed: 0 } })])

    logs = []
    const failing = createPushDispatch({
      transact,
      catalog,
      time: { now: () => NOW },
      sender: { send: () => Promise.reject(new Error('down')) },
      log: (line) => logs.push(line),
    })
    await pendingLeave()
    const [call] = committed
    committed = []
    if (call === undefined) throw new Error('nothing committed')
    await expect(failing(call)).resolves.toBeUndefined()
    expect(logs).toEqual([JSON.stringify({ push: { sent: 0, gone: 0, failed: 1 } })])
    expect(await subscriptionsOf()).toContain(devices.ari.endpoint)
  })

  it('never throws, whatever the store does', async () => {
    const broken = createPushDispatch({
      transact: () => Promise.reject(new Error('database down')),
      catalog,
      time: { now: () => NOW },
      sender,
      log: (line) => logs.push(line),
    })
    await expect(broken({ identity: owner, changes: [{ table: 'leave_events', ids: [crypto.randomUUID()] }] })).resolves.toBeUndefined()
    expect(logs).toEqual([JSON.stringify({ push: { code: 'dispatch_failed' } })])
  })
})
