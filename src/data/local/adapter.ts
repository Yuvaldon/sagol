import { CHANGE_FEED_CHANNEL, INDEXED_DB_NAME } from '@config'
import type { IdentitySource, TimeSource } from '@contracts'
import { createChangeFeed } from './changes'
import { createAdapterCore, type LocalDataAdapter } from './core'
import { anyClaimant } from './dependencies'
import { openDatabase } from './database'

export type { LocalDataAdapter } from './core'

export interface LocalAdapterDependencies {
  readonly identity: IdentitySource
  readonly time: TimeSource
}

/** Store names. Tests give each test its own. */
export interface LocalAdapterNames {
  readonly database: string
  readonly channel: string
}

const DEFAULT_NAMES: LocalAdapterNames = { database: INDEXED_DB_NAME, channel: CHANGE_FEED_CHANNEL }

export function createLocalDataAdapter(
  { identity, time }: LocalAdapterDependencies,
  names: LocalAdapterNames = DEFAULT_NAMES,
): LocalDataAdapter {
  return createAdapterCore({
    database: openDatabase(names.database),
    identity,
    time,
    changes: createChangeFeed(names.channel),
    claimant: anyClaimant,
  })
}

