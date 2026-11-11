import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

// The public API roles reach nothing (D-203): every table holds RLS, and neither role holds a
// privilege on a table, a sequence or a function. Only the gateway, as the owner, reads and writes.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 1, onnotice: () => undefined })
const API_ROLES = ['anon', 'authenticated'] as const
const INSUFFICIENT_PRIVILEGE = '42501'

afterAll(async () => {
  await sql.end()
})

async function tables(): Promise<string[]> {
  const rows = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  return rows.map((row) => String(row.tablename))
}

/** Runs `statement` as `role`, and answers the error code it raised. */
async function codeAs(role: string, statement: string): Promise<string> {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`)
      await tx.unsafe(statement)
    })
  } catch (error) {
    return String((error as { code?: unknown }).code)
  }
  return 'none'
}

describe('row level security (D-203)', () => {
  it('holds on every table', async () => {
    const open = await sql`
      SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`
    expect(open.map((row) => String(row.relname))).toEqual([])
  })

  it('leaves the API roles no privilege on a table, a sequence or a function', async () => {
    const granted = await sql`
      SELECT grantee, table_name AS name FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = ANY(${API_ROLES})
      UNION ALL
      SELECT grantee, object_name FROM information_schema.usage_privileges
      WHERE object_schema = 'public' AND grantee = ANY(${API_ROLES})
      UNION ALL
      SELECT grantee, routine_name FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public' AND grantee = ANY(${[...API_ROLES, 'PUBLIC']})`
    expect(granted).toEqual([])
  })

  it.each(API_ROLES)('refuses %s a read and a write of every table', async (role) => {
    for (const table of await tables()) {
      expect([table, await codeAs(role, `SELECT 1 FROM public."${table}" LIMIT 1`)]).toEqual([table, INSUFFICIENT_PRIVILEGE])
      expect([table, await codeAs(role, `DELETE FROM public."${table}"`)]).toEqual([table, INSUFFICIENT_PRIVILEGE])
    }
  })

})
