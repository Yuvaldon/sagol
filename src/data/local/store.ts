import type { TableName } from '@contracts'

// The storage port of the command code (D-201). The local adapter runs it over IndexedDB (Store),
// the server over Postgres, so both answer with the same checks in the same order (D-090).
// It holds only what the commands use, with Store's semantics: `put` is an upsert on the primary
// key, a compound key is an array in the index's column order,. A transaction is ambient: work inside it
// reaches the tables through `table`, and a throw rolls back everything it wrote.

/** A primary key or index value: one column, or the columns of a compound index in order. */
export type StoreKey = string | number | readonly (string | number)[]

export interface StoreCollection<Row> {
  toArray(): Promise<Row[]>
  first(): Promise<Row | undefined>
  count(): Promise<number>
}

export interface StoreTable<Row> {
  get(key: StoreKey): Promise<Row | undefined>
  /** An index named as in `STORES`: a column, or `[a+b]` for a compound one. */
  where(index: string): { equals(value: StoreKey): StoreCollection<Row> }
  toArray(): Promise<Row[]>
  count(): Promise<number>
  add(row: Row): Promise<unknown>
  put(row: Row): Promise<unknown>
  bulkAdd(rows: Row[]): Promise<unknown>
  bulkPut(rows: Row[]): Promise<unknown>
  bulkDelete(keys: StoreKey[]): Promise<void>
}

/** The error name a store gives when it cannot reach its storage; callers may retry. */
export const STORE_UNAVAILABLE = 'StoreUnavailableError'

export type StoreMode = 'r' | 'rw'

export interface Store {
  transaction<T>(mode: StoreMode, tables: readonly TableName[], work: () => Promise<T>): Promise<T>
  table<Row>(name: TableName): StoreTable<Row>
}
