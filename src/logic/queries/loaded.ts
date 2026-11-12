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

const LOADING = { status: 'loading' } as const
// One answer per read result, so a memo that depends on a read reruns only when its data does (D-174).
interface Ready {
  readonly status: 'ready'
  readonly value: unknown
}
interface Failed {
  readonly status: 'failed'
  readonly error: AppError
}
const ready = new WeakMap<object, Ready>()
const failed = new WeakMap<object, Failed>()

// "There is none" (such as no organization yet) is one answer too.
const READY_NONE: Ready = { status: 'ready', value: null }

function holds<T>(answer: Ready | undefined, data: T): answer is { readonly status: 'ready'; readonly value: T } {
  return answer !== undefined && answer.value === data
}

export function loaded<T>(query: QueryState<T>): Loaded<T> {
  const { data, error } = query
  if (data !== undefined) {
    if (holds(READY_NONE, data)) return READY_NONE
    if (typeof data !== 'object' || data === null) return { status: 'ready', value: data }
    const known = ready.get(data)
    if (holds(known, data)) return known
    const fresh = { status: 'ready', value: data } as const
    ready.set(data, fresh)
    return fresh
  }
  if (query.isError) {
    if (typeof error !== 'object' || error === null) return { status: 'failed', error: appErrorOf(error) }
    const known = failed.get(error) ?? { status: 'failed', error: appErrorOf(error) }
    failed.set(error, known)
    return known
  }
  return LOADING
}
