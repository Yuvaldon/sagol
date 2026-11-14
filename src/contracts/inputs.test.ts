import { describe, expect, expectTypeOf, it } from 'vitest'
import { z } from 'zod'
import * as contracts from './index'
import {
  AppError,
  AuthMode,
  ChangeMembershipInput,
  CreateAvailabilityRuleInput,
  CreateLeaveInput,
  CreateRoleInput,
  CreateSoldierInput,
  DEVELOPMENT_ONLY_AUTH_MODES,
  ErrorCode,
  GrantAccessInput,
  IdentityProvider,
  ImportBatchInput,
  ImportCommand,
  ImportOperation,
  IssueCode,
  OrganizationExport,
  ReorderTagsInput,
  ReviewAccountLinkInput,
  SchemaIssue,
  Session,
  SetSoldierTagsInput,
  TABLE_SCHEMAS,
  UpdateLeaveInput,
  UpdateUnitInput,
  type DataRepositories,
  type TableName,
} from './index'

// Fixed sample ids, test data only.
const ID = {
  a: '0a1b2c3d-1111-4aaa-8aaa-000000000002',
  b: '0a1b2c3d-1111-4aaa-8aaa-000000000003',
  c: '0a1b2c3d-1111-4aaa-8aaa-000000000004',
  d: '0a1b2c3d-1111-4aaa-8aaa-000000000005',
}

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? []
}

function codes(result: { success: boolean; error?: { issues: { code: string }[] } }) {
  return result.error?.issues.map((issue) => issue.code) ?? []
}

// ------------------------------------------------------------- name drift

/**
 * Fields an input may carry besides the columns of its table: command fields (D-045).
 * Anything else must be a column name of the target table (D-038).
 */
const COMMAND_FIELDS = new Set([
  'expected_version',
  'changes',
  'acknowledged_rule_ids',
  'as_approved',
  'comment',
  'private',
  'membership',
  'permissions',
  'tag_ids',
  'items',
  'current_membership',
  'new_membership',
  'effective_date',
  'resolution',
  'copies',
  'leaves',
  'batch',
  'members',
  'transition',
  'account_id',
  'access_grant_id',
  'root_unit_id',
  'membership_id',
  'owner_role',
  'organization',
  'soldier',
  'leave_id',
  'seen_at',
])

type Target = { table: TableName; nested?: Record<string, TableName> }

