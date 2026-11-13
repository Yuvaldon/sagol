import {
  AccessGrantId,
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
  type TableName,
} from '@contracts'
import postgres from 'postgres'
import SEED from '../../../scripts/seed-staging.sql?raw'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { tableOf } from '../local/store'
import { createCommandGateway } from './gateway'
import { CATALOG_QUERY, catalogOf, createPostgresStore, type SqlClient, type StoreCatalog } from './postgresStore'

// The staging seed (D-281) writes rows the app reads back through the contracts. A row the contracts reject turns
// every read of its table into `internal` (D-341): this runs the seed on the owner's bootstrap and parses every row.

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

beforeAll(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
  const claimed = await gateway()(owner, {
    kind: 'commands',
    group: 'organizations',
    method: 'bootstrapOwner',
    args: [
      {
        organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Company', timezone: 'Asia/Jerusalem' },
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
  expect(claimed.result.ok).toBe(true)
  await sql.unsafe(SEED)
})

afterAll(async () => {
  await sql.end()
})

describe('the staging seed (D-281)', () => {
  it('writes only rows the contracts accept', async () => {
    const store = createPostgresStore(clientOf(sql), catalog)
    const rejected: string[] = []
    let seeded = 0
    for (const table of Object.keys(TABLE_SCHEMAS) as TableName[]) {
      const rows = await tableOf(store, table).toArray()
      seeded += rows.length
      for (const row of rows) {
        const parsed = TABLE_SCHEMAS[table].safeParse(row)
        if (!parsed.success) rejected.push(`${table}: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
      }
    }
    expect(seeded).toBeGreaterThan(1000)
    expect([...new Set(rejected)]).toEqual([])
  })
})
