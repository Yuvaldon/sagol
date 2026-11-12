import { TABLE_SCHEMAS } from '@contracts'
import postgres from 'postgres'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

// The database's own guarantees (D-202), written straight in SQL: they hold whatever writes the
// row, the gateway included. Sample rows live here only (test file).

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const CHECK_VIOLATION = '23514'

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

async function codeOf(statement: Promise<unknown>): Promise<string> {
  try {
    await statement
  } catch (error) {
    return String((error as { code?: unknown }).code)
  }
  throw new Error('expected the statement to be refused')
}

async function organization(): Promise<string> {
  const [row] = await sql`INSERT INTO organizations (name, timezone) VALUES ('Company', 'UTC') RETURNING id`
  return String(row?.id)
}

async function unit(organizationId: string, parentId: string | null): Promise<string> {
  const [row] = await sql`
    INSERT INTO units (organization_id, name, parent_id) VALUES (${organizationId}, 'Unit', ${parentId}) RETURNING id`
  return String(row?.id)
}

async function closure(): Promise<string[]> {
  const rows = await sql`SELECT ancestor_id, descendant_id, depth FROM unit_closure`
  return rows.map((row) => `${String(row.ancestor_id)}>${String(row.descendant_id)}:${String(row.depth)}`).sort()
}

const link = (ancestor: string, descendant: string, depth: number) => `${ancestor}>${descendant}:${depth}`

describe('unit_closure (D-202)', () => {
  it('follows parent_id on insert and on a move of a subtree', async () => {
    const org = await organization()
    const root = await unit(org, null)
    const a = await unit(org, root)
    const b = await unit(org, root)
    const leaf = await unit(org, a)
    expect(await closure()).toEqual(
      [
        link(root, root, 0),
        link(a, a, 0),
        link(b, b, 0),
        link(leaf, leaf, 0),
        link(root, a, 1),
        link(root, b, 1),
        link(root, leaf, 2),
        link(a, leaf, 1),
      ].sort(),
    )

    await sql`UPDATE units SET parent_id = ${b}, version = version + 1 WHERE id = ${a}`
    expect(await closure()).toEqual(
      [
        link(root, root, 0),
        link(a, a, 0),
        link(b, b, 0),
        link(leaf, leaf, 0),
        link(root, a, 2),
        link(root, b, 1),
        link(root, leaf, 3),
        link(a, leaf, 1),
        link(b, a, 1),
        link(b, leaf, 2),
      ].sort(),
    )

    await sql`UPDATE units SET parent_id = NULL, version = version + 1 WHERE id = ${a}`
    expect(await closure()).toEqual(
      [link(root, root, 0), link(a, a, 0), link(b, b, 0), link(leaf, leaf, 0), link(root, b, 1), link(a, leaf, 1)].sort(),
    )
  })

  it('refuses a cycle and a parent of another organization', async () => {
    const org = await organization()
    const root = await unit(org, null)
    const child = await unit(org, root)
    expect(await codeOf(sql`UPDATE units SET parent_id = ${child}, version = version + 1 WHERE id = ${root}`)).toBe(
      CHECK_VIOLATION,
    )
    const other = await organization()
    expect(await codeOf(unit(other, root))).toBe(CHECK_VIOLATION)
  })
})

describe('row versions (D-202)', () => {
  it('takes an update only with the next version', async () => {
    const org = await organization()
    expect(await codeOf(sql`UPDATE organizations SET name = 'Renamed' WHERE id = ${org}`)).toBe(CHECK_VIOLATION)
    expect(await codeOf(sql`UPDATE organizations SET name = 'Renamed', version = 3 WHERE id = ${org}`)).toBe(
      CHECK_VIOLATION,
    )
    await sql`UPDATE organizations SET name = 'Renamed', version = 2 WHERE id = ${org}`
    const [row] = await sql`SELECT name, version FROM organizations WHERE id = ${org}`
    expect(row).toMatchObject({ name: 'Renamed', version: 2 })
  })
})

