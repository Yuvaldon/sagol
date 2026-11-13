import { describe, expect, it } from 'vitest'
import {
  AccessGrant,
  AvailabilityRule,
  Deployment,
  FilterExpression,
  Leave,
  OrganizationSettings,
  PERMISSION_ACTIONS_BY_RESOURCE,
  Permission,
  PermissionAction,
  PermissionCheck,
  PermissionResource,
  PolicyTarget,
  RankRoleBinding,
  RolePermission,
  SchemaIssue,
  SoldierPreferences,
  StrictSoldierPreferences,
  LeaveEventQuery,
  DASHBOARD_MAX_MODULES,
  DASHBOARD_METRIC_IDS,
  DASHBOARD_MODULE_IDS,
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
  deployment_id: ID.a,
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
    expect(SoldierPreferences.parse({})).toEqual({
      create_leaves_as_approved: false,
      appearance: 'light',
      dashboard: null,
    })
  })

  it('reads a row stored before the appearance with its default (D-181)', () => {
    expect(SoldierPreferences.parse({ create_leaves_as_approved: true })).toEqual({
      create_leaves_as_approved: true,
      appearance: 'light',
      dashboard: null,
    })
  })

  it('reads the appearance, and refuses one that is not a choice (D-181)', () => {
    expect(SoldierPreferences.parse({ appearance: 'dark' }).appearance).toBe('dark')
    expect(SoldierPreferences.safeParse({ appearance: 'sepia' }).success).toBe(false)
  })

  it('reads a row that still holds dropped keys, without them (D-221, D-310)', () => {
    expect(SoldierPreferences.parse({ pinned_modules: ['tags', 'roles'], rules_row_placement: 'above', appearance: 'dark' })).toEqual({
      create_leaves_as_approved: false,
      appearance: 'dark',
      dashboard: null,
    })
  })
})

describe('the stored dashboard (D-349, D-358)', () => {
  const custom = (modules: unknown[]) => ({ dashboard: { kind: 'custom', modules } })

  it('reads a template and a custom list', () => {
    expect(SoldierPreferences.parse({ dashboard: { kind: 'template', template: 'control' } }).dashboard).toEqual({
      kind: 'template',
      template: 'control',
    })
    expect(SoldierPreferences.parse(custom([{ module: 'heat_map' }, { module: 'stat', metric: 'home_today' }])).dashboard).toEqual({
      kind: 'custom',
      modules: [{ module: 'heat_map' }, { module: 'stat', metric: 'home_today' }],
    })
  })

  it('drops unknown and repeated modules on read, the first kept', () => {
    const read = SoldierPreferences.parse(
      custom([
        { module: 'stat', metric: 'present_today' },
        { module: 'gone' },
        { module: 'stat', metric: 'retired_metric' },
        { module: 'heat_map' },
        { module: 'stat', metric: 'present_today' },
        { module: 'heat_map' },
        { module: 'stat', metric: 'home_today' },
      ]),
    )
    expect(read.dashboard).toEqual({
      kind: 'custom',
      modules: [{ module: 'stat', metric: 'present_today' }, { module: 'heat_map' }, { module: 'stat', metric: 'home_today' }],
    })
  })

  it('reads the whole catalogue once, however often it is stored', () => {
    const many = DASHBOARD_METRIC_IDS.map((metric) => ({ module: 'stat', metric }))
    const others = DASHBOARD_MODULE_IDS.filter((id) => id !== 'stat').map((module) => ({ module }))
    const read = SoldierPreferences.parse(custom([...many, ...others, ...others]))
    expect(read.dashboard?.kind === 'custom' && read.dashboard.modules).toHaveLength(many.length + others.length)
    expect(many.length + others.length).toBeLessThanOrEqual(DASHBOARD_MAX_MODULES)
  })

  it('reads a layout that no longer parses as the default, keeping the rest', () => {
    expect(SoldierPreferences.parse({ appearance: 'dark', dashboard: { kind: 'template', template: 'retired' } })).toEqual({
      create_leaves_as_approved: false,
      appearance: 'dark',
      dashboard: null,
    })
  })

  it('refuses unknown and repeated modules on write, takes the whole catalogue', () => {
    expect(StrictSoldierPreferences.safeParse(custom([{ module: 'heat_map' }])).success).toBe(true)
    expect(StrictSoldierPreferences.safeParse(custom([{ module: 'gone' }])).success).toBe(false)
    expect(StrictSoldierPreferences.safeParse(custom([{ module: 'stat' }])).success).toBe(false)
    expect(StrictSoldierPreferences.safeParse(custom([{ module: 'heat_map', metric: 'home_today' }])).success).toBe(false)
    expect(StrictSoldierPreferences.safeParse(custom([{ module: 'upcoming' }, { module: 'upcoming' }])).success).toBe(false)
    const stats = DASHBOARD_METRIC_IDS.map((metric) => ({ module: 'stat', metric }))
    const others = DASHBOARD_MODULE_IDS.filter((id) => id !== 'stat').map((module) => ({ module }))
    expect(StrictSoldierPreferences.safeParse(custom([...stats, ...others])).success).toBe(true)
    expect(StrictSoldierPreferences.safeParse(custom([...stats, ...others, { module: 'stat', metric: 'x' }])).success).toBe(false)
    expect(StrictSoldierPreferences.safeParse({ dashboard: { kind: 'template', template: 'retired' } }).success).toBe(false)
  })
})

describe('leave event queries (D-358)', () => {
  it('takes a thread or a span, never both', () => {
    expect(LeaveEventQuery.safeParse({ leave_id: ID.a }).success).toBe(true)
    expect(LeaveEventQuery.safeParse({ deployment_id: ID.a, soldier_ids: [ID.b] }).success).toBe(true)
    expect(LeaveEventQuery.safeParse({ leave_id: ID.a, deployment_id: ID.a, soldier_ids: [] }).success).toBe(false)
    expect(LeaveEventQuery.safeParse({ deployment_id: ID.a }).success).toBe(false)
  })
})

describe('permission checks (D-053, D-091)', () => {
  it('accepts a valid pair against each target kind', () => {
    const permission = { resource: 'units', action: 'update' }
    for (const target of [{ kind: 'organization' }, { kind: 'unit', unit_id: ID.a }, { kind: 'soldier', soldier_id: ID.b }]) {
      expect(PermissionCheck.safeParse({ permission, target }).success).toBe(true)
    }
  })

  it('rejects a pair outside D-040, and a target without its id', () => {
    const target = { kind: 'organization' }
    expect(PermissionCheck.safeParse({ permission: { resource: 'units', action: 'approve' }, target }).success).toBe(false)
    expect(PolicyTarget.safeParse({ kind: 'unit' }).success).toBe(false)
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

  it('holds a close with its actor and an end date (D-258)', () => {
    const open = { ...audit, id: ID.a, organization_id: ID.org, name: 'סבב', unit_id: ID.b, start_date: '2026-11-01', report_owner_id: null }
    const closed = { ...open, end_date: '2026-11-10', closed_at: AT, closed_by: ID.c }
    expect(Deployment.safeParse({ ...open, end_date: null, closed_at: null, closed_by: null }).success).toBe(true)
    expect(Deployment.safeParse(closed).success).toBe(true)
    for (const change of [{ closed_by: null }, { closed_at: null }, { end_date: null }]) {
      expect(issues(Deployment.safeParse({ ...closed, ...change }))).toEqual([SchemaIssue.enum.close_incomplete])
    }
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
