import type Dexie from 'dexie'
import type { IdentitySource, SoldierId, TimeSource, Timestamp } from '@contracts'
import type { LocalChangeFeed } from './changes'

/** What every repository and command of the local adapter is built from. */
export interface LocalDependencies {
  readonly database: Dexie
  readonly identity: IdentitySource
  readonly time: TimeSource
  readonly changes: LocalChangeFeed
}

/** Audit block of a new mutable row (D-017). */
export function createdBy(actor: SoldierId, now: Timestamp) {
  return {
    created_at: now,
    created_by: actor,
    updated_at: now,
    updated_by: actor,
    version: 1,
    archived_at: null,
  }
}

/** Audit columns of a change to a row at `version` (D-017). */
export function updatedBy(actor: SoldierId, now: Timestamp, version: number) {
  return { updated_at: now, updated_by: actor, version: version + 1 }
}
