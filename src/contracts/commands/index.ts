import type { AsyncResult } from '../common/result'
import type { IdentitySource, Session, SessionPermissions, SessionService, TimeSource } from '../auth'
import type { AccountLinkRequest, SoldierPreferencesRecord } from '../entities/accounts'
import type { Deployment, DeploymentMember } from '../entities/deployments'
import type { Unit, UnitLevel } from '../entities/hierarchy'
import type { Leave, LeaveBatch, LeaveComment, LeaveType, LeaveTypeGroup } from '../entities/leaves'
import type { Organization } from '../entities/organization'
import type { AccessGrant, RankRoleBinding, Role } from '../entities/permissions'
import type { PropertyDefinition } from '../entities/properties'
import type { AvailabilityRule } from '../entities/rules'
import type {
  CommandRank,
  SeniorityOverride,
  Soldier,
  SoldierPrivate,
  UnitMembership,
} from '../entities/soldiers'
import type { SoldierTag, Tag, TagCategory } from '../entities/tags'
import type {
  AccountLinkResult,
  CancelAccountLinkRequestInput,
  RequestAccountLinkInput,
  ReviewAccountLinkInput,
  UpdateMyPreferencesInput,
} from '../inputs/accounts'
import type {
  ArchiveDeploymentInput,
  CreateDeploymentInput,
  SetDeploymentMembersInput,
  UpdateDeploymentInput,
} from '../inputs/deployments'
import type {
  ArchiveUnitInput,
  ArchiveUnitLevelInput,
  CreateUnitInput,
  CreateUnitLevelInput,
  MoveUnitInput,
  ReorderUnitLevelsInput,
  ReorderUnitsInput,
  UpdateUnitInput,
  UpdateUnitLevelInput,
} from '../inputs/hierarchy'
import type {
  AddLeaveCommentInput,
  ArchiveLeaveCommentInput,
  ArchiveLeaveTypeGroupInput,
  ArchiveLeaveTypeInput,
  CreateLeaveBatchInput,
  CreateLeaveInput,
  CreateLeaveTypeGroupInput,
  CreateLeaveTypeInput,
  DuplicateLeaveInput,
  EditLeaveCommentInput,
  ReorderLeaveTypeGroupsInput,
  ReorderLeaveTypesInput,
  RescheduleLeaveInput,
  TransitionLeaveInput,
  UpdateLeaveInput,
  UpdateLeaveTypeGroupInput,
  UpdateLeaveTypeInput,
} from '../inputs/leaves'
import type { BootstrapOwnerInput, UpdateOrganizationInput } from '../inputs/organization'
import type {
  ArchiveRankRoleBindingInput,
  ArchiveRoleInput,
  CreateRankRoleBindingInput,
  CreateRoleInput,
  GrantAccessInput,
  RevokeAccessInput,
  UpdateRankRoleBindingInput,
  UpdateRoleInput,
} from '../inputs/permissions'
import type {
  ArchivePropertyDefinitionInput,
  CreatePropertyDefinitionInput,
  ReorderPropertyDefinitionsInput,
  UpdatePropertyDefinitionInput,
} from '../inputs/properties'
import type {
  ArchiveAvailabilityRuleInput,
  CreateAvailabilityRuleInput,
  UpdateAvailabilityRuleInput,
} from '../inputs/rules'
import type {
  ArchiveCommandRankInput,
  ArchiveSoldierInput,
  ChangeMembershipInput,
  CreateCommandRankInput,
  CreateSeniorityOverrideInput,
  CreateSoldierInput,
  RevokeSeniorityOverrideInput,
  SetSoldierTagsInput,
  UpdateCommandRankInput,
  UpdateSoldierInput,
  UpdateSoldierPrivateInput,
} from '../inputs/soldiers'
import type {
  ArchiveTagCategoryInput,
  ArchiveTagInput,
  CreateTagCategoryInput,
  CreateTagInput,
  ReorderTagCategoriesInput,
  ReorderTagsInput,
  UpdateTagCategoryInput,
  UpdateTagInput,
} from '../inputs/tags'
import type { ImportBatchInput, ImportReport, OrganizationExport } from '../inputs/transfer'
import type { ChangeFeed, DataRepositories } from '../repositories'

// Write side of the data layer: workflow changes are commands, not field updates (D-008).
// Each command parses its input with the contract schema, then checks integrity, policy and
// domain invariants inside one transaction, bumps versions, writes audit events and
// returns the rows it wrote. The actor is the session's soldier, never an argument.

/** One command: input in, written row(s) or an error out. */
export type Command<Input, Output> = (input: Input) => AsyncResult<Output>

/** create / update / archive of a mutable reference entity. */
export interface ReferenceCommands<CreateInput, UpdateInput, ArchiveInput, Row> {
  create: Command<CreateInput, Row>
  update: Command<UpdateInput, Row>
  archive: Command<ArchiveInput, Row>
}

/** Reorder of a sortable entity; returns the rows in their new order. */
export interface SortableCommands<ReorderInput, Row> {
  reorder: Command<ReorderInput, Row[]>
}

