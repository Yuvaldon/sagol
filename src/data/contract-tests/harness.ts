import type {
  AuthIdentity,
  ChangeFeed,
  DataCommands,
  DataRepositories,
  DataTransfer,
  SessionPermissions,
  SessionService,
  TableName,
  TableRow,
} from '@contracts'

/** What the suite exercises in this slice. */
export interface ContractAdapter {
  readonly session: SessionService & SessionPermissions
  readonly repositories: Pick<
    DataRepositories,
    | 'organizations'
    | 'unit_levels'
    | 'units'
    | 'command_ranks'
    | 'soldiers'
    | 'soldier_private'
    | 'unit_memberships'
    | 'soldier_preferences'
    | 'account_link_requests'
    | 'tag_categories'
    | 'tags'
    | 'soldier_tags'
    | 'leave_type_groups'
    | 'leave_types'
    | 'leaves'
    | 'leave_events'
    | 'leave_comments'
    | 'availability_rules'
    | 'soldier_accounts'
    | 'roles'
    | 'role_permissions'
    | 'rank_role_bindings'
    | 'access_grants'
    | 'property_definitions'
    | 'seniority_overrides'
    | 'leave_batches'
    | 'deployments'
    | 'deployment_members'
  >
  readonly commands: {
    readonly organizations: DataCommands['organizations']
    readonly accounts: DataCommands['accounts']
    readonly unit_levels: DataCommands['unit_levels']
    readonly units: DataCommands['units']
    readonly command_ranks: DataCommands['command_ranks']
    readonly soldiers: DataCommands['soldiers']
    readonly tag_categories: DataCommands['tag_categories']
    readonly tags: DataCommands['tags']
    readonly leave_type_groups: DataCommands['leave_type_groups']
    readonly leave_types: DataCommands['leave_types']
    readonly leaves: Pick<DataCommands['leaves'], 'create' | 'createBatch' | 'createMany' | 'duplicate' | 'update' | 'transition'>
    readonly leave_comments: DataCommands['leave_comments']
    readonly availability_rules: DataCommands['availability_rules']
    readonly roles: DataCommands['roles']
    readonly rank_role_bindings: DataCommands['rank_role_bindings']
    readonly access_grants: DataCommands['access_grants']
    readonly property_definitions: DataCommands['property_definitions']
    readonly seniority_overrides: DataCommands['seniority_overrides']
    readonly deployments: DataCommands['deployments']
  }
  readonly transfer: DataTransfer
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
