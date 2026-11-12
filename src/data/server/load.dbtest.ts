import 'fake-indexeddb/auto'
import {
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
    },
    { database: `load-${names}`, channel: `load-${names}` },
  )
  const { commands } = adapter
  const organizationId = OrganizationId.parse(crypto.randomUUID())
  const ownerId = SoldierId.parse(crypto.randomUUID())
  const ownerRole = RoleId.parse(crypto.randomUUID())
  valueOf(
    await commands.organizations.bootstrapOwner({
      organization: { id: organizationId, name: 'Company', timezone: 'Asia/Jerusalem' },
      soldier: { id: ownerId, first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: ownerRole, name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
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
  const company = await unit('Company', null)
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

async function serverExport(): Promise<OrganizationExport> {
  const gateway = createCommandGateway({
    transact: (work) => sql.begin('isolation level serializable', (tx) => work(clientOf(tx))) as never,
    catalog,
    time: { now: () => NOW },
    bootstrapOwnerEmail: owner.email,
  })
  const answer = await gateway(owner, { kind: 'transfer', group: 'transfer', method: 'exportOrganization', args: [] })
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
    await expect(load({ ...exported, format_version: EXPORT_FORMAT_VERSION + 1 })).rejects.toMatchObject({ code: '22023' })
    await expect(load({ ...exported, tables: { ...exported.tables, unit_closure: [] } })).rejects.toMatchObject({ code: '22023' })
    await expect(load({ ...exported, tables: { ...exported.tables, sessions: [] } })).rejects.toMatchObject({ code: '22023' })
  })

  it('is not open to the Data API roles (D-203)', async () => {
    const roles = await sql`
      SELECT r.rolname FROM pg_roles r
      WHERE r.rolname IN ('anon', 'authenticated', 'public')
        AND has_function_privilege(r.oid, 'load_organization_export(jsonb)', 'EXECUTE')`
    expect(roles).toEqual([])
  })
})
