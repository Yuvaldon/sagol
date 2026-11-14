// Public entry point of the CONTRACTS layer.
// Zod schemas and their inferred types (D-020): entities, inputs, enums,
// filters, permission vocabulary, repository/command/auth interfaces, error
// codes. No behavior. Imports `zod` only. Field names are schema.sql column
// names (D-038).

export * from './common/ids'
export {
  CalendarDate,
  ColorKey,
  Email,
  IconKey,
  JsonValue,
  Timestamp,
} from './common/scalars'
export { SchemaIssue } from './common/issues'
export * from './enums'
export * from './permissions'
export * from './settings'
export * from './filters'

export { Organization } from './entities/organization'
export { PropertyValues, Unit, UnitLevel } from './entities/hierarchy'
export {
  CommandRank,
  SeniorityOverride,
  Soldier,
  SoldierPrivate,
  UnitMembership,
} from './entities/soldiers'
export {
  AccountLinkRequest,
  PUSH_SERVICE_HOSTS,
  PushEndpoint,
  PushSubscriptionRecord,
  SoldierAccount,
  SoldierPreferencesRecord,
} from './entities/accounts'
export { PushPayload } from './notifications'
export { AccessGrant, RankRoleBinding, Role, RolePermission } from './entities/permissions'
export { SoldierTag, Tag, TagCategory } from './entities/tags'
export {
  FieldChange,
  Leave,
  LeaveBatch,
  LeaveComment,
  LeaveEvent,
  LeaveType,
  LeaveTypeGroup,
} from './entities/leaves'
export { Deployment, DeploymentMember } from './entities/deployments'
export { AvailabilityRule } from './entities/rules'
export { PropertyDefinition } from './entities/properties'
export { ReportConfirmation } from './entities/reports'

export { TABLE_SCHEMAS, type TableName, type TableRow } from './tables'

export type { AsyncResult, Result, Unsubscribe } from './common/result'
export * from './errors'
export * from './auth'
export * from './inputs'
export * from './repositories'
export * from './commands'