export interface DataCommands {
  organizations: {
    /** Available to an `unlinked` session only (D-005). Returns the new `linked` session. */
    bootstrapOwner: Command<BootstrapOwnerInput, Session>
    update: Command<UpdateOrganizationInput, Organization>
  }
  accounts: {
    requestLink: Command<RequestAccountLinkInput, AccountLinkResult>
    cancelLinkRequest: Command<CancelAccountLinkRequestInput, AccountLinkRequest>
    reviewLink: Command<ReviewAccountLinkInput, AccountLinkRequest>
    updateMyPreferences: Command<UpdateMyPreferencesInput, SoldierPreferencesRecord>
  }
  unit_levels: ReferenceCommands<
    CreateUnitLevelInput,
    UpdateUnitLevelInput,
    ArchiveUnitLevelInput,
    UnitLevel
  > &
    SortableCommands<ReorderUnitLevelsInput, UnitLevel>
  units: ReferenceCommands<CreateUnitInput, UpdateUnitInput, ArchiveUnitInput, Unit> &
    SortableCommands<ReorderUnitsInput, Unit> & {
      move: Command<MoveUnitInput, Unit>
    }
  command_ranks: ReferenceCommands<
    CreateCommandRankInput,
    UpdateCommandRankInput,
    ArchiveCommandRankInput,
    CommandRank
  >
  soldiers: ReferenceCommands<CreateSoldierInput, UpdateSoldierInput, ArchiveSoldierInput, Soldier> & {
    updatePrivate: Command<UpdateSoldierPrivateInput, SoldierPrivate>
    setTags: Command<SetSoldierTagsInput, SoldierTag[]>
    /** Returns the closed and the opened membership rows. */
    changeMembership: Command<ChangeMembershipInput, UnitMembership[]>
  }
  seniority_overrides: {
    create: Command<CreateSeniorityOverrideInput, SeniorityOverride>
    revoke: Command<RevokeSeniorityOverrideInput, SeniorityOverride>
  }
  roles: ReferenceCommands<CreateRoleInput, UpdateRoleInput, ArchiveRoleInput, Role>
  rank_role_bindings: ReferenceCommands<
    CreateRankRoleBindingInput,
    UpdateRankRoleBindingInput,
    ArchiveRankRoleBindingInput,
    RankRoleBinding
  >
  access_grants: {
    grant: Command<GrantAccessInput, AccessGrant>
    revoke: Command<RevokeAccessInput, AccessGrant>
  }
  tag_categories: ReferenceCommands<
    CreateTagCategoryInput,
    UpdateTagCategoryInput,
    ArchiveTagCategoryInput,
    TagCategory
  > &
    SortableCommands<ReorderTagCategoriesInput, TagCategory>
  tags: ReferenceCommands<CreateTagInput, UpdateTagInput, ArchiveTagInput, Tag> &
    SortableCommands<ReorderTagsInput, Tag>
  leave_type_groups: ReferenceCommands<
    CreateLeaveTypeGroupInput,
    UpdateLeaveTypeGroupInput,
    ArchiveLeaveTypeGroupInput,
    LeaveTypeGroup
  > &
    SortableCommands<ReorderLeaveTypeGroupsInput, LeaveTypeGroup>
  leave_types: ReferenceCommands<
    CreateLeaveTypeInput,
    UpdateLeaveTypeInput,
    ArchiveLeaveTypeInput,
    LeaveType
  > &
    SortableCommands<ReorderLeaveTypesInput, LeaveType>
  /** Leave commands evaluate affected availability rules (D-014, D-047). */
  leaves: {
    create: Command<CreateLeaveInput, Leave>
    createBatch: Command<CreateLeaveBatchInput, { batch: LeaveBatch; leaves: Leave[] }>
    duplicate: Command<DuplicateLeaveInput, Leave[]>
    update: Command<UpdateLeaveInput, Leave>
    reschedule: Command<RescheduleLeaveInput, Leave>
    transition: Command<TransitionLeaveInput, Leave>
  }
  leave_comments: {
    add: Command<AddLeaveCommentInput, LeaveComment>
    edit: Command<EditLeaveCommentInput, LeaveComment>
    archive: Command<ArchiveLeaveCommentInput, LeaveComment>
  }
  deployments: ReferenceCommands<
    CreateDeploymentInput,
    UpdateDeploymentInput,
    ArchiveDeploymentInput,
    Deployment
  > & {
    setMembers: Command<SetDeploymentMembersInput, DeploymentMember[]>
  }
  availability_rules: ReferenceCommands<
    CreateAvailabilityRuleInput,
    UpdateAvailabilityRuleInput,
    ArchiveAvailabilityRuleInput,
    AvailabilityRule
  >
  property_definitions: ReferenceCommands<
    CreatePropertyDefinitionInput,
    UpdatePropertyDefinitionInput,
    ArchivePropertyDefinitionInput,
    PropertyDefinition
  > &
    SortableCommands<ReorderPropertyDefinitionsInput, PropertyDefinition>
}

/** Import and export (resource `data_transfer`, D-022, D-050). */
export interface DataTransfer {
  importBatch: Command<ImportBatchInput, ImportReport>
  exportOrganization(): AsyncResult<OrganizationExport>
}

/** What `app` constructs and hands to `logic`. Local (IndexedDB) now, remote in phase 8. */
export interface DataAdapter {
  session: SessionService & SessionPermissions
  repositories: DataRepositories
  commands: DataCommands
  transfer: DataTransfer
  changes: ChangeFeed
}

/** Adapters receive who is signed in and what time it is; the actor is derived (D-008, D-083). */
export type DataAdapterFactory = (dependencies: {
  identity: IdentitySource
  time: TimeSource
}) => DataAdapter
