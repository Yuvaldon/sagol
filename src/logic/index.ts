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
export { WorkspaceSearch, usePanel, type PanelState, type PanelTarget } from './view-state/panel'
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
