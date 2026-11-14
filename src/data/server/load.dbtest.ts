import 'fake-indexeddb/auto'
import {
  LeaveTypeGroupId,
  DeploymentId,
  AccessGrantId,
  AuthUserId,
  CommandRankId,
  EXPORT_FORMAT_VERSION,
  LeaveCommentId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  TABLE_SCHEMAS,
  UnitId,
  UnitMembershipId,
  type AuthIdentity,
  type OrganizationExport,
  type Result,
  type Unsubscribe,
} from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLocalDataAdapter } from '../local/adapter'
import { createCommandGateway } from './gateway'
import { CATALOG_QUERY, catalogOf, type SqlClient, type StoreCatalog } from './postgresStore'

// Loading a local export into the backend once (OI-109, D-206): what the local adapter exported, the
// server exports again, row for row. Sample data, test file only.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
let catalog: StoreCatalog

const NOW = '2026-11-08T10:00:00.000Z'
const TODAY = '2026-11-08'
const TOMORROW = '2026-11-09'

beforeAll(async () => {
  catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
})

beforeEach(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
})

afterAll(async () => {
  await sql.end()
})

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${result.error.code}`)
  return result.value
}

const clientOf = (connection: postgres.Sql | postgres.TransactionSql): SqlClient => ({
  query: (text, params) => connection.unsafe(text, params),
})

const owner: AuthIdentity = {
  auth_user_id: AuthUserId.parse(crypto.randomUUID()),
  provider: 'google',
  email: 'owner@example.test',
  email_verified: true,
  display_name: null,
}

/** An organization kept by the local adapter, with the cycles a load must close: a baseline role, an owner with a
 * rank the owner created, nested units, and a leave with its history and a comment. */
async function localExport(): Promise<OrganizationExport> {
  const names = crypto.randomUUID()
  const adapter = createLocalDataAdapter(
    {
      identity: { current: () => owner, subscribe: (): Unsubscribe => () => undefined },
      time: { now: () => NOW },
      rotationLeave: { group: 'Rotation leave', type: 'Rotation leave' },
    },
    { database: `load-${names}`, channel: `load-${names}` },
  )
  const { commands } = adapter
  const organizationId = OrganizationId.parse(crypto.randomUUID())
  const ownerId = SoldierId.parse(crypto.randomUUID())
  const ownerRole = RoleId.parse(crypto.randomUUID())
  // The claim writes the root unit (D-251); the tree grows under it.
  const company = UnitId.parse(crypto.randomUUID())
  valueOf(
    await commands.organizations.bootstrapOwner({
      organization: { id: organizationId, name: 'Company', timezone: 'Asia/Jerusalem' },
      soldier: { id: ownerId, first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: ownerRole, name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      root_unit_id: company,
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
      rotation_group: { id: LeaveTypeGroupId.parse(crypto.randomUUID()), name: 'Rotation leave' },
      rotation_type: { id: LeaveTypeId.parse(crypto.randomUUID()), name: 'Rotation leave 1' },
    }),
  )
  valueOf(await commands.organizations.update({ expected_version: 1, changes: { baseline_role_id: ownerRole } }))
  const rank = valueOf(
    await commands.command_ranks.create({
      id: CommandRankId.parse(crypto.randomUUID()),
      title: 'Commander',
      short_title: null,
      seniority: 9,
      color_key: null,
    }),
  )
  valueOf(await commands.soldiers.update({ id: ownerId, expected_version: 1, changes: { command_rank_id: rank.id } }))
  const unit = async (name: string, parent_id: UnitId | null) =>
    valueOf(
      await commands.units.create({
        id: UnitId.parse(crypto.randomUUID()),
        parent_id,
        sort_order: 0,
        name,
        code: null,
        unit_level_id: null,
        kind: 'standing',
        valid_from: null,
        valid_to: null,
        color_key: null,
        properties: {},
      }),
    ).id
  // Children before parents in id order, so a load that kept the stored order would fail.
  const platoon = await unit('Platoon', company)
  const squad = await unit('Squad', platoon)
  const soldier = valueOf(
    await commands.soldiers.create({
      id: SoldierId.parse(crypto.randomUUID()),
      first_name: 'Yael',
      last_name: 'Bar',
      nickname: null,
      command_rank_id: null,
      status: 'active',
      properties: {},
      private: null,
      membership: { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: squad, valid_from: TODAY },
    }),
  )
  const type = valueOf(
    await commands.leave_types.create({
      id: LeaveTypeId.parse(crypto.randomUUID()),
      group_id: null,
      name: 'Home',
      color_key: 'teal',
      icon_key: null,
      availability_effect: 'unavailable',
      requires_reason: false,
      sort_order: 0,
    }),
  )
  // The rotation the request is asked in (D-216).
  const rotation = valueOf(
    await commands.deployments.create({ id: DeploymentId.parse(crypto.randomUUID()), name: 'Rotation', unit_id: company, start_date: TODAY, end_date: null, report_owner_id: null }),
  )
  valueOf(
    await commands.deployments.setMembers({
      deployment_id: rotation.id,
      expected_version: rotation.version,
      members: [{ soldier_id: soldier.id, start_date: null, end_date: null }],
    }),
  )
  const leave = valueOf(
    await commands.leaves.create({
      id: LeaveId.parse(crypto.randomUUID()),
      soldier_id: soldier.id,
      leave_type_id: type.id,
      deployment_id: rotation.id,
      start_date: TODAY,
      end_date: TOMORROW,
      availability_effect_override: null,
      reason: null,
      properties: {},
      as_approved: false,
      acknowledged_rule_ids: [],
      comment: null,
    }),
  )
  valueOf(
    await commands.leaves.transition({
      id: leave.id,
      expected_version: leave.version,
      transition: 'approve',
      acknowledged_rule_ids: [],
      comment: null,
    }),
  )
  valueOf(
    await commands.leave_comments.add({ id: LeaveCommentId.parse(crypto.randomUUID()), leave_id: leave.id, body: 'Note', visibility: 'shared' }),
  )
  return valueOf(await adapter.transfer.exportOrganization())
}

const load = (payload: unknown) => sql`SELECT load_organization_export(${JSON.stringify(payload)}::text::jsonb) AS id`

const gatewayOf = () =>
  createCommandGateway({
    transact: (work) => sql.begin('isolation level serializable', (tx) => work(clientOf(tx))) as never,
    catalog,
    time: { now: () => NOW },
    bootstrapOwnerEmail: owner.email,
  })

async function serverExport(): Promise<OrganizationExport> {
  const answer = await gatewayOf()(owner, {
    kind: 'transfer',
    group: 'transfer',
    method: 'exportOrganization',
    args: [],
  })
  return valueOf(answer.result as Result<OrganizationExport>)
}

/** The rows of every table, in one order, so two exports compare as sets. A leave event's time is left out: the server
 * moves a tie a millisecond later (D-206), and `eventOrder` holds the sequence instead. */
function rowsOf(exported: OrganizationExport) {
  return Object.fromEntries(
    Object.entries(exported.tables).map(([table, rows]) => [
      table,
      (rows as readonly Record<string, unknown>[])
        .map((row) => (table === 'leave_events' ? { ...row, created_at: undefined } : row))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ]),
  )
}

/** The event ids by time, ties in stored order. */
function eventOrder(exported: OrganizationExport) {
  return [...exported.tables.leave_events]
    .map((event, position) => ({ event, position }))
    .sort((a, b) => a.event.created_at.localeCompare(b.event.created_at) || a.position - b.position)
    .map(({ event }) => event.id)
}

describe('loading a local export into the backend (OI-109)', () => {
  it('stores every row as exported: the server exports the same organization', async () => {
    const exported = await localExport()
    const [loaded] = await load(exported)
    expect(loaded?.id).toBe(exported.tables.organizations[0]?.id)
    const again = await serverExport()
    expect(again.format_version).toBe(EXPORT_FORMAT_VERSION)
    expect(rowsOf(again)).toEqual(rowsOf(exported))
    expect(exported.tables.leave_events.length).toBeGreaterThan(1)
    expect(eventOrder(again)).toEqual(eventOrder(exported))
    const times = new Set(again.tables.leave_events.map((event) => event.created_at))
    expect(times.size).toBe(again.tables.leave_events.length)
  })

  it('derives the unit tree from the stored parents', async () => {
    const exported = await localExport()
    await load(exported)
    const depths = await sql`SELECT max("depth") AS deepest, count(*)::int AS links FROM "unit_closure"`
    // Three nested units: three self links, two parent links and one grandparent link.
    expect(depths[0]).toEqual({ deepest: 2, links: 6 })
  })

  it('refuses an organization already in the backend, and writes nothing on a refusal', async () => {
    const exported = await localExport()
    await load(exported)
    await expect(load(exported)).rejects.toMatchObject({ code: '23505' })
    await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
    const foreign = { ...exported.tables.units[0], organization_id: crypto.randomUUID() }
    const mixed = { ...exported, tables: { ...exported.tables, units: [...exported.tables.units, foreign] } }
    await expect(load(mixed)).rejects.toMatchObject({ code: '22023' })
    expect(await sql`SELECT 1 FROM "organizations"`).toHaveLength(0)
  })

  it('refuses another format, an unknown table and the derived closure', async () => {
    const exported = await localExport()
    await expect(load({ ...exported, format_version: EXPORT_FORMAT_VERSION + 1 })).rejects.toMatchObject({
      code: '22023',
    })
    await expect(load({ ...exported, tables: { ...exported.tables, unit_closure: [] } })).rejects.toMatchObject({
      code: '22023',
    })
    await expect(load({ ...exported, tables: { ...exported.tables, sessions: [] } })).rejects.toMatchObject({
      code: '22023',
    })
    // The counter is derived from the rows (D-373).
    await expect(load({ ...exported, tables: { ...exported.tables, change_counters: [] } })).rejects.toMatchObject({
      code: '22023',
    })
  })

  it('is not open to the Data API roles (D-203)', async () => {
    const roles = await sql`
      SELECT r.rolname FROM pg_roles r
      WHERE r.rolname IN ('anon', 'authenticated', 'public')
        AND has_function_privilege(r.oid, 'load_organization_export(jsonb)', 'EXECUTE')`
    expect(roles).toEqual([])
  })
})

describe('change numbers across a load (D-373)', () => {
  const counter = async () => (await sql`SELECT last_seq FROM change_counters`).map((row) => row.last_seq)
  const seqs = async (table: 'leave_events' | 'unit_memberships') =>
    Object.fromEntries(
      (await sql.unsafe(`SELECT id, change_seq FROM "${table}"`)).map((row) => [row.id, row.change_seq]),
    )

  it('starts the counter at the last number the export holds', async () => {
    const exported = await localExport()
    await load(exported)
    const numbers = [...exported.tables.leave_events, ...exported.tables.unit_memberships].map((row) => row.change_seq)
    expect(await counter()).toEqual([Math.max(...numbers)])
    expect(await seqs('leave_events')).toEqual(
      Object.fromEntries(exported.tables.leave_events.map((event) => [event.id, event.change_seq])),
    )
  })

  it('still takes the format before: numbers its events by time and id, and each confirmation from its time', async () => {
    const exported = await localExport()
    const events = exported.tables.leave_events
    const latest =
      events
        .map((event) => event.created_at)
        .sort()
        .at(-1) ?? NOW
    const [confirmer] = exported.tables.soldiers
    const [unit] = exported.tables.units
    const confirmation = (reportDate: string, confirmedAt: string) => ({
      id: crypto.randomUUID(),
      organization_id: unit?.organization_id,
      unit_id: unit?.id,
      report_date: reportDate,
      confirmed_by: confirmer?.id,
      confirmed_at: confirmedAt,
    })
    const strip = <T extends object>(rows: readonly T[], column: string) =>
      rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== column)))
    const before = {
      ...exported,
      format_version: EXPORT_FORMAT_VERSION - 1,
      tables: {
        ...exported.tables,
        leave_events: strip(events, 'change_seq'),
        unit_memberships: strip(exported.tables.unit_memberships, 'change_seq'),
        report_confirmations: [confirmation(TODAY, latest), confirmation(TOMORROW, '2026-01-01T00:00:00.000Z')],
      },
    }

    await load(before)

    const order = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    expect(await seqs('leave_events')).toEqual(Object.fromEntries(order.map((event, index) => [event.id, index + 1])))
    expect(Object.values(await seqs('unit_memberships')).every((seq) => seq === 0)).toBe(true)
    expect(
      (await sql`SELECT seen_seq FROM report_confirmations ORDER BY report_date`).map((row) => row.seen_seq),
    ).toEqual([events.length, 0])
    expect(await counter()).toEqual([events.length])
  })

  it('gives two writers that meet distinct, consecutive numbers', async () => {
    const exported = await localExport()
    await load(exported)
    const [leave] = exported.tables.leaves
    if (leave === undefined) throw new Error('the export holds a leave')
    const [start] = await counter()
    const create = (startDate: string, endDate: string) =>
      gatewayOf()(owner, {
        kind: 'commands',
        group: 'leaves',
        method: 'create',
        args: [
          {
            id: LeaveId.parse(crypto.randomUUID()),
            soldier_id: leave.soldier_id,
            leave_type_id: leave.leave_type_id,
            deployment_id: leave.deployment_id,
            start_date: startDate,
            end_date: endDate,
            availability_effect_override: null,
            reason: null,
            properties: {},
            as_approved: false,
            acknowledged_rule_ids: [],
            comment: null,
          },
        ],
      })

    const answers = await Promise.all([create('2026-11-20', '2026-11-21'), create('2026-11-25', '2026-11-26')])

    for (const answer of answers) valueOf(answer.result as Result<unknown>)
    const written =
      await sql`SELECT change_seq FROM leave_events WHERE change_seq > ${Number(start)} ORDER BY change_seq`
    expect(written.map((row) => row.change_seq)).toEqual([Number(start) + 1, Number(start) + 2])
    expect(await counter()).toEqual([Number(start) + 2])
  })

  it('refuses the second of two writers of one counter, which the gateway then retries', async () => {
    const exported = await localExport()
    await load(exported)
    const [first, second] = await Promise.all([sql.reserve(), sql.reserve()])
    try {
      await first`BEGIN ISOLATION LEVEL SERIALIZABLE`
      await second`BEGIN ISOLATION LEVEL SERIALIZABLE`
      await first`SELECT last_seq FROM change_counters`
      await second`SELECT last_seq FROM change_counters`
      await first`UPDATE change_counters SET last_seq = last_seq + 1`
      const waiting = second`UPDATE change_counters SET last_seq = last_seq + 1`
      await first`COMMIT`
      await expect(waiting).rejects.toMatchObject({ code: '40001' })
      await second`ROLLBACK`
    } finally {
      first.release()
      second.release()
    }
  })
})
