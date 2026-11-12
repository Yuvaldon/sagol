// Public entry point of the LOGIC layer.
// Business rules, services and the hooks exposed to the UI. Receives
// repositories by injection and never imports @data.
export type { AuthPort, DataPort, LogicPorts } from './ports'
export { LogicProvider } from './runtime/LogicProvider'
export { fieldNameOf, formIssues } from './forms/issues'
export { claimIssues, timeZoneChoices, type ClaimOrganizationValues } from './organization/claim'
export type { Loaded } from './queries/loaded'
export {
  useClaimOrganization,
  useCurrentOrganization,
  useKnownIdentities,
  useOnboarding,
  useSession,
  useSignIn,
  useSignOut,
} from './session/hooks'
export { useCan, useModuleAccess, type CanAnswer } from './permissions/hooks'
export { WorkspaceSearch, useWorkspaceSearch } from './view-state/search'
export { usePanel, type PanelState, type PanelTarget } from './view-state/panel'
export { dateWindowOf, shiftedWindow, useDateWindow, type DateWindow, type DateWindowState } from './view-state/window'
export {
  NO_CONDITIONS,
  filterUnitOf,
  readFilter,
  unitFilterOf,
  useViewFilter,
  withPropertyChip,
  withTagChip,
  writeFilter,
  type FilterUnit,
  type ReadFilter,
  type PropertyChip,
  type SoldierConditions,
  type ViewFilterState,
} from './view-state/filter'
export { BoardLeaveStatus, LeaveConditions, hasLeaveConditions, leaveMatches } from './view-state/conditions'
export {
  useBoardFilters,
  useLeaveConditions,
  useOnlyMissing,
  usePresenceDay,
  useRulesDay,
  type BoardFiltersState,
  type LeaveConditionsState,
  type OnlyMissingState,
  type PresenceDayState,
  type RulesDayState,
} from './view-state/board'
export { filterContextOf, populationOf, useFilterSource, type FilterSource } from './filters/source'
export { presenceLists, type PresenceEntry, type PresenceInput, type PresenceLists } from './presence/presence'
export { usePresence } from './presence/hooks'
export { useActiveView, type ActiveViewState } from './view-state/view'
export { useBarColors, type BarColorsState } from './view-state/colors'
export { useTimezone, useToday } from './session/today'
export {
  useMyPreferences,
  useNavigationPreferences,
  useUpdateMyPreferences,
  type NavigationPreferences,
} from './session/preferences'
export {
  boardItems,
  type BoardGroupItem,
  type BoardGroupLabel,
  type BoardInput,
  type BoardItem,
  type BoardSoldierItem,
} from './board/rows'
export { useBoard, type BoardConditions, type BoardModel } from './board/hooks'
export { boardLeaves, type BoardLeave } from './board/leaves'
export { boardDays, boardEntries, calendarWeeks, type BoardDay, type BoardEntry } from './board/views'
export {
  datesOfRange,
  dayRangeOf,
  movedLeaveValues,
  newLeaveDraft,
  sameDates,
  useTimelineEditing,
  type DayRange,
  type LeaveDates,
  type LeaveMove,
  type TimelineEditing,
} from './timeline/editing'
export { NewLeaveDraft } from './view-state/draft'
export {
  NEW_LEAVE_TYPE_VALUES,
  leaveTypeFormIssues,
  leaveTypeFormValues,
  leaveTypeGroupFormIssues,
  leaveTypeSections,
  liveGroups,
  orderedLeaveTypes,
  typesOfGroup,
  type LeaveTypeFormValues,
  type LeaveTypeSection,
} from './leaves/leaveTypes'
export { newLeaveCandidate, newLeaveIssues, newLeaveValues, type LeaveCandidate, type NewLeaveValues } from './leaves/forms'
export {
  duplicateLeaveIssues,
  leaveBatchIssues,
  newDuplicateValues,
  newLeaveBatchValues,
  type DuplicateLeaveValues,
  type LeaveBatchValues,
} from './leaves/batch'
export {
  useCreateLeave,
  useLeaveBatchCommands,
  useLeaveCreation,
  useLeaveTypeCommands,
  useLeaveTypeGroupCommands,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  useLeaveTypes,
  useLeaves,
} from './leaves/hooks'
export {
  editedLeaveCandidate,
  leaveDayCount,
  leaveEditIssues,
  leaveEditValues,
  type LeaveEditValues,
  type MyLeaves,
  type ThreadEntry,
} from './leaves/workflow'
export {
  useClosedLeaves,
  useEditLeave,
  useIsOwnComment,
  useLeave,
  useLeaveActions,
  useLeaveCommentCommands,
  useLeaveThread,
  useLeaveTransition,
  useMyLeaves,
  useMyLeavesAccess,
  usePendingRequests,
} from './leaves/workflowHooks'
export {
  dropZoneAt,
  moveCandidates,
  planUnitDrop,
  siblingsUnder,
  steppedOrder,
  unitTreeRows,
  type UnitDropPlan,
  type UnitDropZone,
  type UnitTreeRow,
} from './units/tree'
export { formFieldIssues, unitFormIssues, unitLevelFormIssues, type UnitFormValues } from './units/forms'
export {
  liveLevels,
  useUnitCommands,
  useUnitLevelCommands,
  useUnitLevelPermissions,
  useUnitLevels,
  useUnitPermissions,
  useUnits,
} from './units/hooks'
export {
  fullName,
  liveRanks,
  matchesName,
  openMembershipOf,
  soldierHistory,
  soldierRows,
  unitStateOn,
  type HistoryEntry,
  type HistoryUnit,
  type ReadsPlacements,
  type SoldierRow,
  type UnitState,
} from './roster/roster'
export {
  moveFormIssues,
  newSoldierIssues,
  nextSeniority,
  privateFormIssues,
  rankFormIssues,
  soldierFormIssues,
  type MoveFormValues,
  type NewSoldierValues,
  type PrivateFormValues,
  type RankFormValues,
  type SoldierFormValues,
} from './roster/forms'
export {
  definitionsOf,
  hasOptions,
  newPropertyDefinitionValues,
  newPropertyOption,
  optionsOf,
  propertyDefinitionFormIssues,
  propertyDefinitionFormValues,
  propertyFormValues,
  sameProperties,
  toStoredProperties,
  type PropertyDefinitionFormValues,
  type PropertyFieldValue,
  type PropertyFormValues,
  type WithProperties,
  type PropertyOptionFormValues,
} from './properties/properties'
export { usePropertyDefinitionCommands, usePropertyDefinitions, usePropertyPermissions } from './properties/hooks'
export {
  NEW_TAG_CATEGORY_VALUES,
  liveCategories,
  newTagValues,
  soldierTagGroups,
  tagCategoryFormIssues,
  tagCategoryFormValues,
  tagColorOf,
  tagFormIssues,
  tagFormValues,
  tagSections,
  tagsBySoldier,
  tagsOfCategory,
  toggledTags,
  type SoldierTagGroup,
  type TagCategoryFormValues,
  type TagChoice,
  type TagFormValues,
  type TagSection,
} from './tags/tags'
export {
  useCanSetTags,
  useSetSoldierTags,
  useSoldierTags,
  useTagCategories,
  useTagCategoryCommands,
  useTagCommands,
  useTagPermissions,
  useTags,
  type SetSoldierTagsRequest,
} from './tags/hooks'
export {
  EVERYONE,
  NEW_RULE_VALUES,
  liveRules,
  ruleFormIssues,
  ruleFormValues,
  rulePopulationFilter,
  rulePopulationOf,
  type RuleFormValues,
  type RulePopulation,
} from './rules/rules'
export { acknowledgedRuleIds, type HeatDay, type WindowConflict } from './rules/evaluation'
export {
  useAvailabilityRules,
  useDayViolations,
  useHeatRow,
  useLeaveRuleCheck,
  useRuleCommands,
  useRuleConflicts,
  useRulePermissions,
} from './rules/hooks'
export {
  useCommandRankCommands,
  useCommandRankPermissions,
  useCommandRanks,
  useMemberships,
  useRosterPermissions,
  useSoldierCommands,
  useSoldierPagePermissions,
  useSoldierPrivate,
  usePlacementReading,
  useSoldiers,
  useSoldiersWithArchived,
  useUnitsWithArchived,
} from './roster/hooks'
export {
  NEW_LINK_REQUEST_VALUES,
  linkRequestIssues,
  newSoldierFromRequestIssues,
  reviewFormError,
  type LinkRequestValues,
  type LinkReview,
  type NewSoldierFromRequestValues,
} from './accounts/forms'
export { candidateRows, type CandidateRow } from './accounts/review'
export {
  useCancelLinkRequest,
  useLinkCandidates,
  useLinkPlacements,
  useLinkReviewAccess,
  useLinkReviewCommands,
  usePendingLinkRequests,
  useRequestLink,
} from './accounts/hooks'
export {
  NEW_ROLE_VALUES,
  NEW_SCOPE_VALUES,
  PERMISSION_GRID,
  anchorFields,
  bindingFormIssues,
  bindingFormValues,
  grantDaysOf,
  grantFormIssues,
  grantStateAt,
  hasPermission,
  liveBindingsOf,
  liveRoles,
  newBindingValues,
  newGrantValues,
  permissionsOfRole,
  roleFormIssues,
  roleFormValues,
  scopeFormValues,
  sortedGrants,
  toggledPermission,
  type AnchorFields,
  type BindingFormValues,
  type GrantFormValues,
  type GrantState,
  type PermissionGridRow,
  type RoleFormValues,
  type ScopeFormValues,
} from './access/forms'
export {
  useAccessGrants,
  useBindingCommands,
  useGrantCommands,
  useGrantModuleAccess,
  useGrantPermissionHints,
  useGrantRows,
  type GrantRow,
  useRankBindings,
  useRevokeLink,
  useRevokeLinkHints,
  useRoleCommands,
  useRolePermissionHints,
  useRolePermissions,
  useRoles,
  useSetBaselineRole,
  useSoldierAccounts,
} from './access/hooks'
export { exportFileOf, readImportFile, type ImportFile, type ImportFileProblem } from './transfer/file'
export { readPickedFile, useExport, useImport, useTransferAccess } from './transfer/hooks'
export {
  deploymentFormIssues,
  deploymentFormValues,
  deploymentMemberValues,
  deploymentMembersIssues,
  isDeploymentActive,
  liveDeployments,
  newDeploymentValues,
  type DeploymentFormValues,
  type DeploymentMemberValues,
} from './deployments/deployments'
export { useDeploymentCommands, useDeploymentMembers, useDeploymentPermissions, useDeployments } from './deployments/hooks'
export {
  currentOverride,
  newSeniorityOverrideValues,
  overridesOf,
  seniorityOverrideIssues,
  type SeniorityOverrideFormValues,
} from './seniority/seniority'
export { useSeniorityOverrideCommands, useSeniorityOverrides, useSeniorityPermissions } from './seniority/hooks'
