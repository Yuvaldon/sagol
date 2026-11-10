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
export { filterUnitOf, unitFilterOf, useViewFilter, type FilterUnit, type ViewFilterState } from './view-state/filter'
export { useActiveView, type ActiveViewState } from './view-state/view'
export { useBarColors, type BarColorsState } from './view-state/colors'
export { useToday } from './session/today'
export { useMyPreferences, useUpdateMyPreferences } from './session/preferences'
export {
  timelineItems,
  type TimelineGroupItem,
  type TimelineGroupLabel,
  type TimelineInput,
  type TimelineItem,
  type TimelineSoldierItem,
} from './timeline/rows'
export { useTimeline, type TimelineModel } from './timeline/hooks'
export { timelineLeaves, type TimelineLeave } from './timeline/leaves'
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
} from './leaves/types'
export { newLeaveIssues, newLeaveValues, type NewLeaveValues } from './leaves/forms'
export {
  useCreateLeave,
  useLeaveCreation,
  useLeaveTypeCommands,
  useLeaveTypeGroupCommands,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  useLeaveTypes,
  useLeaves,
} from './leaves/hooks'
export {
  leaveDayCount,
  leaveEditIssues,
  leaveEditValues,
  type LeaveEditValues,
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
