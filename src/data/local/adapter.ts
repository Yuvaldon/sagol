import { CHANGE_FEED_CHANNEL, INDEXED_DB_NAME } from '@config'
import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  IdentitySource,
  SessionPermissions,
  SessionService,
  TimeSource,
} from '@contracts'
import { createPermissionHints } from './actor'
import { createChangeFeed } from './changes'
import { createCommandRankCommands, createCommandRankRepository } from './commandRanks'
import { openDatabase } from './database'
import { createLeaveCommands, type LocalLeaveCommands } from './leaveCommands'
import { createLeaveCommentCommands, createLeaveCommentRepository } from './leaveComments'
import { createLeaveEventRepository, createLeaveRepository } from './leaves'
import {
  createLeaveTypeCommands,
  createLeaveTypeGroupCommands,
  createLeaveTypeGroupRepository,
  createLeaveTypeRepository,
} from './leaveTypes'
import { createOrganizationCommands, createOrganizationRepository } from './organizations'
import { createAccountCommands, createSoldierPreferencesRepository, type LocalAccountCommands } from './accounts'
import { createSessionService } from './session'
import {
  createMembershipRepository,
  createSoldierCommands,
  createSoldierPrivateRepository,
  createSoldierRepository,
} from './soldiers'
import {
  createSoldierTagRepository,
  createTagCategoryCommands,
  createTagCategoryRepository,
  createTagCommands,
  createTagRepository,
} from './tags'
import { createUnitLevelCommands, createUnitLevelRepository } from './unitLevels'
import { createUnitCommands, createUnitRepository } from './units'

// The adapter grows by slice (D-076): its type holds what exists, and nothing returns
// "not implemented". When every group exists it `satisfies DataAdapter`.

export interface LocalDataAdapter {
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
    | 'tag_categories'
    | 'tags'
    | 'soldier_tags'
    | 'leave_type_groups'
    | 'leave_types'
    | 'leaves'
    | 'leave_events'
    | 'leave_comments'
  >
  readonly commands: {
    readonly organizations: Pick<DataCommands['organizations'], 'bootstrapOwner'>
    readonly accounts: LocalAccountCommands
    readonly unit_levels: DataCommands['unit_levels']
    readonly units: DataCommands['units']
    readonly command_ranks: DataCommands['command_ranks']
    readonly soldiers: DataCommands['soldiers']
    readonly tag_categories: DataCommands['tag_categories']
    readonly tags: DataCommands['tags']
    readonly leave_type_groups: DataCommands['leave_type_groups']
    readonly leave_types: DataCommands['leave_types']
    readonly leaves: LocalLeaveCommands
    readonly leave_comments: DataCommands['leave_comments']
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
    session: { ...createSessionService(database, identity, changes), ...createPermissionHints(dependencies) },
    repositories: {
      organizations: createOrganizationRepository(dependencies),
      unit_levels: createUnitLevelRepository(dependencies),
      units: createUnitRepository(dependencies),
      command_ranks: createCommandRankRepository(dependencies),
      soldiers: createSoldierRepository(dependencies),
      soldier_private: createSoldierPrivateRepository(dependencies),
      unit_memberships: createMembershipRepository(dependencies),
      soldier_preferences: createSoldierPreferencesRepository(dependencies),
      tag_categories: createTagCategoryRepository(dependencies),
      tags: createTagRepository(dependencies),
      soldier_tags: createSoldierTagRepository(dependencies),
      leave_type_groups: createLeaveTypeGroupRepository(dependencies),
      leave_types: createLeaveTypeRepository(dependencies),
      leaves: createLeaveRepository(dependencies),
      leave_events: createLeaveEventRepository(dependencies),
      leave_comments: createLeaveCommentRepository(dependencies),
    },
    commands: {
      organizations: createOrganizationCommands(dependencies),
      accounts: createAccountCommands(dependencies),
      unit_levels: createUnitLevelCommands(dependencies),
      units: createUnitCommands(dependencies),
      command_ranks: createCommandRankCommands(dependencies),
      soldiers: createSoldierCommands(dependencies),
      tag_categories: createTagCategoryCommands(dependencies),
      tags: createTagCommands(dependencies),
      leave_type_groups: createLeaveTypeGroupCommands(dependencies),
      leave_types: createLeaveTypeCommands(dependencies),
      leaves: createLeaveCommands(dependencies),
      leave_comments: createLeaveCommentCommands(dependencies),
    },
    changes,
  }
}
