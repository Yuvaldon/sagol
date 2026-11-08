import type {
  AuthIdentity,
  ChangeFeed,
  DataCommands,
  DataRepositories,
  SessionPermissions,
  SessionService,
  TableName,
  TableRow,
} from '@contracts'

/** What the suite exercises in this slice. */
export interface ContractAdapter {
  readonly session: SessionService & SessionPermissions
  readonly repositories: Pick<DataRepositories, 'organizations' | 'unit_levels' | 'units'>
  readonly commands: {
    readonly organizations: Pick<DataCommands['organizations'], 'bootstrapOwner'>
    readonly unit_levels: DataCommands['unit_levels']
    readonly units: DataCommands['units']
  }
  readonly changes: ChangeFeed
}

/** One adapter on an empty store, and direct access to that store. */
export interface ContractHarness {
  readonly adapter: ContractAdapter
  /** Who is signed in from now on. */
  signIn(identity: AuthIdentity | null): void
  /** Writes rows directly, skipping the commands, for states no screen creates yet. */
  seed<T extends TableName>(table: T, rows: readonly TableRow<T>[]): Promise<void>
  /** Reads a table directly, to prove what a refused command did not write. */
  rows<T extends TableName>(table: T): Promise<TableRow<T>[]>
  dispose(): Promise<void>
}
