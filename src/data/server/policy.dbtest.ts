import { OrganizationId, TABLE_SCHEMAS, Timestamp } from '@contracts'
import { can } from '@domain'
import { LEVEL, MATRIX, NOW, S, p, uuid, world, type SoldierName } from '@domain/testing'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadPolicySnapshot, type PolicySnapshot } from '../local/snapshot'
import { CATALOG_QUERY, catalogOf, createPostgresStore } from './postgresStore'

// The policy matrix of the domain (D-007), run again over Postgres (D-203): the world's rows go
// through the migrated schema, its constraints and triggers, and come back through the store the
// gateway reads, so the server answers as the domain specifies. Sample rows live here only.

const url = import.meta.env.DATABASE_URL as string | undefined
if (url === undefined || url === '') throw new Error('test:db needs DATABASE_URL')

const sql = postgres(url, { max: 2, onnotice: () => undefined, connection: { TimeZone: 'UTC' } })
const ORGANIZATION = OrganizationId.parse(uuid(900))
/** The world's instant, in the one form the store gives instants back. */
const AT = Timestamp.parse(NOW.replace(/Z$/, '.000Z'))

let snapshot: PolicySnapshot

/** The world's rows, with the columns the policy does not read filled in. */
async function insertWorld(): Promise<void> {
  const rows = world()
  const org = { organization_id: ORGANIZATION }
  const levels = Object.values(LEVEL)
  const nameOf = Object.fromEntries(Object.entries(S).map(([name, id]) => [id, name as SoldierName]))
  await sql.begin(async (tx) => {
    await tx`INSERT INTO organizations ${tx({ id: ORGANIZATION, name: 'Company', timezone: 'UTC' })}`
    await tx`INSERT INTO unit_levels ${tx(levels.map((id, index) => ({ id, ...org, name: `Level ${index}`, sort_order: index })))}`
    // Parents come first in the world's list, as the closure trigger needs.
    for (const unit of rows.units) await tx`INSERT INTO units ${tx({ ...unit, ...org, name: 'Unit' })}`
    await tx`INSERT INTO command_ranks ${tx(rows.command_ranks.map((rank) => ({ ...rank, ...org, title: `Rank ${rank.seniority}` })))}`
    await tx`INSERT INTO soldiers ${tx(rows.soldiers.map((soldier) => ({ ...soldier, ...org, first_name: nameOf[soldier.id] ?? '', last_name: 'Soldier' })))}`
    await tx`INSERT INTO roles ${tx(rows.roles.map((role) => ({ ...role, ...org, name: `Role ${role.id}` })))}`
    await tx`UPDATE organizations SET baseline_role_id = ${rows.baseline_role_id}, version = version + 1 WHERE id = ${ORGANIZATION}`
    await tx`INSERT INTO role_permissions ${tx(rows.role_permissions.map((permission) => ({ ...permission, ...org })))}`
    await tx`INSERT INTO seniority_overrides ${tx(rows.seniority_overrides.map((override) => ({ ...override, ...org })))}`
    await tx`INSERT INTO unit_memberships ${tx(rows.unit_memberships.map((membership) => ({ ...membership, ...org })))}`
    await tx`INSERT INTO soldier_accounts ${tx(
      rows.soldier_accounts.map((account, index) => ({
        ...account,
        ...org,
        auth_user_id: uuid(1000 + index),
        provider: 'google',
        email: `${nameOf[account.soldier_id] ?? index}@example.com`,
      })),
    )}`
    await tx`INSERT INTO rank_role_bindings ${tx(rows.rank_role_bindings.map((binding) => ({ ...binding, ...org })))}`
    await tx`INSERT INTO access_grants ${tx(rows.access_grants.map((grant) => ({ ...grant, ...org })))}`
  })
}

beforeAll(async () => {
  await sql.unsafe(`TRUNCATE ${Object.keys(TABLE_SCHEMAS).map((table) => `"${table}"`).join(', ')}, unit_closure CASCADE`)
  await insertWorld()
  const catalog = catalogOf(await sql.unsafe(CATALOG_QUERY))
  const store = createPostgresStore({ query: (text, params) => sql.unsafe(text, params) }, catalog)
  snapshot = await loadPolicySnapshot(store, ORGANIZATION, AT)
})

afterAll(async () => {
  await sql.end()
})

describe('policy matrix over Postgres (D-203)', () => {
  it.each(MATRIX)('%s', (_why, actor, resource, action, target, allowed) => {
    expect(can(snapshot.context, S[actor], p(resource, action), target)).toBe(allowed)
  })
})
