import { TABLE_SCHEMAS } from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import ROOT_UNITS from '../../../supabase/migrations/20261112000400_root_units.sql?raw'
import SINGLE_ROOT from '../../../supabase/migrations/20261113000000_single_root.sql?raw'

// Data migrations replayed on sample rows (D-315): each must be additive and idempotent, since a hosted
// database already holds rows when it runs. Sample rows live here only (test file).

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })

afterAll(async () => {
  await sql.end()
})

beforeEach(async () => {
  await sql.unsafe(
    `TRUNCATE ${Object.keys(TABLE_SCHEMAS)
      .map((table) => `"${table}"`)
      .join(', ')}, unit_closure CASCADE`,
  )
})

async function organization(name: string): Promise<string> {
  const [row] = await sql`INSERT INTO organizations (name, timezone) VALUES (${name}, 'Asia/Jerusalem') RETURNING id`
  return String(row?.id)
}

async function soldier(organizationId: string, archived = false, createdAt: string | null = null): Promise<string> {
  const [row] = await sql`
    INSERT INTO soldiers (organization_id, first_name, last_name, archived_at, created_at)
    VALUES (${organizationId}, 'A', 'B', CASE WHEN ${archived} THEN now() END, COALESCE(${createdAt}::timestamptz, now())) RETURNING id`
  return String(row?.id)
}

async function rootsOf(organizationId: string) {
  return sql`
    SELECT id, name, kind, sort_order FROM units
    WHERE organization_id = ${organizationId} AND parent_id IS NULL AND archived_at IS NULL`
}

async function primaryOf(soldierId: string) {
  return sql`SELECT unit_id, valid_from::text, valid_to::text FROM unit_memberships WHERE soldier_id = ${soldierId} ORDER BY valid_from`
}

async function unit(organizationId: string, name: string, parentId: string | null, archived = false): Promise<string> {
  const [row] = await sql`
    INSERT INTO units (organization_id, name, parent_id, archived_at)
    VALUES (${organizationId}, ${name}, ${parentId}, CASE WHEN ${archived} THEN now() END) RETURNING id`
  return String(row?.id)
}

describe('root units backfill (D-315)', () => {
  it('gives an organization without a root one, and its unplaced soldiers a membership in it', async () => {
    const org = await organization('Company')
    const unplaced = await soldier(org)
    const archived = await soldier(org, true)
    const placedLater = await soldier(org)
    const elsewhere = await sql`
      INSERT INTO units (organization_id, name, parent_id, archived_at) VALUES (${org}, 'Old', NULL, now()) RETURNING id`
    await sql`
      INSERT INTO unit_memberships (organization_id, soldier_id, unit_id, valid_from)
      VALUES (${org}, ${placedLater}, ${String(elsewhere[0]?.id)}, '2099-01-01')`

    await sql.unsafe(ROOT_UNITS)

    const roots = await rootsOf(org)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({ name: 'Company', kind: 'standing', sort_order: 0 })
    const memberships = await primaryOf(unplaced)
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toMatchObject({ unit_id: roots[0]?.id, valid_to: null })
    expect(await primaryOf(archived)).toHaveLength(0)
    expect(await primaryOf(placedLater)).toHaveLength(1)
    const closure = await sql`SELECT 1 FROM unit_closure WHERE ancestor_id = ${String(roots[0]?.id)}`
    expect(closure).toHaveLength(1)
  })

  it('leaves an organization with a root alone, and a second run changes nothing', async () => {
    const rooted = await organization('Rooted')
    await sql`INSERT INTO units (organization_id, name, parent_id) VALUES (${rooted}, 'Root', NULL)`
    const unplaced = await soldier(rooted)
    const bare = await organization('Bare')
    await soldier(bare)

    await sql.unsafe(ROOT_UNITS)
    const units = await sql`SELECT id FROM units ORDER BY id`
    const memberships = await sql`SELECT id FROM unit_memberships ORDER BY id`
    await sql.unsafe(ROOT_UNITS)

    expect(await rootsOf(rooted)).toHaveLength(1)
    expect(await primaryOf(unplaced)).toHaveLength(0)
    expect(await sql`SELECT id FROM units ORDER BY id`).toEqual(units)
    expect(await sql`SELECT id FROM unit_memberships ORDER BY id`).toEqual(memberships)
    expect(memberships).toHaveLength(1)
  })
})

describe('one root and the soldiers\' history in it (D-321)', () => {
  // 22:30 UTC on 1 January is already 2 January in Jerusalem: the day a soldier was created is the organization's.
  const created = '2026-01-01T22:30:00Z'

  it('puts every top-level unit under one new root, and fills the days before each first membership', async () => {
    const org = await organization('Battalion')
    const first = await unit(org, 'First', null)
    const second = await unit(org, 'Second', null)
    const old = await unit(org, 'Old', null, true)
    const platoon = await unit(org, 'Platoon', first)
    const placed = await soldier(org, false, created)
    const unplaced = await soldier(org, false, created)
    const gone = await soldier(org, true, created)
    await sql`
      INSERT INTO unit_memberships (organization_id, soldier_id, unit_id, valid_from)
      VALUES (${org}, ${placed}, ${platoon}, '2026-03-01')`

    await sql.unsafe(SINGLE_ROOT)

    const roots = await rootsOf(org)
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatchObject({ name: 'Battalion', kind: 'standing', sort_order: 0 })
    const root = String(roots[0]?.id)
    const parents = await sql`SELECT id, parent_id FROM units WHERE id IN (${first}, ${second}, ${old}) ORDER BY name`
    expect(parents.map((row) => [row.id, row.parent_id])).toEqual([
      [first, root],
      [old, null],
      [second, root],
    ])
    const depth = await sql`SELECT depth FROM unit_closure WHERE ancestor_id = ${root} AND descendant_id = ${platoon}`
    expect(depth[0]?.depth).toBe(2)
    expect((await primaryOf(placed)).map((row) => [row.unit_id, row.valid_from, row.valid_to])).toEqual([
      [root, '2026-01-02', '2026-02-28'],
      [platoon, '2026-03-01', null],
    ])
    expect((await primaryOf(unplaced)).map((row) => [row.unit_id, row.valid_from, row.valid_to])).toEqual([
      [root, '2026-01-02', null],
    ])
    expect(await primaryOf(gone)).toHaveLength(0)
  })

  it('leaves an organization with one root and full history alone, and a second run changes nothing', async () => {
    const org = await organization('Company')
    const root = await unit(org, 'Company', null)
    const placed = await soldier(org, false, created)
    await sql`
      INSERT INTO unit_memberships (organization_id, soldier_id, unit_id, valid_from)
      VALUES (${org}, ${placed}, ${root}, '2026-01-02')`
    const bare = await organization('Bare')
    await soldier(bare, false, created)

    await sql.unsafe(SINGLE_ROOT)
    const units = await sql`SELECT id, parent_id, version FROM units ORDER BY id`
    const memberships = await sql`SELECT id FROM unit_memberships ORDER BY id`
    await sql.unsafe(SINGLE_ROOT)

    expect(await rootsOf(org)).toEqual([expect.objectContaining({ id: root })])
    expect(await primaryOf(placed)).toHaveLength(1)
    expect(await rootsOf(bare)).toHaveLength(1)
    expect(await sql`SELECT id, parent_id, version FROM units ORDER BY id`).toEqual(units)
    expect(await sql`SELECT id FROM unit_memberships ORDER BY id`).toEqual(memberships)
    expect(memberships).toHaveLength(2)
  })
})
