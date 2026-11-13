import {
  TABLE_SCHEMAS,
  type AppError,
  type AsyncResult,
  type Issue,
  type TableName,
  type TableRow,
} from '@contracts'
import { issuesFromSchema } from '@domain'
import type { z } from 'zod'
import { STORE_UNAVAILABLE } from './store'

// Inside the adapter a refusal is an exception, because throwing is what aborts a Store
// transaction. `asResult` turns it into the `Result` every caller sees: nothing throws across a
// layer (D-046).

class CommandFailure extends Error {
  readonly failure: AppError

  constructor(failure: AppError) {
    super(failure.code)
    this.failure = failure
  }
}

export function fail(failure: AppError): never {
  throw new CommandFailure(failure)
}

export function failValidation(issues: readonly Issue[]): never {
  return fail({ code: 'validation_failed', issues: [...issues] })
}

/** Storage errors that mean "the storage cannot be reached", which is safe to retry: Dexie's, and the server store's. */
const STORAGE_ERROR_NAMES: readonly string[] = [
  'OpenFailedError',
  'DatabaseClosedError',
  'MissingAPIError',
  'QuotaExceededError',
  'VersionError',
  STORE_UNAVAILABLE,
]

/** Which stored row the contracts rejected (OI-296): the table and the issue paths, never the values. */
export interface RowRejection {
  readonly table: TableName
  readonly paths: readonly string[]
}

/** A row read from storage that the contracts reject: a fault of the stored data, never of the caller. */
class RowRejected extends Error {
  readonly rejection: RowRejection

  constructor(rejection: RowRejection) {
    super(`row rejected: ${rejection.table}`)
    this.rejection = rejection
  }
}

// The caller sees only `internal`; the rejection stays beside the answer, keyed by its error object, for the
// server's log line (D-346). Nothing here is serialized, so it never reaches a client.
const rejections = new WeakMap<AppError, RowRejection>()

/** The rejected row behind an `internal` answer, when a parse failure caused it. */
export function rowRejectionOf(error: AppError): RowRejection | undefined {
  return rejections.get(error)
}

export async function asResult<T>(work: () => Promise<T>): AsyncResult<T> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    if (error instanceof CommandFailure) return { ok: false, error: error.failure }
    if (error instanceof RowRejected) {
      const failure: AppError = { code: 'internal' }
      rejections.set(failure, error.rejection)
      return { ok: false, error: failure }
    }
    const storage = error instanceof Error && STORAGE_ERROR_NAMES.includes(error.name)
    return { ok: false, error: { code: storage ? 'unavailable' : 'internal' } }
  }
}

/** The first step of every command (D-008): Zod failures become field codes (D-068). */
export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input)
  if (parsed.success) return parsed.data
  return failValidation(issuesFromSchema(parsed.error.issues, input))
}

/** IndexedDB is an untyped boundary (D-036): rows are parsed where they enter and leave it. */
export function parsedRow<T extends TableName>(table: T, row: unknown): TableRow<T> {
  const parsed = TABLE_SCHEMAS[table].safeParse(row)
  if (parsed.success) return parsed.data as TableRow<T>
  const paths = new Set(parsed.error.issues.map((issue) => issue.path.map(String).join('.')))
  throw new RowRejected({ table, paths: [...paths] })
}
