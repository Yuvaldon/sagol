import { describe, expect, it } from 'vitest'
import {
  AccessGrant,
  AvailabilityRule,
  FilterExpression,
  Leave,
  OrganizationSettings,
  PERMISSION_ACTIONS_BY_RESOURCE,
  Permission,
  PermissionAction,
  PermissionResource,
  RankRoleBinding,
  RolePermission,
  SchemaIssue,
  SoldierPreferences,
} from './index'

// Fixed sample ids and timestamps, test data only.
const ID = {
  org: '0a1b2c3d-1111-4aaa-8aaa-000000000001',
  a: '0a1b2c3d-1111-4aaa-8aaa-000000000002',
  b: '0a1b2c3d-1111-4aaa-8aaa-000000000003',
  c: '0a1b2c3d-1111-4aaa-8aaa-000000000004',
}
const AT = '2026-11-04T08:00:00Z'

const audit = {
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}

const binding = {
  id: ID.a,
  organization_id: ID.org,
  command_rank_id: ID.b,
  role_id: ID.c,
  anchor_type: 'home_ancestor_steps',
  anchor_unit_id: null,
  anchor_soldier_id: null,
  anchor_level_id: null,
  anchor_steps: 1,
  include_descendants: true,
  subject_rank_constraint: 'junior',
  ...audit,
}

const leave = {
  id: ID.a,
  organization_id: ID.org,
  soldier_id: ID.b,
  leave_type_id: ID.c,
  batch_id: null,
  start_date: '2026-11-10',
  end_date: '2026-11-12',
  status: 'pending',
  availability_effect_override: null,
  reason: null,
  reviewed_by: null,
  reviewed_at: null,
  properties: {},
  created_at: AT,
  created_by: ID.b,
  updated_at: AT,
  updated_by: ID.b,
  version: 1,
}

const rule = {
  id: ID.a,
  organization_id: ID.org,
  name: 'rule',
  description: null,
  is_enabled: true,
  priority: 0,
  enforcement: 'soft',
  scope_unit_id: null,
  scope_mode: 'unit_tree',
  scope_level_id: null,
  population_filter: {},
  group_by: 'tag',
  group_tag_category_id: null,
  metric: 'count',
  min_value: 2,
  max_value: null,
  effective_from: null,
  effective_to: null,
  deployment_id: null,
  count_pending_as_unavailable: false,
  ...audit,
}

function issues(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? []
}

describe('settings defaults (D-041)', () => {
  it('fills organization settings from the column default', () => {
    expect(OrganizationSettings.parse({})).toEqual({ reschedule_policy: 'keep_if_can_approve' })
  })

  it('fills soldier preferences from the column default', () => {
    expect(SoldierPreferences.parse({})).toEqual({ create_leaves_as_approved: false })
  })
})

describe('permission vocabulary (D-040)', () => {
  it('lists actions for every resource, all from the action vocabulary', () => {
    expect(Object.keys(PERMISSION_ACTIONS_BY_RESOURCE).sort()).toEqual(
      [...PermissionResource.options].sort(),
    )
    for (const actions of Object.values(PERMISSION_ACTIONS_BY_RESOURCE)) {
      for (const action of actions) expect(PermissionAction.options).toContain(action)
    }
  })

  it('accepts valid pairs and rejects others', () => {
    expect(Permission.safeParse({ resource: 'leaves', action: 'approve' }).success).toBe(true)
    expect(Permission.safeParse({ resource: 'tags', action: 'approve' }).success).toBe(false)
    expect(Permission.safeParse({ resource: 'data_transfer', action: 'view' }).success).toBe(false)
  })

  it('rejects an invalid pair in role_permissions', () => {
    const row = { role_id: ID.a, organization_id: ID.org, resource: 'accounts', action: 'delete' }
    expect(issues(RolePermission.safeParse(row))).toEqual([SchemaIssue.enum.invalid_permission_pair])
    expect(RolePermission.safeParse({ ...row, action: 'approve' }).success).toBe(true)
  })
})

