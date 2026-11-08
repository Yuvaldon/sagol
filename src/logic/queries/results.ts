import type { AppError, AsyncResult } from '@contracts'

// TanStack Query reports failures by rejection, while adapters answer with `Result` (D-046). These
// two functions cross that line. Hooks hand the UI an `AppError`, never an exception.

class ResultError extends Error {
  readonly appError: AppError

  constructor(appError: AppError) {
    super(appError.code)
    this.appError = appError
  }
}

/** The value of a result, for a query function. */
export async function unwrap<T>(result: AsyncResult<T>): Promise<T> {
  const settled = await result
  if (!settled.ok) throw new ResultError(settled.error)
  return settled.value
}

/** The error a query failed with. Anything else that reached it counts as `internal`. */
export function appErrorOf(error: unknown): AppError {
  return error instanceof ResultError ? error.appError : { code: 'internal' }
}
