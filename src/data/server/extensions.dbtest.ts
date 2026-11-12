import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

// Extensions live outside the app's schema (D-188): `btree_gist` sits in `extensions`, the app's schema holds no
// function of it, and the exclusion constraints built on its operator classes still hold.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 1, onnotice: () => undefined })
const EXCLUSION_VIOLATION = '23P01'

afterAll(async () => {
  await sql.end()
})

describe('extensions schema (D-188)', () => {
  it('keeps btree_gist in extensions', async () => {
    const rows = await sql`
      SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'btree_gist'`
    expect(rows.map((row) => String(row.nspname))).toEqual(['extensions'])
  })

  it('leaves no extension function in public', async () => {
    const rows = await sql`
      SELECT p.proname FROM pg_proc p JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
      WHERE p.pronamespace = 'public'::regnamespace`
    expect(rows).toEqual([])
  })

  it('still enforces the exclusion constraints on date ranges', async () => {
    let code = 'none'
    try {
      await sql.begin(async (tx) => {
        // The foreign keys are not what this checks; the exclusion index is enforced either way.
        await tx.unsafe('SET LOCAL session_replication_role = replica')
        await tx.unsafe(`
          INSERT INTO unit_memberships (organization_id, soldier_id, unit_id, valid_from) VALUES
            (gen_random_uuid(), '00000000-0000-4000-8000-000000000188', gen_random_uuid(), '2026-01-01'),
            (gen_random_uuid(), '00000000-0000-4000-8000-000000000188', gen_random_uuid(), '2026-02-01')`)
      })
    } catch (error) {
      code = String((error as { code?: unknown }).code)
    }
    expect(code).toBe(EXCLUSION_VIOLATION)
  })
})