describe('scope anchors (D-028)', () => {
  it('accepts a relative anchor with its argument', () => {
    expect(RankRoleBinding.safeParse(binding).success).toBe(true)
  })

  it('rejects an anchor without its argument or with a foreign one', () => {
    expect(issues(RankRoleBinding.safeParse({ ...binding, anchor_steps: null }))).toEqual([
      SchemaIssue.enum.scope_anchor_arguments,
    ])
    expect(issues(RankRoleBinding.safeParse({ ...binding, anchor_unit_id: ID.a }))).toEqual([
      SchemaIssue.enum.scope_anchor_arguments,
    ])
  })

  it('rejects include_descendants on a non-unit anchor', () => {
    const grant = {
      ...binding,
      anchor_type: 'organization',
      anchor_steps: null,
      grantee_soldier_id: ID.b,
      valid_from: AT,
      valid_to: null,
      reason: null,
      granted_by: null,
      granted_at: AT,
      revoked_at: null,
      revoked_by: null,
    }
    expect(issues(AccessGrant.safeParse(grant))).toEqual([
      SchemaIssue.enum.include_descendants_not_allowed,
    ])
    expect(AccessGrant.safeParse({ ...grant, include_descendants: false }).success).toBe(true)
  })

  it('rejects anchor_steps below 1', () => {
    expect(RankRoleBinding.safeParse({ ...binding, anchor_steps: 0 }).success).toBe(false)
  })
})

describe('row checks', () => {
  it('accepts a one-day leave and rejects an inverted one', () => {
    expect(Leave.safeParse({ ...leave, end_date: leave.start_date }).success).toBe(true)
    expect(issues(Leave.safeParse({ ...leave, end_date: '2026-11-09' }))).toEqual([
      SchemaIssue.enum.range_inverted,
    ])
  })

  it('rejects malformed dates and timestamps', () => {
    expect(Leave.safeParse({ ...leave, start_date: '2026-13-01' }).success).toBe(false)
    expect(Leave.safeParse({ ...leave, created_at: '2026-11-04 08:00' }).success).toBe(false)
    expect(Leave.safeParse({ ...leave, created_at: '2026-11-04T08:00:00+02:00' }).success).toBe(true)
  })

  it('accepts a global per-tag rule with an empty population', () => {
    expect(AvailabilityRule.safeParse(rule).success).toBe(true)
  })

  it('reports each broken availability-rule check', () => {
    const cases: [Record<string, unknown>, SchemaIssue][] = [
      [{ scope_mode: 'each_descendant_at_level' }, SchemaIssue.enum.rule_scope_level_mismatch],
      [{ group_by: 'none', group_tag_category_id: ID.b }, SchemaIssue.enum.rule_group_category_mismatch],
      [{ min_value: null }, SchemaIssue.enum.rule_threshold_missing],
      [{ max_value: 1 }, SchemaIssue.enum.rule_threshold_inverted],
      [{ metric: 'percent', min_value: 120 }, SchemaIssue.enum.rule_percent_out_of_range],
      [{ effective_from: '2026-12-01', effective_to: '2026-11-01' }, SchemaIssue.enum.range_inverted],
    ]
    for (const [change, expected] of cases) {
      expect(issues(AvailabilityRule.safeParse({ ...rule, ...change }))).toEqual([expected])
    }
  })
})

describe('FilterExpression', () => {
  it('treats {} as every soldier', () => {
    expect(FilterExpression.parse({})).toEqual({})
  })

  it('accepts a nested expression', () => {
    const expression = {
      where: {
        kind: 'and',
        nodes: [
          { kind: 'tag', match: 'any', tag_ids: [ID.a, ID.b] },
          { kind: 'not', node: { kind: 'seniority', min: 3, max: null } },
          { kind: 'unit', unit_ids: [ID.c], include_descendants: true },
        ],
      },
    }
    expect(FilterExpression.parse(expression)).toEqual(expression)
  })

  it('rejects empty groups, empty id lists and unbounded seniority', () => {
    const invalid = [
      { kind: 'or', nodes: [] },
      { kind: 'tag', match: 'all', tag_ids: [] },
      { kind: 'seniority', min: null, max: null },
      { kind: 'seniority', min: 5, max: 2 },
      { kind: 'unknown' },
    ]
    for (const where of invalid) {
      expect(FilterExpression.safeParse({ where }).success).toBe(false)
    }
  })
})
