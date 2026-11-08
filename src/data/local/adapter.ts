import { CHANGE_FEED_CHANNEL, INDEXED_DB_NAME } from '@config'
import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  IdentitySource,
  SessionService,
  TimeSource,
} from '@contracts'
import { createChangeFeed } from './changes'
import { openDatabase } from './database'
import { createOrganizationCommands, createOrganizationRepository } from './organizations'
import { createSessionService } from './session'

// The adapter grows by slice (D-076): its type holds what exists, and nothing returns
// "not implemented". When every group exists it `satisfies DataAdapter`.

export interface LocalDataAdapter {
  readonly session: SessionService
  readonly repositories: Pick<DataRepositories, 'organizations'>
  readonly commands: {
    readonly organizations: Pick<DataCommands['organizations'], 'bootstrapOwner'>
  }
  readonly changes: ChangeFeed
}

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
  const database = openDatabase(names.database)
  const changes = createChangeFeed(names.channel)
  const dependencies = { database, identity, time, changes }
  return {
    session: createSessionService(database, identity, changes),
    repositories: { organizations: createOrganizationRepository(dependencies) },
    commands: { organizations: createOrganizationCommands(dependencies) },
    changes,
  }
}
