import type { AppError } from '../errors'

/** Outcome of every command and query (D-046). Adapters never throw across a layer. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

export type AsyncResult<T> = Promise<Result<T>>

/** Ends a subscription. */
export type Unsubscribe = () => void