/** The table each input writes, and the table of each nested object. */
const INPUT_TABLES: Record<string, Target> = {
  BootstrapOwnerInput: {
    table: 'organizations',
    nested: {
      organization: 'organizations',
      soldier: 'soldiers',
      owner_role: 'roles',
      rotation_group: 'leave_type_groups',
      rotation_type: 'leave_types',
    },
  },
  UpdateOrganizationInput: { table: 'organizations' },
  RequestAccountLinkInput: { table: 'account_link_requests' },
  CancelAccountLinkRequestInput: { table: 'account_link_requests' },
  ReviewAccountLinkInput: { table: 'account_link_requests' },
  RevokeAccountLinkInput: { table: 'soldier_accounts' },
  UpdateMyPreferencesInput: { table: 'soldier_preferences' },
  SubscribePushInput: { table: 'push_subscriptions' },
  UnsubscribePushInput: { table: 'push_subscriptions' },
  CreateUnitLevelInput: { table: 'unit_levels' },
  UpdateUnitLevelInput: { table: 'unit_levels' },
  ArchiveUnitLevelInput: { table: 'unit_levels' },
  RestoreUnitLevelInput: { table: 'unit_levels' },
  ReorderUnitLevelsInput: { table: 'unit_levels', nested: { items: 'unit_levels' } },
  CreateUnitInput: { table: 'units' },
  UpdateUnitInput: { table: 'units' },
  ArchiveUnitInput: { table: 'units' },
  RestoreUnitInput: { table: 'units' },
  ReorderUnitsInput: { table: 'units', nested: { items: 'units' } },
  MoveUnitInput: { table: 'units' },
  CreateCommandRankInput: { table: 'command_ranks' },
  UpdateCommandRankInput: { table: 'command_ranks' },
  ArchiveCommandRankInput: { table: 'command_ranks' },
  RestoreCommandRankInput: { table: 'command_ranks' },
  CreateSoldierInput: {
    table: 'soldiers',
    nested: { private: 'soldier_private', membership: 'unit_memberships' },
  },
  UpdateSoldierInput: { table: 'soldiers' },
  ArchiveSoldierInput: { table: 'soldiers' },
  RestoreSoldierInput: { table: 'soldiers' },
  UpdateSoldierPrivateInput: { table: 'soldier_private' },
  SetSoldierTagsInput: { table: 'soldier_tags' },
  ChangeMembershipInput: {
    table: 'unit_memberships',
    nested: { current_membership: 'unit_memberships', new_membership: 'unit_memberships' },
  },
  CreateSeniorityOverrideInput: { table: 'seniority_overrides' },
  RevokeSeniorityOverrideInput: { table: 'seniority_overrides' },
  CreateRoleInput: { table: 'roles' },
  UpdateRoleInput: { table: 'roles' },
  ArchiveRoleInput: { table: 'roles' },
  CreateRankRoleBindingInput: { table: 'rank_role_bindings' },
  UpdateRankRoleBindingInput: { table: 'rank_role_bindings' },
  ArchiveRankRoleBindingInput: { table: 'rank_role_bindings' },
  GrantAccessInput: { table: 'access_grants' },
  RevokeAccessInput: { table: 'access_grants' },
  CreateTagCategoryInput: { table: 'tag_categories' },
  UpdateTagCategoryInput: { table: 'tag_categories' },
  ArchiveTagCategoryInput: { table: 'tag_categories' },
  RestoreTagCategoryInput: { table: 'tag_categories' },
  ReorderTagCategoriesInput: { table: 'tag_categories', nested: { items: 'tag_categories' } },
  CreateTagInput: { table: 'tags' },
  UpdateTagInput: { table: 'tags' },
  ArchiveTagInput: { table: 'tags' },
  RestoreTagInput: { table: 'tags' },
  ReorderTagsInput: { table: 'tags', nested: { items: 'tags' } },
  CreateLeaveTypeGroupInput: { table: 'leave_type_groups' },
  UpdateLeaveTypeGroupInput: { table: 'leave_type_groups' },
  ArchiveLeaveTypeGroupInput: { table: 'leave_type_groups' },
  RestoreLeaveTypeGroupInput: { table: 'leave_type_groups' },
  ReorderLeaveTypeGroupsInput: { table: 'leave_type_groups', nested: { items: 'leave_type_groups' } },
  CreateLeaveTypeInput: { table: 'leave_types' },
  UpdateLeaveTypeInput: { table: 'leave_types' },
  ArchiveLeaveTypeInput: { table: 'leave_types' },
  RestoreLeaveTypeInput: { table: 'leave_types' },
  ReorderLeaveTypesInput: { table: 'leave_types', nested: { items: 'leave_types' } },
  CreateLeaveInput: { table: 'leaves', nested: { comment: 'leave_comments' } },
  CreateLeaveBatchInput: { table: 'leaves', nested: { batch: 'leave_batches', leaves: 'leaves' } },
  CreateLeavesInput: { table: 'leaves', nested: { leaves: 'leaves' } },
  DuplicateLeaveInput: { table: 'leaves', nested: { copies: 'leaves' } },
  UpdateLeaveInput: { table: 'leaves' },
  TransitionLeaveInput: { table: 'leaves', nested: { comment: 'leave_comments' } },
  AddLeaveCommentInput: { table: 'leave_comments' },
  EditLeaveCommentInput: { table: 'leave_comments' },
  ArchiveLeaveCommentInput: { table: 'leave_comments' },
  CreateDeploymentInput: { table: 'deployments' },
  UpdateDeploymentInput: { table: 'deployments' },
  ArchiveDeploymentInput: { table: 'deployments' },
  CloseDeploymentInput: { table: 'deployments' },
  ReopenDeploymentInput: { table: 'deployments' },
  SetDeploymentMembersInput: { table: 'deployment_members', nested: { members: 'deployment_members' } },
  CreateAvailabilityRuleInput: { table: 'availability_rules' },
  UpdateAvailabilityRuleInput: { table: 'availability_rules' },
  ArchiveAvailabilityRuleInput: { table: 'availability_rules' },
  RestoreAvailabilityRuleInput: { table: 'availability_rules' },
  CreatePropertyDefinitionInput: { table: 'property_definitions' },
  UpdatePropertyDefinitionInput: { table: 'property_definitions' },
  ArchivePropertyDefinitionInput: { table: 'property_definitions' },
  RestorePropertyDefinitionInput: { table: 'property_definitions' },
  ReorderPropertyDefinitionsInput: {
    table: 'property_definitions',
    nested: { items: 'property_definitions' },
  },
  ConfirmDayReportInput: { table: 'report_confirmations' },
}

