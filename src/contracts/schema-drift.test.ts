// Drift test (D-039): docs/schema.sql and TABLE_SCHEMAS must describe the same tables,
// columns, nullability, lengths, value types and CHECK vocabularies.
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import schemaSql from '../../docs/schema.sql?raw'
import { TABLE_SCHEMAS } from './index'

/** Tables of schema.sql that intentionally have no contract. */
const TABLES_WITHOUT_CONTRACT = new Set(['unit_closure'])

/** Enum columns whose SQL column has no CHECK list (documented gaps of schema.sql). */
const ENUM_COLUMNS_WITHOUT_CHECK = new Set(['leave_events.from_status', 'leave_events.to_status'])

type SqlColumn = { name: string; type: string; length: number | null; nullable: boolean }
type SqlTable = { columns: Map<string, SqlColumn>; checks: Map<string, string[]> }

function parseSchema(sql: string): Map<string, SqlTable> {
  const tables = new Map<string, SqlTable>()
  const tablePattern = /CREATE TABLE IF NOT EXISTS "(\w+)" \(([\s\S]*?)\n\);/g
  for (const [, tableName = '', body = ''] of sql.matchAll(tablePattern)) {
    const columns = new Map<string, SqlColumn>()
    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/--.*$/, '').trim()
      const match =
        /^"(\w+)" (UUID\[\]|UUID|VARCHAR|TEXT|INTEGER|NUMERIC|BOOLEAN|DATE|TIMESTAMPTZ|JSONB)(?:\((\d+)(?:, ?\d+)?\))?(.*)$/.exec(
          line,
        )
      if (!match) continue
      const [, name = '', type = '', length, rest = ''] = match
      columns.set(name, {
        name,
        type,
        length: length === undefined ? null : Number(length),
        nullable: !rest.includes('NOT NULL') && !line.includes('PRIMARY KEY'),
      })
    }
    for (const primaryKey of body.matchAll(/PRIMARY KEY\(([^)]*)\)/g)) {
      for (const [, name = ''] of (primaryKey[1] ?? '').matchAll(/"(\w+)"/g)) {
        const column = columns.get(name)
        if (column) column.nullable = false
      }
    }
    const checks = new Map<string, string[]>()
    const checkPattern = /CONSTRAINT "\w+_check" CHECK \((?:"\w+" IS NULL OR )?"(\w+)" IN \(([^)]*)\)/g
    for (const [, column = '', list = ''] of body.matchAll(checkPattern)) {
      checks.set(column, [...list.matchAll(/'([^']+)'/g)].map((value) => value[1] ?? ''))
    }
    tables.set(tableName, { columns, checks })
  }
  return tables
}

type Described = {
  nullable: boolean
  kind: string
  format: string | null
  maxLength: number | null
  values: string[] | null
  element: Described | null
}

type Internals = {
  _zod: { def: { type: string; innerType?: z.ZodType; element?: z.ZodType } }
  format?: string | null
  maxLength?: number | null
  options?: string[]
}

function describeSchema(schema: z.ZodType): Described {
  let current = schema as unknown as Internals
  let nullable = false
  for (;;) {
    const { type, innerType } = current._zod.def
    if (type === 'nullable') nullable = true
    if (!['nullable', 'default', 'prefault', 'optional'].includes(type) || !innerType) break
    current = innerType as unknown as Internals
  }
  const { type, element } = current._zod.def
  const kind = ['object', 'record', 'lazy', 'union'].includes(type) ? 'json' : type
  return {
    nullable,
    kind,
    format: current.format ?? null,
    maxLength: current.maxLength ?? null,
    values: type === 'enum' ? (current.options ?? null) : null,
    element: type === 'array' && element ? describeSchema(element) : null,
  }
}

/** Expected contract shape of one SQL column, as a list of problems (empty = match). */
function compare(column: SqlColumn, described: Described): string[] {
  const problems: string[] = []
  if (column.nullable !== described.nullable) {
    problems.push(`nullable: sql ${column.nullable}, contract ${described.nullable}`)
  }
  const isString = described.kind === 'string' || described.kind === 'enum'
  switch (column.type) {
    case 'UUID':
      if (described.kind !== 'string' || described.format !== 'uuid') problems.push('expected uuid')
      break
    case 'UUID[]':
      if (described.kind !== 'array' || described.element?.format !== 'uuid') {
        problems.push('expected uuid array')
      }
      break
    case 'VARCHAR':
      if (!isString) problems.push('expected string')
      if (described.kind === 'string' && described.maxLength !== column.length) {
        problems.push(`max length: sql ${column.length}, contract ${described.maxLength}`)
      }
      for (const value of described.values ?? []) {
        if (column.length !== null && value.length > column.length) {
          problems.push(`enum value '${value}' longer than ${column.length}`)
        }
      }
      break
    case 'TEXT':
      if (described.kind !== 'string' || described.maxLength !== null) problems.push('expected text')
      break
    case 'INTEGER':
      if (described.kind !== 'number' || described.format !== 'safeint') problems.push('expected int')
      break
    case 'NUMERIC':
      if (described.kind !== 'number' || described.format !== null) problems.push('expected number')
      break
    case 'BOOLEAN':
      if (described.kind !== 'boolean') problems.push('expected boolean')
      break
    case 'DATE':
      if (described.kind !== 'string' || described.format !== 'date') problems.push('expected date')
      break
    case 'TIMESTAMPTZ':
      if (described.kind !== 'string' || described.format !== 'datetime') {
        problems.push('expected timestamp')
      }
      break
    case 'JSONB':
      if (!['json', 'array'].includes(described.kind)) problems.push('expected json')
      break
    default:
      problems.push(`unknown sql type ${column.type}`)
  }
  return problems
}

const sqlTables = parseSchema(schemaSql)
const contractTables = Object.entries(TABLE_SCHEMAS)

describe('schema drift (D-039)', () => {
  it('parses schema.sql', () => {
    expect(sqlTables.size).toBeGreaterThan(20)
  })

  it('has a contract for every table and no extra contracts', () => {
    const sqlNames = [...sqlTables.keys()].filter((name) => !TABLES_WITHOUT_CONTRACT.has(name))
    expect(Object.keys(TABLE_SCHEMAS).sort()).toEqual(sqlNames.sort())
  })

  describe.each(contractTables)('%s', (tableName, schema) => {
    const table = sqlTables.get(tableName)
    const shape: Record<string, z.ZodType> = schema.shape

    it('has the same columns', () => {
      expect(Object.keys(shape).sort()).toEqual([...(table?.columns.keys() ?? [])].sort())
    })

    it('matches type, length and nullability of every column', () => {
      const problems: Record<string, string[]> = {}
      for (const column of table?.columns.values() ?? []) {
        const field = shape[column.name]
        if (!field) continue
        const found = compare(column, describeSchema(field))
        if (found.length > 0) problems[column.name] = found
      }
      expect(problems).toEqual({})
    })

    it('matches every CHECK vocabulary', () => {
      const mismatches: Record<string, unknown> = {}
      for (const [columnName, field] of Object.entries(shape)) {
        const values = describeSchema(field).values
        const checked = table?.checks.get(columnName)
        const key = `${tableName}.${columnName}`
        if (values === null && checked === undefined) continue
        if (checked === undefined && ENUM_COLUMNS_WITHOUT_CHECK.has(key)) continue
        if (JSON.stringify(values) !== JSON.stringify(checked)) {
          mismatches[columnName] = { sql: checked ?? null, contract: values }
        }
      }
      expect(mismatches).toEqual({})
    })
  })
})
