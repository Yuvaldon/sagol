import type { AppError } from '@contracts'
import { appErrorOf } from './results'

// What a hook hands the UI for a read: `loading`, `failed` with a stable error code the UI maps to
// i18n (D-046), or `ready`.

export type Loaded<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: AppError }
  | { readonly status: 'ready'; readonly value: T }

interface QueryState<T> {
  readonly isError: boolean
  readonly error: unknown
  readonly data: T | undefined
}

export function loaded<T>(query: QueryState<T>): Loaded<T> {
  if (query.data !== undefined) return { status: 'ready', value: query.data }
  if (query.isError) return { status: 'failed', error: appErrorOf(query.error) }
  return { status: 'loading' }
}