describe('soldier tags (D-202)', () => {
  it('holds at most one tag of a single-selection category', async () => {
    const org = await organization()
    const [soldier] = await sql`
      INSERT INTO soldiers (organization_id, first_name, last_name) VALUES (${org}, 'Dana', 'Levi') RETURNING id`
    const [single] = await sql`
      INSERT INTO tag_categories (organization_id, name, selection_mode, color_key)
      VALUES (${org}, 'Shift', 'single', 'blue') RETURNING id`
    const tags = await sql`
      INSERT INTO tags (organization_id, category_id, name)
      VALUES (${org}, ${String(single?.id)}, 'Day'), (${org}, ${String(single?.id)}, 'Night') RETURNING id`
    const [day, night] = tags.map((tag) => String(tag.id))
    await sql`INSERT INTO soldier_tags (soldier_id, tag_id, organization_id) VALUES (${String(soldier?.id)}, ${String(day)}, ${org})`
    expect(
      await codeOf(
        sql`INSERT INTO soldier_tags (soldier_id, tag_id, organization_id) VALUES (${String(soldier?.id)}, ${String(night)}, ${org})`,
      ),
    ).toBe(CHECK_VIOLATION)
    // Replacing the selection in one transaction holds: the check runs at the end of the statement.
    await sql.begin(async (tx) => {
      await tx`DELETE FROM soldier_tags WHERE soldier_id = ${String(soldier?.id)}`
      await tx`INSERT INTO soldier_tags (soldier_id, tag_id, organization_id) VALUES (${String(soldier?.id)}, ${String(night)}, ${org})`
    })
    const held = await sql`SELECT tag_id FROM soldier_tags`
    expect(held.map((row) => String(row.tag_id))).toEqual([night])
  })
})

describe('leave events (D-202, OI-064)', () => {
  async function leave() {
    const org = await organization()
    const [soldier] = await sql`
      INSERT INTO soldiers (organization_id, first_name, last_name) VALUES (${org}, 'Dana', 'Levi') RETURNING id`
    const [type] = await sql`
      INSERT INTO leave_types (organization_id, name, color_key) VALUES (${org}, 'Home', 'green') RETURNING id`
    const [row] = await sql`
      INSERT INTO leaves (organization_id, soldier_id, leave_type_id, start_date, end_date)
      VALUES (${org}, ${String(soldier?.id)}, ${String(type?.id)}, '2026-11-10', '2026-11-12') RETURNING id`
    return { org, actor: String(soldier?.id), leaveId: String(row?.id) }
  }

  const AT = '2026-11-08T10:00:00.000Z'

  it('is append-only', async () => {
    const { org, actor, leaveId } = await leave()
    const [event] = await sql`
      INSERT INTO leave_events (organization_id, leave_id, actor_id, event_type, to_status, created_at)
      VALUES (${org}, ${leaveId}, ${actor}, 'created', 'pending', ${AT}) RETURNING id`
    expect(await codeOf(sql`UPDATE leave_events SET event_type = 'updated' WHERE id = ${String(event?.id)}`)).toBe(
      CHECK_VIOLATION,
    )
    expect(await codeOf(sql`DELETE FROM leave_events WHERE id = ${String(event?.id)}`)).toBe(CHECK_VIOLATION)
  })

  it('keeps a leave’s history in order when two events share an instant', async () => {
    const { org, actor, leaveId } = await leave()
    for (const type of ['created', 'approved', 'cancelled']) {
      await sql`
        INSERT INTO leave_events (organization_id, leave_id, actor_id, event_type, created_at)
        VALUES (${org}, ${leaveId}, ${actor}, ${type}, ${AT})`
    }
    const rows = await sql`
      SELECT event_type, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at FROM leave_events ORDER BY created_at`
    expect(rows.map((row) => [row.event_type, row.at])).toEqual([
      ['created', '2026-11-08T10:00:00.000Z'],
      ['approved', '2026-11-08T10:00:00.001Z'],
      ['cancelled', '2026-11-08T10:00:00.002Z'],
    ])
  })
})
