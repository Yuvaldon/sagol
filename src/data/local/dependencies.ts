import type { Store } from './store'
import type { AuthIdentity, IdentitySource, SoldierId, TimeSource, Timestamp } from '@contracts'
import type { LocalChangeFeed } from './changes'

/** What every repository and command of the local adapter is built from. */
export interface LocalDependencies {
  readonly database: Store
  readonly identity: IdentitySource
  readonly time: TimeSource
  readonly changes: LocalChangeFeed
  /** Who may claim an empty organization, beyond the rule every adapter keeps (D-005, D-006). */
  readonly claimant: BootstrapClaimant
}

/**
 * Says whether an identity may become the owner of an empty organization. The adapter still requires a verified email
 * and an empty store; this only narrows who, never widens it.
 */
export type BootstrapClaimant = (identity: AuthIdentity) => boolean

/** Development (D-006): on an empty local store the developer, whoever they are, claims it through the real flow. */
export const anyClaimant: BootstrapClaimant = () => true

/**
 * Production (D-005): only the identity whose email is the server's `BOOTSTRAP_OWNER_EMAIL`. Emails compare without
 * case, as providers report them in either.
 */
export function ownerEmailClaimant(ownerEmail: string): BootstrapClaimant {
  const owner = ownerEmail.trim().toLowerCase()
  return (identity) => owner !== '' && identity.email.trim().toLowerCase() === owner
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