/** Inputs that wrap other inputs instead of writing a table themselves. */
const WRAPPER_INPUTS = new Set(['ImportBatchInput'])

function objectOf(schema: z.ZodType): z.ZodObject | null {
  if (schema instanceof z.ZodObject) return schema
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return objectOf(schema.unwrap() as z.ZodType)
  }
  if (schema instanceof z.ZodArray) return objectOf(schema.element as z.ZodType)
  return null
}

function columnsOf(table: TableName): string[] {
  return Object.keys(TABLE_SCHEMAS[table].shape)
}

/** Field paths of `schema` that are neither columns of `table` nor command fields. */
function strayFields(schema: z.ZodType, target: Target, prefix: string): string[] {
  const object = objectOf(schema)
  if (object === null) return [`${prefix} is not an object`]
  const columns = columnsOf(target.table)
  return Object.entries(object.shape).flatMap(([key, field]) => {
    const nestedTable = target.nested?.[key]
    if (nestedTable !== undefined) {
      return strayFields(field as z.ZodType, { table: nestedTable }, `${prefix}.${key}`)
    }
    if (key === 'changes') {
      return strayFields(field as z.ZodType, { table: target.table }, `${prefix}.changes`)
    }
    if (columns.includes(key) || COMMAND_FIELDS.has(key)) return []
    return [`${prefix}.${key} (${target.table})`]
  })
}

const exportedInputs: [string, z.ZodType][] = Object.entries(contracts).flatMap(
  ([name, value]: [string, unknown]): [string, z.ZodType][] =>
    name.endsWith('Input') && value instanceof z.ZodType ? [[name, value]] : [],
)

