import type { TableName } from '@contracts'
import { STORE_UNAVAILABLE, STORES, type Store, type StoreCollection, type StoreKey, type StoreTable } from '../local/store'

// The `Store` port over Postgres (D-201): the command code of the local adapter runs on the
// server unchanged. One store serves one request, inside the request's transaction, on one
// connection. Rows travel as JSON (`to_jsonb`, `jsonb_populate_record`), so a column needs no
// per-type code; only instants are written out, in SQL, in the one form the TimeSource writes.
// Keys and indexes are the local ones (`STORES`), so both stores answer the same lookups.

/** A statement parameter: key values and JSON documents (as text) are all the store binds. */
export type SqlParameter = string | number

/** What the store needs from a Postgres driver: one parameterized statement, rows back. */
export interface SqlClient {
  query(text: string, params: SqlParameter[]): Promise<readonly Record<string, unknown>[]>
}

/** Column types of the public tables, read once per server instance. */
export interface StoreCatalog {
  readonly columns: ReadonlyMap<string, ReadonlyMap<string, string>>
}

export const CATALOG_QUERY = `
  SELECT table_name, column_name, udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position`

export function catalogOf(rows: readonly Record<string, unknown>[]): StoreCatalog {
  const columns = new Map<string, Map<string, string>>()
  for (const row of rows) {
    const table = String(row.table_name)
    const own = columns.get(table) ?? new Map<string, string>()
    own.set(String(row.column_name), String(row.udt_name))
    columns.set(table, own)
  }
  return { columns }
}

/** Postgres error classes after which the request must run again from the start. */
const RETRY_STATES: readonly string[] = ['40001', '40P01']
/** Postgres error classes that mean the database cannot be reached. */
const UNAVAILABLE_PREFIXES: readonly string[] = ['08', '53', '57P']

