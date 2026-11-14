import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  DataTransfer,
  AuthProvider,
  SubscribePushInput,
  SessionPermissions,
  SessionService,
  TimeSource,
} from '@contracts'
import type { DeviceKey } from '@config'

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
    | 'leave_batches'
    | 'leave_events'
    | 'leave_comments'
    | 'availability_rules'
    | 'property_definitions'
    | 'report_confirmations'
    | 'change_counters'
    | 'soldier_accounts'
    | 'roles'
    | 'role_permissions'
    | 'rank_role_bindings'
    | 'access_grants'
    | 'deployments'
    | 'deployment_members'
    | 'seniority_overrides'
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
    readonly property_definitions: DataCommands['property_definitions']
    readonly day_reports: DataCommands['day_reports']
    readonly roles: DataCommands['roles']
    readonly rank_role_bindings: DataCommands['rank_role_bindings']
    readonly access_grants: DataCommands['access_grants']
    readonly deployments: DataCommands['deployments']
    readonly seniority_overrides: DataCommands['seniority_overrides']
    readonly notifications: DataCommands['notifications']
  }
  /** Import and export (D-171). */
  readonly transfer: DataTransfer
  readonly changes: ChangeFeed
}

/** The env's provider: local identities in development, Google otherwise (D-006, D-207). */
export type AuthPort = AuthProvider

/** What the installed app can offer (D-184): the browser's own prompt, the words for iOS, or nothing. */
export type InstallOffer = 'prompt' | 'ios_hint' | 'none'

export interface ShellState {
  /** A new version is installed and waits for the soldier (D-183). */
  readonly updateReady: boolean
  readonly install: InstallOffer
}

/**
 * The app's own shell in the browser: its service worker and the install offer (D-183, D-184). `current()` answers the
 * same object until something changes, so a hook can read it as an external store.
 */
export interface ShellPort {
  readonly subscribe: (listener: () => void) => () => void
  readonly current: () => ShellState
  /** The waiting version takes over, and the page reloads once it controls. */
  readonly applyUpdate: () => void
  /** Shows the browser's install dialog; answers when the soldier chose. */
  readonly install: () => Promise<void>
}

/**
 * Phone notifications on this browser install (D-356), as the browser answers them. `unsupported`: no `PushManager` or
 * no public key in the build, so nothing is offered (D-076). `ios_install`: iOS outside the installed app, where push
 * exists only once installed (D-184). `checking` until the browser answered. Never stored: asked of
 * `PushManager.getSubscription()` each time.
 */
export type PushAvailability = 'unsupported' | 'checking' | 'ios_install' | 'denied' | 'off' | 'on'

export interface PushPort {
  readonly subscribe: (listener: () => void) => () => void
  readonly current: () => PushAvailability
  /** Asks the browser's permission, then subscribes it: the install's keys, or NULL when the permission was not given. */
  readonly enable: () => Promise<SubscribePushInput | null>
  /** Unsubscribes the browser: the endpoint it had, or NULL when it had none. */
  readonly disable: () => Promise<string | null>
  /**
   * The install the browser holds now, asking nothing: NULL without a subscription or a granted permission. The
   * browser may have renewed it on its own (`pushsubscriptionchange`), so the app sends it again on start (D-434).
   */
  readonly installed: () => Promise<SubscribePushInput | null>
}

/** One kind of web storage for the conveniences of one screen (D-197): never data, never a permission. */
export interface DeviceStore {
  /** The value under `key` for `scope`, the signed-in soldier; NULL when none or when storage is unavailable. */
  readonly read: (key: DeviceKey, scope: string) => string | null
  /** NULL forgets it. A storage that refuses loses the convenience, nothing more. */
  readonly write: (key: DeviceKey, scope: string, value: string | null) => void
}

/** What lasts on this device, and what lasts the session of this tab (D-197). */
export interface DevicePort {
  readonly local: DeviceStore
  readonly session: DeviceStore
}

export interface LogicPorts {
  readonly data: DataPort
  readonly auth: AuthPort
  /** The same source the adapter gets (D-083). */
  readonly time: TimeSource
  readonly shell: ShellPort
  readonly push: PushPort
  readonly device: DevicePort
}
