import type {
  ChangeFeed,
  DataCommands,
  DataRepositories,
  DataTransfer,
  SessionPermissions,
  SessionService,
} from '@contracts'
import { createPermissionHints } from './actor'
import { createCommandRankCommands, createCommandRankRepository } from './commandRanks'
import type { LocalDependencies } from './dependencies'
import { createDeploymentCommands, createDeploymentMemberRepository, createDeploymentRepository } from './deployments'
import { createLeaveCommands } from './leaveCommands'
import { createLeaveBatchRepository, createLeaveCreationCommands } from './leaveCreation'
import { createSeniorityOverrideCommands, createSeniorityOverrideRepository } from './seniorityOverrides'
import { createLeaveCommentCommands, createLeaveCommentRepository } from './leaveComments'
import { createLeaveEventRepository, createLeaveRepository } from './leaves'
import {
  createLeaveTypeCommands,
  createLeaveTypeGroupCommands,
  createLeaveTypeGroupRepository,
  createLeaveTypeRepository,
} from './leaveTypes'
import {
  createAccessGrantCommands,
  createAccessGrantRepository,
  createRankRoleBindingCommands,
  createRankRoleBindingRepository,
  createRoleCommands,
  createRolePermissionRepository,
  createRoleRepository,
} from './permissions'
import { createOrganizationCommands, createOrganizationRepository } from './organizations'
import {
  createAccountCommands,
  createAccountLinkRequestRepository,
  createSoldierAccountRepository,
  createSoldierPreferencesRepository,
  type LocalAccountCommands,
} from './accounts'
import { createDayReportCommands, createReportConfirmationRepository } from './reports'
import { createPropertyDefinitionCommands, createPropertyDefinitionRepository } from './propertyDefinitions'
import { createAvailabilityRuleCommands, createAvailabilityRuleRepository } from './rules'
import { createSessionService } from './session'
import { createTransfer } from './transfer'
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
    | 'account_link_requests'
    | 'soldier_accounts'
    | 'roles'
    | 'role_permissions'
    | 'rank_role_bindings'
    | 'access_grants'
    | 'tag_categories'
    | 'tags'
    | 'soldier_tags'
    | 'leave_type_groups'
    | 'leave_types'
    | 'leaves'
    | 'leave_events'
    | 'leave_comments'
    | 'availability_rules'
    | 'property_definitions'
    | 'seniority_overrides'
    | 'leave_batches'
    | 'deployments'
    | 'deployment_members'
    | 'report_confirmations'
  >
  readonly commands: {
    readonly organizations: DataCommands['organizations']
    readonly accounts: LocalAccountCommands
    readonly unit_levels: DataCommands['unit_levels']
    readonly units: DataCommands['units']
    readonly command_ranks: DataCommands['command_ranks']
    readonly soldiers: DataCommands['soldiers']
    readonly roles: DataCommands['roles']
    readonly rank_role_bindings: DataCommands['rank_role_bindings']
    readonly access_grants: DataCommands['access_grants']
    readonly tag_categories: DataCommands['tag_categories']
    readonly tags: DataCommands['tags']
    readonly leave_type_groups: DataCommands['leave_type_groups']
    readonly leave_types: DataCommands['leave_types']
    readonly leaves: DataCommands['leaves']
    readonly leave_comments: DataCommands['leave_comments']
    readonly availability_rules: DataCommands['availability_rules']
    readonly property_definitions: DataCommands['property_definitions']
    readonly seniority_overrides: DataCommands['seniority_overrides']
    readonly deployments: DataCommands['deployments']
    readonly day_reports: DataCommands['day_reports']
  }
  readonly transfer: DataTransfer
  readonly changes: ChangeFeed
}

/**
 * The adapter over any store (D-201): the browser builds it over IndexedDB, the command gateway
 * over the request's Postgres transaction.
 */
export function createAdapterCore(dependencies: LocalDependencies): LocalDataAdapter {
  const { database, identity, changes, claimant } = dependencies
  return {
    session: { ...createSessionService(database, identity, changes, claimant), ...createPermissionHints(dependencies) },
    repositories: {
      organizations: createOrganizationRepository(dependencies),
      unit_levels: createUnitLevelRepository(dependencies),
      units: createUnitRepository(dependencies),
      command_ranks: createCommandRankRepository(dependencies),
      soldiers: createSoldierRepository(dependencies),
      soldier_private: createSoldierPrivateRepository(dependencies),
      unit_memberships: createMembershipRepository(dependencies),
      soldier_preferences: createSoldierPreferencesRepository(dependencies),
      account_link_requests: createAccountLinkRequestRepository(dependencies),
      soldier_accounts: createSoldierAccountRepository(dependencies),
      roles: createRoleRepository(dependencies),
      role_permissions: createRolePermissionRepository(dependencies),
      rank_role_bindings: createRankRoleBindingRepository(dependencies),
      access_grants: createAccessGrantRepository(dependencies),
      tag_categories: createTagCategoryRepository(dependencies),
      tags: createTagRepository(dependencies),
      soldier_tags: createSoldierTagRepository(dependencies),
      leave_type_groups: createLeaveTypeGroupRepository(dependencies),
      leave_types: createLeaveTypeRepository(dependencies),
      leaves: createLeaveRepository(dependencies),
      leave_events: createLeaveEventRepository(dependencies),
      leave_comments: createLeaveCommentRepository(dependencies),
      availability_rules: createAvailabilityRuleRepository(dependencies),
      property_definitions: createPropertyDefinitionRepository(dependencies),
      seniority_overrides: createSeniorityOverrideRepository(dependencies),
      leave_batches: createLeaveBatchRepository(dependencies),
      deployments: createDeploymentRepository(dependencies),
      deployment_members: createDeploymentMemberRepository(dependencies),
      report_confirmations: createReportConfirmationRepository(dependencies),
    },
    commands: {
      organizations: createOrganizationCommands(dependencies),
      accounts: createAccountCommands(dependencies),
      unit_levels: createUnitLevelCommands(dependencies),
      units: createUnitCommands(dependencies),
      command_ranks: createCommandRankCommands(dependencies),
      soldiers: createSoldierCommands(dependencies),
      roles: createRoleCommands(dependencies),
      rank_role_bindings: createRankRoleBindingCommands(dependencies),
      access_grants: createAccessGrantCommands(dependencies),
      tag_categories: createTagCategoryCommands(dependencies),
      tags: createTagCommands(dependencies),
      leave_type_groups: createLeaveTypeGroupCommands(dependencies),
      leave_types: createLeaveTypeCommands(dependencies),
      leaves: { ...createLeaveCommands(dependencies), ...createLeaveCreationCommands(dependencies) },
      leave_comments: createLeaveCommentCommands(dependencies),
      availability_rules: createAvailabilityRuleCommands(dependencies),
      property_definitions: createPropertyDefinitionCommands(dependencies),
      seniority_overrides: createSeniorityOverrideCommands(dependencies),
      deployments: createDeploymentCommands(dependencies),
      day_reports: createDayReportCommands(dependencies),
    },
    transfer: createTransfer(dependencies),
    changes,
  }
}