export interface PostgresStore extends Store {
  /** True once a statement lost a serialization race: the request's transaction must be retried. */
  readonly mustRetry: () => boolean
  /** The organizations whose rows the request's kept writes touched (D-348): where its change is announced. */
  readonly writtenOrganizations: () => readonly string[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
/** `to_char` pattern of the TimeSource's instants (`2026-11-08T10:00:00.000Z`). */
const INSTANT_FORMAT = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'

function quoted(name: string): string {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Invalid identifier: ${name}`)
  return `"${name}"`
}

/** `[a+b]` → `['a', 'b']`; `a` → `['a']`. */
function indexColumns(index: string): string[] {
  return index.replace(/^&/, '').replace(/[[\]]/g, '').split('+')
}

/** The primary key columns of a table, as the local store keys it. */
export function primaryKeyOf(table: TableName): string[] {
  return indexColumns((STORES[table].split(',')[0] ?? '').trim())
}

export function createPostgresStore(client: SqlClient, catalog: StoreCatalog): PostgresStore {
  let retry = false
  let depth = 0
  const written: string[] = []

  async function run(text: string, params: SqlParameter[]): Promise<readonly Record<string, unknown>[]> {
    try {
      return await client.query(text, params)
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (RETRY_STATES.includes(code)) retry = true
      if (RETRY_STATES.includes(code) || UNAVAILABLE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
        const unavailable = new Error(code)
        unavailable.name = STORE_UNAVAILABLE
        throw unavailable
      }
      throw error
    }
  }

  function tableOf<Row>(name: TableName): StoreTable<Row> {
    if (!Object.hasOwn(STORES, name)) throw new Error(`Unknown table: ${name}`)
    const types = catalog.columns.get(name)
    if (types === undefined) throw new Error(`Table missing from the database: ${name}`)
    const table = quoted(name)
    const key = primaryKeyOf(name)
    const columns = [...types.keys()]
    const instants = columns.filter((column) => types.get(column) === 'timestamptz')

    /** A row as the local store gives it: instants in the TimeSource's form, whatever the session's zone. */
    const rowExpression =
      instants.length === 0
        ? 'to_jsonb(t)'
        : `to_jsonb(t) || jsonb_build_object(${instants
            .map((column) => `'${column}', to_char(t.${quoted(column)} AT TIME ZONE 'UTC', '${INSTANT_FORMAT}')`)
            .join(', ')})`
    const fromRow = (row: Record<string, unknown>) => row.row as Row
    /** The column naming the organization a row belongs to: its own id for the organization itself. */
    const owner = types.has('organization_id') ? 'organization_id' : name === 'organizations' ? 'id' : null
    const returning = owner === null ? '' : ` RETURNING ${quoted(owner)}::text AS organization`
    function wrote(rows: readonly Record<string, unknown>[]): void {
      for (const row of rows) if (typeof row.organization === 'string') written.push(row.organization)
    }

    /** A value of the wrong form cannot be stored in the column, so it matches nothing (as in IndexedDB). */
    function matchable(column: string, value: unknown): boolean {
      const type = types?.get(column)
      if (type === undefined) throw new Error(`Unknown column: ${name}.${column}`)
      if (typeof value !== 'string') return typeof value === 'number'
      if (type === 'uuid') return UUID_PATTERN.test(value)
      if (type === 'date') return DATE_PATTERN.test(value)
      return true
    }

    function select(where: readonly string[], value: StoreKey | null, suffix: string): Promise<Row[]> | null {
      const values: SqlParameter[] = value === null ? [] : typeof value === 'object' ? [...value] : [value]
      if (values.length !== where.length || where.some((column, index) => !matchable(column, values[index]))) return null
      const condition = where.length === 0 ? '' : ` WHERE ${where.map((column, index) => `${quoted(column)} = $${index + 1}`).join(' AND ')}`
      return run(`SELECT ${rowExpression} AS row FROM ${table} t${condition}${suffix}`, values).then((rows) => rows.map(fromRow))
    }

    function collection(where: readonly string[], value: StoreKey | null): StoreCollection<Row> {
      return {
        toArray: async () => (await select(where, value, '')) ?? [],
        first: async () => ((await select(where, value, ' LIMIT 1')) ?? [])[0],
        count: async () => ((await select(where, value, '')) ?? []).length,
      }
    }

    const upsert = `ON CONFLICT (${key.map(quoted).join(', ')}) DO UPDATE SET (${columns.map(quoted).join(', ')}) = (${columns.map((column) => `EXCLUDED.${quoted(column)}`).join(', ')})`

    async function insert(rows: readonly Row[], conflict: string): Promise<void> {
      if (rows.length === 0) return
      wrote(
        await run(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table}, $1::text::jsonb) ${conflict}${returning}`, [
          JSON.stringify(rows),
        ]),
      )
    }

    return {
      get: async (value) => (await select(key, value, ''))?.[0],
      where: (index) => ({ equals: (value) => collection(indexColumns(index), value) }),
      toArray: () => collection([], null).toArray(),
      count: async () => Number((await run(`SELECT count(*) AS count FROM ${table}`, []))[0]?.count ?? 0),
      add: (row) => insert([row], ''),
      put: (row) => insert([row], upsert),
      bulkAdd: (rows) => insert(rows, ''),
      bulkPut: (rows) => insert(rows, upsert),
      async bulkDelete(keys) {
        if (keys.length === 0) return
        const rows = keys.map((value) => {
          const values: SqlParameter[] = typeof value === 'object' ? [...value] : [value]
          return Object.fromEntries(key.map((column, index) => [column, values[index]]))
        })
        const columnList = key.map(quoted).join(', ')
        wrote(
          await run(
            `DELETE FROM ${table} WHERE (${columnList}) IN (SELECT ${columnList} FROM jsonb_populate_recordset(NULL::${table}, $1::text::jsonb))${returning}`,
            [JSON.stringify(rows)],
          ),
        )
      },
    }
  }

  return {
    mustRetry: () => retry,
    writtenOrganizations: () => [...new Set(written)],
    table: tableOf,
    // A refused write rolls back what it wrote, as an aborted IndexedDB transaction does. Inner
    // transactions join the outer one, as Dexie's do.
    async transaction(mode, _tables, work) {
      if (mode === 'r' || depth > 0) {
        depth += 1
        try {
          return await work()
        } finally {
          depth -= 1
        }
      }
      depth += 1
      const kept = written.length
      await run('SAVEPOINT store_write', [])
      try {
        const value = await work()
        await run('RELEASE SAVEPOINT store_write', [])
        return value
      } catch (error) {
        if (!retry) await run('ROLLBACK TO SAVEPOINT store_write', [])
        written.length = kept
        throw error
      } finally {
        depth -= 1
      }
    },
  }
}