describe('input field names (D-038, D-045)', () => {
  it('maps every exported input to its table', () => {
    const names = exportedInputs.map(([name]) => name).filter((name) => !WRAPPER_INPUTS.has(name))
    expect(names.sort()).toEqual(Object.keys(INPUT_TABLES).sort())
  })

  it('uses only column names of the target table, plus command fields', () => {
    const stray = exportedInputs
      .filter(([name]) => !WRAPPER_INPUTS.has(name))
      .flatMap(([name, schema]) => {
        const target = INPUT_TABLES[name]
        return target === undefined ? [name] : strayFields(schema, target, name)
      })
    expect(stray).toEqual([])
  })

  it('never takes organization, actor or audit columns (D-008, D-045)', () => {
    const forbidden = ['organization_id', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version', 'archived_at']
    const leaks = exportedInputs.flatMap(([name, schema]) => {
      const object = objectOf(schema)
      const keys = object === null ? [] : Object.keys(object.shape)
      return keys.filter((key) => forbidden.includes(key)).map((key) => `${name}.${key}`)
    })
    expect(leaks).toEqual([])
  })
})

// --------------------------------------------------------------- strictness

const leave = {
  id: ID.a,
  soldier_id: ID.b,
  leave_type_id: ID.c,
  deployment_id: ID.d,
  start_date: '2026-11-10',
  end_date: '2026-11-12',
  availability_effect_override: null,
  reason: null,
  properties: {},
  as_approved: false,
  acknowledged_rule_ids: [],
  comment: null,
}

describe('strict inputs', () => {
  it('accepts a complete create input', () => {
    expect(CreateLeaveInput.safeParse(leave).success).toBe(true)
  })

  it('rejects columns the caller may not set', () => {
    expect(codes(CreateLeaveInput.safeParse({ ...leave, organization_id: ID.d }))).toEqual([
      'unrecognized_keys',
    ])
    expect(codes(CreateLeaveInput.safeParse({ ...leave, status: 'approved' }))).toEqual([
      'unrecognized_keys',
    ])
  })

  it('keeps workflow columns out of updates', () => {
    const update = { id: ID.a, expected_version: 1, acknowledged_rule_ids: [] }
    expect(UpdateLeaveInput.safeParse({ ...update, changes: { reason: 'x' } }).success).toBe(true)
    expect(UpdateLeaveInput.safeParse({ ...update, changes: { status: 'approved' } }).success).toBe(
      false,
    )
    expect(
      UpdateUnitInput.safeParse({ id: ID.a, expected_version: 1, changes: { parent_id: ID.b } })
        .success,
    ).toBe(false)
  })

  it('rejects an update that changes nothing', () => {
    const base = { id: ID.a, expected_version: 1 }
    expect(messages(UpdateUnitInput.safeParse({ ...base, changes: {} }))).toEqual([
      IssueCode.enum.no_changes,
    ])
    expect(messages(UpdateUnitInput.safeParse({ ...base, changes: { name: undefined } }))).toEqual([
      IssueCode.enum.no_changes,
    ])
    expect(UpdateUnitInput.safeParse({ ...base, changes: { code: null } }).success).toBe(true)
  })

  it('requires a positive expected version', () => {
    const changes = { name: 'x' }
    expect(UpdateUnitInput.safeParse({ id: ID.a, expected_version: 0, changes }).success).toBe(false)
  })
})

// --------------------------------------------------------------- row checks

describe('row checks on inputs', () => {
  it('rejects inverted leave dates on create and update', () => {
    const inverted = { start_date: '2026-11-12', end_date: '2026-11-10' }
    expect(messages(CreateLeaveInput.safeParse({ ...leave, ...inverted }))).toEqual([
      SchemaIssue.enum.range_inverted,
    ])
    const update = { id: ID.a, expected_version: 2, acknowledged_rule_ids: [], changes: inverted }
    expect(messages(UpdateLeaveInput.safeParse(update))).toEqual([SchemaIssue.enum.range_inverted])
    expect(UpdateLeaveInput.safeParse({ ...update, changes: { end_date: inverted.end_date } }).success).toBe(true)
  })

  it('checks grant scope arguments; a NULL start means now', () => {
    const grant = {
      id: ID.a,
      grantee_soldier_id: ID.b,
      role_id: ID.c,
      anchor_type: 'unit',
      anchor_unit_id: ID.d,
      anchor_soldier_id: null,
      anchor_level_id: null,
      anchor_steps: null,
      include_descendants: true,
      subject_rank_constraint: 'junior',
      valid_from: null,
      valid_to: null,
      reason: null,
    }
    expect(GrantAccessInput.safeParse(grant).success).toBe(true)
    expect(messages(GrantAccessInput.safeParse({ ...grant, anchor_unit_id: null }))).toEqual([
      SchemaIssue.enum.scope_anchor_arguments,
    ])
  })

  it('checks availability-rule thresholds', () => {
    const rule = {
      id: ID.a,
      name: 'rule',
      description: null,
      is_enabled: true,
      priority: 0,
      enforcement: 'hard',
      scope_unit_id: null,
      scope_mode: 'unit_tree',
      scope_level_id: null,
      population_filter: {},
      group_by: 'none',
      group_tag_category_id: null,
      metric: 'percent',
      min_value: 20,
      max_value: null,
      effective_from: null,
      effective_to: null,
      deployment_id: null,
      count_pending_as_unavailable: false,
    }
    expect(CreateAvailabilityRuleInput.safeParse(rule).success).toBe(true)
    expect(messages(CreateAvailabilityRuleInput.safeParse({ ...rule, min_value: null }))).toEqual([
      SchemaIssue.enum.rule_threshold_missing,
    ])
  })

  it('rejects repeated items in sets and orders', () => {
    const item = { id: ID.a, expected_version: 1 }
    expect(messages(ReorderTagsInput.safeParse({ items: [item, item] }))).toEqual([
      IssueCode.enum.duplicate_item,
    ])
    expect(ReorderTagsInput.safeParse({ items: [] }).success).toBe(false)
    const tags = { soldier_id: ID.a, expected_version: 1, deployment_id: null, tag_ids: [ID.b, ID.b] }
    expect(messages(SetSoldierTagsInput.safeParse(tags))).toEqual([IssueCode.enum.duplicate_item])
  })

  it('accepts only valid, distinct permission pairs on roles (D-040)', () => {
    const role = { id: ID.a, name: 'role', description: null, color_key: null }
    const approve = { resource: 'leaves', action: 'approve' }
    expect(CreateRoleInput.safeParse({ ...role, permissions: [approve] }).success).toBe(true)
    expect(
      CreateRoleInput.safeParse({ ...role, permissions: [{ resource: 'tags', action: 'approve' }] })
        .success,
    ).toBe(false)
    expect(messages(CreateRoleInput.safeParse({ ...role, permissions: [approve, approve] }))).toEqual(
      [IssueCode.enum.duplicate_item],
    )
  })

  it('needs a current or a new membership', () => {
    const change = { soldier_id: ID.a, effective_date: '2026-11-04' }
    const none = { ...change, current_membership: null, new_membership: null }
    expect(messages(ChangeMembershipInput.safeParse(none))).toEqual([IssueCode.enum.required])
    const first = { ...none, new_membership: { id: ID.b, unit_id: ID.c } }
    expect(ChangeMembershipInput.safeParse(first).success).toBe(true)
  })

  it('creates a soldier from names alone (D-030)', () => {
    const soldier = {
      id: ID.a,
      first_name: 'a',
      last_name: 'b',
      nickname: null,
      command_rank_id: null,
      status: 'active',
      properties: {},
      private: null,
      membership: null,
    }
    expect(CreateSoldierInput.safeParse(soldier).success).toBe(true)
  })

  it('takes one resolution per link review', () => {
    expect(ReviewAccountLinkInput.safeParse({ id: ID.a, resolution: { kind: 'reject' } }).success).toBe(
      true,
    )
    expect(
      ReviewAccountLinkInput.safeParse({ id: ID.a, resolution: { kind: 'link', account_id: ID.b } })
        .success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------- import / export

describe('import and export (D-050)', () => {
  it('runs import operations through command inputs only', () => {
    const level = { id: ID.a, name: 'company', sort_order: 0 }
    const operation = { command: 'create_unit_level', input: level }
    expect(ImportBatchInput.safeParse({ dry_run: true, operations: [operation] }).success).toBe(true)
    const unknown = { command: 'raw_insert', input: level }
    expect(ImportBatchInput.safeParse({ dry_run: true, operations: [unknown] }).success).toBe(false)
    expect(ImportCommand.options).toHaveLength(ImportOperation.options.length)
  })

  it('exports every table but the devices, which belong to the browsers (D-351)', () => {
    expect(Object.keys(OrganizationExport.shape.tables.shape).sort()).toEqual(
      Object.keys(TABLE_SCHEMAS)
        .filter((table) => table !== 'push_subscriptions')
        .sort(),
    )
  })
})

// ------------------------------------------------------------- vocabularies

describe('error model (D-046)', () => {
  it('includes every row-check code in the issue vocabulary', () => {
    for (const code of SchemaIssue.options) expect(IssueCode.options).toContain(code)
  })

  it('gives every error code a payload shape', () => {
    const issue = { path: ['end_date'], code: 'range_inverted' }
    const violation = {
      rule_id: ID.a,
      enforcement: 'soft',
      scope_unit_id: null,
      group: { group_by: 'tag', tag_id: ID.b },
      bound: 'min',
      days: [{ date: '2026-11-10', required: 2, actual: 1, unavailable: [{ id: ID.c, first_name: 'דנה', last_name: 'לוי' }] }],
    }
    const samples: Record<ErrorCode, unknown> = {
      validation_failed: { code: 'validation_failed', issues: [issue] },
      rule_violation: { code: 'rule_violation', violations: [violation] },
      rule_acknowledgment_required: { code: 'rule_acknowledgment_required', violations: [violation] },
      unauthenticated: { code: 'unauthenticated' },
      account_not_linked: { code: 'account_not_linked' },
      forbidden: { code: 'forbidden' },
      not_found: { code: 'not_found' },
      stale_version: { code: 'stale_version' },
      bootstrap_not_allowed: { code: 'bootstrap_not_allowed' },
      unavailable: { code: 'unavailable' },
      internal: { code: 'internal' },
    }
    expect(Object.keys(samples).sort()).toEqual([...ErrorCode.options].sort())
    for (const sample of Object.values(samples)) expect(AppError.safeParse(sample).success).toBe(true)
  })

  it('requires the payload of rich errors', () => {
    expect(AppError.safeParse({ code: 'validation_failed', issues: [] }).success).toBe(false)
    expect(AppError.safeParse({ code: 'rule_violation' }).success).toBe(false)
  })
})

describe('auth and session (D-048)', () => {
  it('shares one provider vocabulary between auth mode and accounts', () => {
    expect(AuthMode.options).toEqual(IdentityProvider.options)
    for (const mode of DEVELOPMENT_ONLY_AUTH_MODES) expect(AuthMode.options).toContain(mode)
  })

  it('parses a linked session', () => {
    const identity = {
      auth_user_id: ID.a,
      provider: 'local',
      email: 'dev@example.com',
      email_verified: true,
      display_name: null,
    }
    const linked = { status: 'linked', identity, soldier_id: ID.b, organization_id: ID.c }
    expect(Session.safeParse(linked).success).toBe(true)
    expect(Session.safeParse({ status: 'linked', identity }).success).toBe(false)
  })

  it('has one repository per table but the push subscriptions, which nothing reads back (D-351)', () => {
    expectTypeOf<keyof DataRepositories>().toEqualTypeOf<Exclude<TableName, 'push_subscriptions'>>()
  })
})
