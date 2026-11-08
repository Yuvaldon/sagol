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

// Inside the adapter a refusal is an exception, because throwing is what aborts a Dexie
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

/** Dexie errors that mean "the storage cannot be reached", which is safe to retry. */
const STORAGE_ERROR_NAMES: readonly string[] = [
  'OpenFailedError',
  'DatabaseClosedError',
  'MissingAPIError',
  'QuotaExceededError',
  'VersionError',
]

export async function asResult<T>(work: () => Promise<T>): AsyncResult<T> {
  try {
    return { ok: true, value: await work() }
  } catch (error) {
    if (error instanceof CommandFailure) return { ok: false, error: error.failure }
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
  return TABLE_SCHEMAS[table].parse(row) as TableRow<T>
}
