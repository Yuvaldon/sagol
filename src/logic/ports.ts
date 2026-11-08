import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  LocalAuthProvider,
  SessionPermissions,
  SessionService,
} from '@contracts'

// What `logic` needs from the outside, narrowed to what exists (D-076). `app` provides it, and
// `logic` never imports `data`. Each slice widens these ports as it adds a group.

export interface DataPort {
  readonly session: SessionService & SessionPermissions
  readonly repositories: Pick<DataRepositories, 'organizations' | 'unit_levels' | 'units'>
  readonly commands: {
    readonly organizations: Pick<DataCommands['organizations'], 'bootstrapOwner'>
    readonly unit_levels: DataCommands['unit_levels']
    readonly units: DataCommands['units']
  }
  readonly changes: ChangeFeed
}

/** The only auth provider built so far is the local one (row 8.4 adds Google). */
export type AuthPort = LocalAuthProvider

export interface LogicPorts {
  readonly data: DataPort
  readonly auth: AuthPort
}
