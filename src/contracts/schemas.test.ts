import { describe, expect, it } from 'vitest'
import {
  AccessGrant,
  AvailabilityRule,
  Deployment,
  FilterExpression,
  IssueCode,
  Leave,
  OrganizationSettings,
  PERMISSION_ACTIONS_BY_RESOURCE,
  Permission,
  PushEndpoint,
  PermissionAction,
  PermissionCheck,
  PermissionResource,
  PolicyTarget,
  RankRoleBinding,
  RolePermission,
  SAVED_VIEW_LIMITS,
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
      saved_views: [],
      start_view_id: null,
      updates_seen_at: null,
      notifications: { my_request: true, awaiting_me: true },
    })
  })

  it('reads a row stored before the appearance with its default (D-181)', () => {
    expect(SoldierPreferences.parse({ create_leaves_as_approved: true })).toEqual({
      create_leaves_as_approved: true,
      appearance: 'light',
      saved_views: [],
      start_view_id: null,
      updates_seen_at: null,
      notifications: { my_request: true, awaiting_me: true },
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
      saved_views: [],
      start_view_id: null,
      updates_seen_at: null,
      notifications: { my_request: true, awaiting_me: true },
    })
  })

  describe('saved views (D-384)', () => {
    const view = (id: string, name: string, query: Record<string, string> = { range: '"week"' }) => ({ id, name, query })

    it('reads views in order, with their start view', () => {
      const parsed = SoldierPreferences.parse({ saved_views: [view(ID.a, 'בוקר'), view(ID.b, 'נהגים')], start_view_id: ID.b })
      expect(parsed.saved_views.map((saved) => saved.name)).toEqual(['בוקר', 'נהגים'])
      expect(parsed.start_view_id).toBe(ID.b)
    })

    it('keeps at most twelve views', () => {
      const idOf = (index: number) => `0a1b2c3d-2222-4aaa-8aaa-${String(index).padStart(12, '0')}`
      const twelve = Array.from({ length: SAVED_VIEW_LIMITS.max }, (_, index) => view(idOf(index), `view ${String(index)}`))
      expect(SoldierPreferences.safeParse({ saved_views: twelve }).success).toBe(true)
      expect(SoldierPreferences.safeParse({ saved_views: [...twelve, view(idOf(SAVED_VIEW_LIMITS.max), 'one more')] }).success).toBe(false)
    })

    it('refuses an empty or a too long name', () => {
      expect(SoldierPreferences.safeParse({ saved_views: [view(ID.a, '  ')] }).success).toBe(false)
      expect(SoldierPreferences.safeParse({ saved_views: [view(ID.a, 'x'.repeat(SAVED_VIEW_LIMITS.nameMax + 1))] }).success).toBe(false)
    })

    it('refuses a second view of the same name', () => {
      const result = SoldierPreferences.safeParse({ saved_views: [view(ID.a, 'בוקר'), view(ID.b, ' בוקר ')] })
      expect(result.success).toBe(false)
      expect(result.error?.issues.map((issue) => [issue.message, issue.path])).toEqual([
        [IssueCode.enum.duplicate_item, ['saved_views', 1, 'name']],
      ])
    })

    it('drops a param it does not keep, and refuses a value past the limit', () => {
      const parsed = SoldierPreferences.parse({ saved_views: [view(ID.a, 'בוקר', { range: '"week"', from: '"2026-11-13"', panel: '"tags"' })] })
      expect(parsed.saved_views[0]?.query).toEqual({ range: '"week"' })
      const long = view(ID.a, 'בוקר', { filter: 'x'.repeat(SAVED_VIEW_LIMITS.valueMax + 1) })
      expect(SoldierPreferences.safeParse({ saved_views: [long] }).success).toBe(false)
    })

    it('reads a start view that is no longer saved as none', () => {
      expect(SoldierPreferences.parse({ saved_views: [view(ID.a, 'בוקר')], start_view_id: ID.b }).start_view_id).toBeNull()
      expect(SoldierPreferences.parse({ start_view_id: 'not an id' }).start_view_id).toBeNull()
    })
  })

  it('reads the notification choices, each kind defaulting to on (D-352, D-358)', () => {
    const seen = '2026-11-13T08:00:00.000Z'
    const read = SoldierPreferences.parse({ updates_seen_at: seen, notifications: { awaiting_me: false } })
    expect(read.updates_seen_at).toBe(seen)
    expect(read.notifications).toEqual({ my_request: true, awaiting_me: false })
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

describe('PushEndpoint (D-351)', () => {
  it('accepts the browsers push services', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-db5p.notify.windows.com/w/?token=abc',
    ]) {
      expect(PushEndpoint.safeParse(url).success).toBe(true)
    }
  })

  it('refuses any other host, a look-alike, and plain http', () => {
    for (const url of [
      'https://internal.example.test/hook',
      'https://evilpush.apple.com/abc',
      'https://fcm.googleapis.com.example.test/abc',
      'https://push.apple.com.example.test/abc',
      'http://fcm.googleapis.com/fcm/send/abc',
    ]) {
      expect(PushEndpoint.safeParse(url).success).toBe(false)
    }
  })
})
