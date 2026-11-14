import { TABLE_SCHEMAS } from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CATALOG_QUERY, catalogOf, createPostgresStore, type PostgresStore } from './postgresStore'

// The store's writes over the migrated schema (D-410): a row written without a column the table has
// stores that column's DEFAULT, as a function built before the column was added writes it.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const ORGANIZATION = '00000000-0000-4000-8000-000000000410'
const UNIT = '00000000-0000-4000-8000-000000000411'
const SOLDIER = '00000000-0000-4000-8000-000000000412'
const MEMBERSHIP = '00000000-0000-4000-8000-000000000413'
const OTHER = '00000000-0000-4000-8000-000000000414'

let store: PostgresStore

/** A membership as a function built before D-373 writes it: no `change_seq`. */
function membership(id: string, valid_from: string, version = 1): Record<string, unknown> {
  return { id, organization_id: ORGANIZATION, soldier_id: SOLDIER, unit_id: UNIT, membership_type: 'primary', valid_from, valid_to: null, version }
}

async function changeSeqOf(id: string): Promise<unknown> {
  const rows = await sql`SELECT change_seq FROM unit_memberships WHERE id = ${id}`
  return rows[0]?.change_seq
}

beforeAll(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  await sql`INSERT INTO organizations ${sql({ id: ORGANIZATION, name: 'Company', timezone: 'UTC' })}`
  await sql`INSERT INTO units ${sql({ id: UNIT, organization_id: ORGANIZATION, name: 'Unit' })}`
  await sql`INSERT INTO soldiers ${sql({ id: SOLDIER, organization_id: ORGANIZATION, first_name: 'Dana', last_name: 'Soldier' })}`
  store = createPostgresStore({ query: (text, params) => sql.unsafe(text, params) }, catalogOf(await sql.unsafe(CATALOG_QUERY)))
})

afterAll(async () => {
  await sql.end()
})

describe('writes name only the columns the row carries (D-410)', () => {
  it('an insert without a column stores its DEFAULT, not NULL', async () => {
    await store.table('unit_memberships').add(membership(MEMBERSHIP, '2026-11-01') as never)
    expect(await changeSeqOf(MEMBERSHIP)).toBe(0)
  })

  it('an upsert without a column keeps the stored value', async () => {
    await sql`UPDATE unit_memberships SET change_seq = 7, version = 2 WHERE id = ${MEMBERSHIP}`
    await store.table('unit_memberships').put(membership(MEMBERSHIP, '2026-11-02', 3) as never)
    const rows = await sql`SELECT change_seq, valid_from::text AS valid_from FROM unit_memberships WHERE id = ${MEMBERSHIP}`
    expect(rows[0]).toEqual({ change_seq: 7, valid_from: '2026-11-02' })
  })

  it('a batch of rows of different shapes writes each row with its own columns', async () => {
    await store.table('unit_memberships').bulkPut([
      { ...membership(MEMBERSHIP, '2026-11-03', 4), change_seq: 9 },
      { ...membership(OTHER, '2026-11-03'), membership_type: 'attached' },
    ] as never)
    expect(await changeSeqOf(MEMBERSHIP)).toBe(9)
    expect(await changeSeqOf(OTHER)).toBe(0)
  })
})
