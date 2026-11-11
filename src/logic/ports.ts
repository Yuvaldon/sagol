import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  LocalAuthProvider,
  SessionPermissions,
  SessionService,
  TimeSource,
} from '@contracts'

// What `logic` needs from the outside, narrowed to what exists (D-076). `app` provides it, and
// `logic` never imports `data`. Each slice widens these ports as it adds a group.

export interface DataPort {
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
    readonly leaves: Pick<DataCommands['leaves'], 'create' | 'update' | 'transition'>
    readonly leave_comments: DataCommands['leave_comments']
    readonly availability_rules: DataCommands['availability_rules']
    readonly roles: DataCommands['roles']
    readonly rank_role_bindings: DataCommands['rank_role_bindings']
    readonly access_grants: DataCommands['access_grants']
  }
  readonly changes: ChangeFeed
}

/** The only auth provider built so far is the local one (row 8.4 adds Google). */
export type AuthPort = LocalAuthProvider

export interface LogicPorts {
  readonly data: DataPort
  readonly auth: AuthPort
  /** The same source the adapter gets (D-083). */
  readonly time: TimeSource
}
