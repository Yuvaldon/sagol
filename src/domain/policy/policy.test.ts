import { describe, expect, it } from 'vitest'
import {
  AccessGrantId,
  CommandRankId,
  Permission,
  RankRoleBindingId,
  RoleId,
  SeniorityOverrideId,
  SoldierId,
  SubjectRankConstraint,
  Timestamp,
  UnitId,
  UnitLevelId,
  UnitMembershipId,
  type PermissionAction,
  type PermissionResource,
  type PolicyTarget,
} from '@contracts'
import type { Clock } from '../time'
import {
  ACCESS_MANAGEMENT_PERMISSIONS,
  EVERY_SOLDIER,
  TARGET_KINDS_BY_RESOURCE,
  accessGrantIssues,
  accessManagerIssues,
  accessManagers,
  can,
  createPolicyContext,
  missingPermissions,
  scopeWithin,
  withinReach,
  type ResolvedScope,
  placementTarget,
  soldierTarget as targetOfSoldier,
  archiveRankIssues,
  acceptsTarget,
  seniorityOverrideOverlapIssues,
  unitTarget as targetOfUnit,
  type PolicyData,
} from './index'

// ============================================================================ sample world
// Test data only (iron rule 4). Phase 8 runs the same matrix against the database (D-007).
//
//   BAT (battalion)
//   └─ COMP (company)
//      ├─ P1 (platoon) ── S11, S12 (squads)
//      └─ P2 (platoon) ── S21 (squad)

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const LEVEL = {
  battalion: UnitLevelId.parse(uuid(101)),
  company: UnitLevelId.parse(uuid(102)),
  platoon: UnitLevelId.parse(uuid(103)),
  squad: UnitLevelId.parse(uuid(104)),
}
const UNIT = {
  BAT: UnitId.parse(uuid(1)),
  COMP: UnitId.parse(uuid(2)),
  P1: UnitId.parse(uuid(3)),
  P2: UnitId.parse(uuid(4)),
  S11: UnitId.parse(uuid(5)),
  S12: UnitId.parse(uuid(6)),
  S21: UnitId.parse(uuid(7)),
}
const RANK = {
  fighter: CommandRankId.parse(uuid(201)),
  squad: CommandRankId.parse(uuid(202)),
  platoon: CommandRankId.parse(uuid(203)),
  company: CommandRankId.parse(uuid(204)),
}
const ROLE = {
  baseline: RoleId.parse(uuid(301)),
  approver: RoleId.parse(uuid(302)),
  admin: RoleId.parse(uuid(303)),
  archived: RoleId.parse(uuid(304)),
  viewer: RoleId.parse(uuid(305)),
}
const SOLDIER_NAMES = [
  'f11', 'f12', 'sc11', 'pc1', 'pc2', 'cc', 'f21', 'admin', 'tempadmin',
  'inactive', 'archived', 'norank', 'senior', 'unplaced', 'unlinked',
] as const
type SoldierName = (typeof SOLDIER_NAMES)[number]
const S = Object.fromEntries(
  SOLDIER_NAMES.map((name, index) => [name, SoldierId.parse(uuid(401 + index))]),
) as Record<SoldierName, SoldierId>

const NOW = '2026-11-04T08:00:00Z'
const CLOCK: Clock = { today: '2026-11-04', now: NOW }
const ARCHIVED_AT = '2026-10-01T08:00:00Z'

const p = (resource: PermissionResource, action: PermissionAction) =>
  Permission.parse({ resource, action })

type Row<K extends keyof PolicyData> = PolicyData[K] extends Iterable<infer T> ? T : never
type World = { -readonly [K in keyof PolicyData]: PolicyData[K] extends Iterable<infer T> ? T[] : PolicyData[K] }

const noScope = {
  anchor_unit_id: null,
  anchor_soldier_id: null,
  anchor_level_id: null,
  anchor_steps: null,
  include_descendants: false,
}

function world(): World {
  const soldier = (
    name: SoldierName,
    rank: CommandRankId | null,
    extra: Partial<Row<'soldiers'>> = {},
  ): Row<'soldiers'> => ({ id: S[name], command_rank_id: rank, status: 'active', archived_at: null, ...extra })
  const placements: [SoldierName, UnitId, string | null][] = [
    ['f11', UNIT.S11, null], ['f12', UNIT.S12, null], ['sc11', UNIT.S11, null],
    ['pc1', UNIT.P1, null], ['pc2', UNIT.P2, null], ['cc', UNIT.COMP, null],
    ['f21', UNIT.S21, null], ['admin', UNIT.COMP, null], ['tempadmin', UNIT.COMP, null],
    ['inactive', UNIT.S11, null], ['archived', UNIT.S12, null], ['norank', UNIT.S11, null],
    ['senior', UNIT.S11, null], ['unplaced', UNIT.S11, '2026-11-03'], ['unlinked', UNIT.S12, null],
  ]
  const pairs: [RoleId, PermissionResource, PermissionAction][] = [
    [ROLE.baseline, 'leaves', 'view'], [ROLE.baseline, 'leaves', 'create'],
    [ROLE.baseline, 'leaves', 'delete'], [ROLE.baseline, 'leave_types', 'view'],
    [ROLE.baseline, 'units', 'view'],
    [ROLE.approver, 'leaves', 'view'], [ROLE.approver, 'leaves', 'approve'],
    [ROLE.approver, 'soldiers', 'view'],
    [ROLE.admin, 'access_grants', 'create'], [ROLE.admin, 'access_grants', 'delete'],
    [ROLE.admin, 'roles', 'update'], [ROLE.admin, 'tags', 'create'], [ROLE.admin, 'units', 'update'],
    [ROLE.archived, 'leaves', 'approve'],
    [ROLE.viewer, 'tags', 'view'],
  ]
  const binding = (
    n: number,
    rank: CommandRankId,
    role: RoleId,
    scope: Partial<Row<'rank_role_bindings'>>,
  ): Row<'rank_role_bindings'> => ({
    id: RankRoleBindingId.parse(uuid(500 + n)),
    command_rank_id: rank,
    role_id: role,
    anchor_type: 'organization',
    ...noScope,
    subject_rank_constraint: 'any',
    archived_at: null,
    ...scope,
  })
  const grant = (
    n: number,
    grantee: SoldierName,
    role: RoleId,
    fields: Partial<Row<'access_grants'>>,
  ): Row<'access_grants'> => ({
    id: AccessGrantId.parse(uuid(600 + n)),
    grantee_soldier_id: S[grantee],
    role_id: role,
    anchor_type: 'organization',
    ...noScope,
    subject_rank_constraint: 'any',
    valid_from: '2026-11-01T00:00:00Z',
    valid_to: null,
    revoked_at: null,
    ...fields,
  })
  const override = (
    n: number,
    name: SoldierName,
    seniority: number,
    from: string,
    to: string | null,
    revokedAt: string | null = null,
  ): Row<'seniority_overrides'> => ({
    id: SeniorityOverrideId.parse(uuid(700 + n)),
    soldier_id: S[name],
    seniority,
    valid_from: from,
    valid_to: to,
    revoked_at: revokedAt,
  })

  return {
    baseline_role_id: ROLE.baseline,
    units: [
      { id: UNIT.BAT, parent_id: null, unit_level_id: LEVEL.battalion },
      { id: UNIT.COMP, parent_id: UNIT.BAT, unit_level_id: LEVEL.company },
      { id: UNIT.P1, parent_id: UNIT.COMP, unit_level_id: LEVEL.platoon },
      { id: UNIT.P2, parent_id: UNIT.COMP, unit_level_id: LEVEL.platoon },
      { id: UNIT.S11, parent_id: UNIT.P1, unit_level_id: LEVEL.squad },
      { id: UNIT.S12, parent_id: UNIT.P1, unit_level_id: LEVEL.squad },
      { id: UNIT.S21, parent_id: UNIT.P2, unit_level_id: LEVEL.squad },
    ],
    soldiers: [
      soldier('f11', RANK.fighter), soldier('f12', RANK.fighter), soldier('sc11', RANK.squad),
      soldier('pc1', RANK.platoon), soldier('pc2', RANK.platoon), soldier('cc', RANK.company),
      soldier('f21', RANK.fighter), soldier('admin', RANK.fighter), soldier('tempadmin', RANK.fighter),
      soldier('inactive', RANK.squad, { status: 'inactive' }),
      soldier('archived', RANK.squad, { archived_at: ARCHIVED_AT }),
      soldier('norank', null), soldier('senior', RANK.fighter), soldier('unplaced', RANK.fighter),
      soldier('unlinked', RANK.squad),
    ],
    command_ranks: [
      { id: RANK.fighter, seniority: 10 },
      { id: RANK.squad, seniority: 20 },
      { id: RANK.platoon, seniority: 30 },
      { id: RANK.company, seniority: 40 },
    ],
    seniority_overrides: [
      override(1, 'senior', 35, '2026-11-01', null),
      override(2, 'f12', 50, '2026-11-01', null, ARCHIVED_AT),
      override(3, 'sc11', 99, '2026-01-01', '2026-10-31'),
    ],
    unit_memberships: placements.map(([name, unitId, to], index) => ({
      id: UnitMembershipId.parse(uuid(800 + index)),
      soldier_id: S[name],
      unit_id: unitId,
      membership_type: 'primary' as const,
      valid_from: '2026-01-01',
      valid_to: to,
    })),
    soldier_accounts: SOLDIER_NAMES.filter((name) => name !== 'unlinked').map((name) => ({
      soldier_id: S[name],
      revoked_at: null,
    })),
    roles: Object.values(ROLE).map((id) => ({
      id,
      archived_at: id === ROLE.archived ? ARCHIVED_AT : null,
    })),
    role_permissions: pairs.map(([role_id, resource, action]) => ({ role_id, resource, action })),
    rank_role_bindings: [
      // A squad commander approves juniors in the whole platoon (D-028 example).
      binding(1, RANK.squad, ROLE.approver, {
        anchor_type: 'home_ancestor_steps', anchor_steps: 1, include_descendants: true,
        subject_rank_constraint: 'junior',
      }),
      binding(2, RANK.platoon, ROLE.approver, {
        anchor_type: 'home_unit', include_descendants: true, subject_rank_constraint: 'junior_or_equal',
      }),
      binding(3, RANK.company, ROLE.approver, {
        anchor_type: 'home_ancestor_at_level', anchor_level_id: LEVEL.company, include_descendants: true,
      }),
      binding(4, RANK.fighter, ROLE.archived, {}),
      binding(5, RANK.fighter, ROLE.admin, { archived_at: ARCHIVED_AT }),
    ],
    access_grants: [
      grant(1, 'f21', ROLE.approver, {
        anchor_type: 'unit', anchor_unit_id: UNIT.S21, valid_to: '2026-11-30T00:00:00Z',
      }),
      grant(2, 'f12', ROLE.approver, { valid_from: '2026-10-01T00:00:00Z', valid_to: '2026-11-01T00:00:00Z' }),
      grant(3, 'f12', ROLE.approver, { valid_from: '2026-12-01T00:00:00Z' }),
      grant(4, 'f11', ROLE.approver, { revoked_at: '2026-11-02T00:00:00Z' }),
      grant(5, 'admin', ROLE.admin, {}),
      grant(6, 'tempadmin', ROLE.admin, { valid_to: '2027-01-01T00:00:00Z' }),
      grant(7, 'f11', ROLE.viewer, { anchor_type: 'home_ancestor_steps', anchor_steps: 10 }),
      grant(8, 'pc2', ROLE.viewer, { anchor_type: 'home_ancestor_at_level', anchor_level_id: LEVEL.squad }),
      grant(9, 'norank', ROLE.approver, { subject_rank_constraint: 'junior' }),
      // Management powers held at a unit scope only.
      grant(10, 'pc1', ROLE.admin, { anchor_type: 'home_unit', include_descendants: true }),
      grant(11, 'norank', ROLE.approver, { subject_rank_constraint: 'junior_or_equal' }),
    ],
  }
}

const soldierTarget = (name: SoldierName): PolicyTarget => ({ kind: 'soldier', soldier_id: S[name] })
const unitTarget = (unitId: UnitId): PolicyTarget => ({ kind: 'unit', unit_id: unitId })
const ORG: PolicyTarget = { kind: 'organization' }

// ================================================================================ matrix
// actor × permission × target → allowed. One row per rule it proves.

type MatrixRow = [
  why: string,
  actor: SoldierName,
  resource: PermissionResource,
  action: PermissionAction,
  target: PolicyTarget,
  allowed: boolean,
]

const MATRIX: MatrixRow[] = [
  // Baseline role, applied to self (D-003)
  ['baseline covers own leaves', 'f11', 'leaves', 'create', soldierTarget('f11'), true],
  ['baseline does not cover another soldier', 'f11', 'leaves', 'create', soldierTarget('f12'), false],
  ['view of organization data from any scope (D-053)', 'f11', 'leave_types', 'view', ORG, true],
  ['no self-approval without the permission (D-013)', 'f11', 'leaves', 'approve', soldierTarget('f11'), false],
  // Who holds permissions at all (D-056)
  ['unlinked soldier holds nothing', 'unlinked', 'leaves', 'view', soldierTarget('unlinked'), false],
  ['inactive soldier holds nothing', 'inactive', 'leaves', 'view', soldierTarget('inactive'), false],
  ['archived soldier holds nothing', 'archived', 'leaves', 'view', soldierTarget('archived'), false],
  // Relative anchors on rank bindings (D-028)
  ['squad cmdr: own squad, junior', 'sc11', 'leaves', 'approve', soldierTarget('f11'), true],
  ['squad cmdr: sibling squad via 1 step up + descendants', 'sc11', 'leaves', 'approve', soldierTarget('f12'), true],
  ['squad cmdr: other platoon out of scope', 'sc11', 'leaves', 'approve', soldierTarget('f21'), false],
  ['junior excludes self (D-057)', 'sc11', 'leaves', 'approve', soldierTarget('sc11'), false],
  ['junior excludes a senior subject', 'sc11', 'leaves', 'approve', soldierTarget('pc1'), false],
  ['subject without rank is junior (D-057)', 'sc11', 'leaves', 'approve', soldierTarget('norank'), true],
  ['active override raises the subject (D-029)', 'sc11', 'leaves', 'approve', soldierTarget('senior'), false],
  ['subject without unit today is out of unit scopes (D-054)', 'sc11', 'leaves', 'approve', soldierTarget('unplaced'), false],
  ['junior_or_equal includes self (D-057)', 'pc1', 'leaves', 'approve', soldierTarget('pc1'), true],
  ['platoon cmdr: home unit + descendants', 'pc1', 'leaves', 'approve', soldierTarget('sc11'), true],
  ['platoon cmdr: override above own seniority', 'pc1', 'leaves', 'approve', soldierTarget('senior'), false],
  ['platoon cmdr: other platoon', 'pc1', 'leaves', 'approve', soldierTarget('f21'), false],
  ['platoon cmdr P2: P1 out of scope', 'pc2', 'leaves', 'approve', soldierTarget('pc1'), false],
  ['company cmdr: ancestor at level + descendants', 'cc', 'leaves', 'approve', soldierTarget('f21'), true],
  ['company cmdr: any ignores seniority', 'cc', 'leaves', 'approve', soldierTarget('senior'), true],
  ['company cmdr: unit target inside scope', 'cc', 'soldiers', 'view', unitTarget(UNIT.S21), true],
  // Access grants (D-003, D-058)
  ['acting grant on own squad', 'f21', 'leaves', 'approve', soldierTarget('f21'), true],
  ['acting grant does not reach other units', 'f21', 'leaves', 'approve', soldierTarget('f11'), false],
  ['unit anchor covers the unit', 'f21', 'soldiers', 'view', unitTarget(UNIT.S21), true],
  ['unit anchor without descendants excludes the parent', 'f21', 'soldiers', 'view', unitTarget(UNIT.P2), false],
  ['expired and future grants grant nothing', 'f12', 'leaves', 'approve', soldierTarget('f11'), false],
  ['revoked grant and archived role grant nothing', 'f11', 'leaves', 'approve', soldierTarget('f12'), false],
  ['holder without seniority gets only "any" (D-057)', 'norank', 'leaves', 'approve', soldierTarget('f11'), false],
  ['holder without seniority keeps the baseline', 'norank', 'leaves', 'create', soldierTarget('norank'), true],
  ['holder without seniority: junior_or_equal not even on self (D-157)', 'norank', 'leaves', 'approve', soldierTarget('norank'), false],
  // A soldier scope sees its own unit chain (D-159)
  ['self scope views the home unit', 'f11', 'units', 'view', unitTarget(UNIT.S11), true],
  ['self scope views the home unit\'s ancestors', 'f11', 'units', 'view', unitTarget(UNIT.BAT), true],
  ['self scope does not view a sibling unit', 'f11', 'units', 'view', unitTarget(UNIT.S12), false],
  ['self scope sees no unit without a home unit', 'unplaced', 'units', 'view', unitTarget(UNIT.S11), false],
  // Unit targets
  ['steps-up scope covers the platoon unit', 'sc11', 'soldiers', 'view', unitTarget(UNIT.P1), true],
  ['steps-up scope covers a sibling squad unit', 'sc11', 'soldiers', 'view', unitTarget(UNIT.S12), true],
  ['steps-up scope does not cover the company', 'sc11', 'soldiers', 'view', unitTarget(UNIT.COMP), false],
  // Organization-wide data (D-053)
  ['organization scope changes organization data', 'admin', 'tags', 'create', ORG, true],
  ['an expiring grant still grants until it expires', 'tempadmin', 'tags', 'create', ORG, true],
  ['unit scope cannot change organization data, even when held', 'pc1', 'tags', 'create', ORG, false],
  ['unit scope covers its own units', 'pc1', 'units', 'update', unitTarget(UNIT.S11), true],
  ['unit scope does not cover units outside it', 'pc1', 'units', 'update', unitTarget(UNIT.P2), false],
  ['unit scope cannot change a top-level unit', 'pc1', 'units', 'update', ORG, false],
  ['baseline view of reference data', 'sc11', 'leave_types', 'view', ORG, true],
  ['empty scope covers nothing, not even view (D-055)', 'f11', 'tags', 'view', ORG, false],
  ['level anchor without an ancestor at that level is empty', 'pc2', 'tags', 'view', ORG, false],
  ['organization scope covers any unit', 'admin', 'units', 'update', unitTarget(UNIT.S11), true],
  ['organization scope covers a top-level unit change', 'admin', 'units', 'update', ORG, true],
  ['organization scope covers any grantee', 'admin', 'access_grants', 'create', soldierTarget('f11'), true],
  ['permission not held at all', 'admin', 'leaves', 'approve', soldierTarget('f11'), false],
  // Target kinds (D-053)
  ['tags accept organization targets only', 'admin', 'tags', 'create', soldierTarget('f11'), false],
  ['access grants accept soldier targets only', 'admin', 'access_grants', 'create', ORG, false],
  // Every soldier (D-162)
  ['organization scope with any covers every soldier', 'admin', 'access_grants', 'create', EVERY_SOLDIER, true],
  ['a unit scope does not cover every soldier', 'pc1', 'access_grants', 'create', EVERY_SOLDIER, false],
  ['tags do not accept every soldier', 'admin', 'tags', 'view', EVERY_SOLDIER, false],
]

describe('policy matrix', () => {
  const context = createPolicyContext(world(), CLOCK)
  it.each(MATRIX)('%s', (_why, actor, resource, action, target, allowed) => {
    expect(can(context, S[actor], p(resource, action), target)).toBe(allowed)
  })

  it('lists target kinds for every resource', () => {
    for (const kinds of Object.values(TARGET_KINDS_BY_RESOURCE)) expect(kinds.length).toBeGreaterThan(0)
  })
})

describe('private fields on creation (D-096)', () => {
  const context = createPolicyContext(world(), CLOCK)

  it('accepts a unit or organization target for private fields, and a scope must still reach it', () => {
    expect(acceptsTarget('soldier_private', 'unit')).toBe(true)
    expect(acceptsTarget('soldier_private', 'organization')).toBe(true)
    expect(can(context, S.f12, p('soldier_private', 'update'), { kind: 'organization' })).toBe(false)
    expect(can(context, S.f12, p('soldier_private', 'update'), unitTarget(UNIT.S21))).toBe(false)
  })

  it('names a soldier target', () => {
    expect(targetOfSoldier(S.f12)).toEqual({ kind: 'soldier', soldier_id: S.f12 })
  })
})

describe('archiving a rank (D-095)', () => {
  const rank = CommandRankId.parse('00000000-0000-4000-8000-000000000abc')
  const refused = [{ path: [], code: 'rank_in_use' }]

  it('refuses while a live soldier holds it', () => {
    expect(archiveRankIssues([{ command_rank_id: rank, archived_at: null }], rank)).toEqual(refused)
  })

  it('ignores archived holders and other ranks', () => {
    expect(archiveRankIssues([{ command_rank_id: rank, archived_at: '2026-01-01T00:00:00Z' }], rank)).toEqual([])
    expect(archiveRankIssues([{ command_rank_id: null, archived_at: null }], rank)).toEqual([])
    expect(archiveRankIssues([], rank)).toEqual([])
  })
})

describe('effective permissions', () => {
  const context = createPolicyContext(world(), CLOCK)

  it('derives seniority from override, else rank (D-029)', () => {
    expect(context.seniorityOf(S.senior)).toBe(35)
    expect(context.seniorityOf(S.f12)).toBe(10) // revoked override ignored
    expect(context.seniorityOf(S.sc11)).toBe(20) // expired override ignored
    expect(context.seniorityOf(S.norank)).toBeNull()
  })

  it('records the source and expiry of each permission', () => {
    const sources = context.permissionsOf(S.f21).map((held) => [held.source.kind, held.expires_at])
    expect(sources).toContainEqual(['baseline', null])
    expect(sources).toContainEqual(['access_grant', '2026-11-30T00:00:00Z'])
  })

  it('moves relative scopes with the membership (D-028)', () => {
    const moved = world()
    moved.unit_memberships = moved.unit_memberships.map((membership) =>
      membership.soldier_id === S.sc11 ? { ...membership, unit_id: UNIT.S21 } : membership,
    )
    const context = createPolicyContext(moved, CLOCK)
    expect(can(context, S.sc11, p('leaves', 'approve'), soldierTarget('f21'))).toBe(true)
    expect(can(context, S.sc11, p('leaves', 'approve'), soldierTarget('f11'))).toBe(false)
  })
})

// ========================================================================== invariants

describe('access-manager invariant (D-059)', () => {
  const issue = [{ path: [], code: 'last_access_manager' }]
  const check = (data: World) => accessManagerIssues(createPolicyContext(data, CLOCK))

  it('counts only lasting organization-scope managers', () => {
    expect(accessManagers(createPolicyContext(world(), CLOCK))).toEqual([S.admin])
    expect(check(world())).toEqual([])
  })

  it.each<[string, (data: World) => void]>([
    ['the grant is revoked', (data) => {
      data.access_grants = data.access_grants.map((g) => (g.grantee_soldier_id === S.admin ? { ...g, revoked_at: NOW } : g))
    }],
    ['the grant gets an expiry', (data) => {
      data.access_grants = data.access_grants.map((g) =>
        g.grantee_soldier_id === S.admin ? { ...g, valid_to: '2027-01-01T00:00:00Z' } : g)
    }],
    ['the soldier is archived', (data) => {
      data.soldiers = data.soldiers.map((s) => (s.id === S.admin ? { ...s, archived_at: NOW } : s))
    }],
    ['the soldier becomes inactive', (data) => {
      data.soldiers = data.soldiers.map((s) => (s.id === S.admin ? { ...s, status: 'inactive' as const } : s))
    }],
    ['the account is revoked', (data) => {
      data.soldier_accounts = data.soldier_accounts.map((a) => (a.soldier_id === S.admin ? { ...a, revoked_at: NOW } : a))
    }],
    ['the role loses roles:update', (data) => {
      data.role_permissions = data.role_permissions.filter((r) => !(r.role_id === ROLE.admin && r.resource === 'roles'))
    }],
    ['the grant is limited to junior subjects (D-158)', (data) => {
      data.access_grants = data.access_grants.map((g) =>
        g.grantee_soldier_id === S.admin ? { ...g, subject_rank_constraint: 'junior' as const } : g)
    }],
    ['the role is archived', (data) => {
      data.roles = data.roles.map((r) => (r.id === ROLE.admin ? { ...r, archived_at: NOW } : r))
    }],
  ])('rejects the change when %s', (_why, change) => {
    const data = world()
    change(data)
    expect(check(data)).toEqual(issue)
  })

  it('accepts the change when another manager remains (rank binding)', () => {
    const data = world()
    data.rank_role_bindings.push({
      id: RankRoleBindingId.parse(uuid(599)),
      command_rank_id: RANK.company,
      role_id: ROLE.admin,
      anchor_type: 'organization',
      ...noScope,
      subject_rank_constraint: 'any',
      archived_at: null,
    })
    data.access_grants = data.access_grants.filter((g) => g.grantee_soldier_id !== S.admin)
    expect(accessManagers(createPolicyContext(data, CLOCK))).toEqual([S.cc])
    expect(check(data)).toEqual([])
  })

  it('names the pairs that make an access manager', () => {
    expect(ACCESS_MANAGEMENT_PERMISSIONS.map((pair) => Permission.safeParse(pair).success)).toEqual([true, true, true])
  })
})

describe('escalation guard (D-060)', () => {
  const context = createPolicyContext(world(), CLOCK)

  it('allows only pairs the actor already holds', () => {
    expect(missingPermissions(context, S.admin, [p('tags', 'create'), p('roles', 'update')])).toEqual([])
    expect(missingPermissions(context, S.admin, [p('tags', 'create'), p('leaves', 'approve')])).toEqual([
      p('leaves', 'approve'),
    ])
    expect(missingPermissions(context, S.sc11, [p('leaves', 'approve'), p('soldiers', 'view')])).toEqual([])
    // Pairs held at a unit scope count (D-060: any non-empty scope).
    expect(missingPermissions(context, S.pc1, [p('roles', 'update')])).toEqual([])
  })

  it('ignores empty scopes and soldiers that hold nothing', () => {
    expect(missingPermissions(context, S.pc2, [p('tags', 'view')])).toEqual([p('tags', 'view')])
    expect(missingPermissions(context, S.inactive, [p('leaves', 'view')])).toEqual([p('leaves', 'view')])
  })
})

describe('row checks', () => {
  it('requires access_grants.valid_to after valid_from as instants (OI-009)', () => {
    const inverted = [{ path: ['valid_to'], code: 'range_inverted' }]
    expect(accessGrantIssues({ valid_from: NOW, valid_to: null })).toEqual([])
    expect(accessGrantIssues({ valid_from: NOW, valid_to: NOW })).toEqual(inverted)
    expect(accessGrantIssues({ valid_from: NOW, valid_to: '2026-11-04T07:00:00Z' })).toEqual(inverted)
    // 09:00Z is after 10:00+02:00 (08:00Z), although it sorts first as a string.
    expect(accessGrantIssues({ valid_from: '2026-11-04T10:00:00+02:00', valid_to: '2026-11-04T09:00:00Z' })).toEqual([])
  })

  it('allows one non-revoked seniority override per soldier per day', () => {
    const existing = world().seniority_overrides
    const candidate = (from: string, to: string | null, soldierId = S.senior) => ({
      id: SeniorityOverrideId.parse(uuid(799)),
      soldier_id: soldierId,
      seniority: 1,
      valid_from: from,
      valid_to: to,
      revoked_at: null,
    })
    const overlap = [{ path: ['valid_from'], code: 'seniority_override_overlap' }]
    expect(seniorityOverrideOverlapIssues(existing, candidate('2026-12-01', null))).toEqual(overlap)
    expect(seniorityOverrideOverlapIssues(existing, candidate('2026-01-01', '2026-10-31'))).toEqual([])
    // f12's override is revoked, sc11's ended on 2026-10-31.
    expect(seniorityOverrideOverlapIssues(existing, candidate('2026-11-01', null, S.f12))).toEqual([])
    expect(seniorityOverrideOverlapIssues(existing, candidate('2026-11-01', null, S.sc11))).toEqual([])
    expect(seniorityOverrideOverlapIssues(existing, candidate('2026-10-31', null, S.sc11))).toEqual(overlap)
  })
})

describe('targets of the unit commands (D-053, D-089)', () => {
  const company = UnitId.parse('00000000-0000-4000-8000-000000000901')
  const platoon = UnitId.parse('00000000-0000-4000-8000-000000000902')

  it('treats a top-level unit as organization data, and any other unit as itself', () => {
    expect(targetOfUnit({ id: company, parent_id: null })).toEqual({ kind: 'organization' })
    expect(targetOfUnit({ id: platoon, parent_id: company })).toEqual({ kind: 'unit', unit_id: platoon })
  })

  it('checks a placement against the parent, or the organization at the top', () => {
    expect(placementTarget(null)).toEqual({ kind: 'organization' })
    expect(placementTarget(company)).toEqual({ kind: 'unit', unit_id: company })
  })
})

describe('grant reach (D-156)', () => {
  const context = createPolicyContext(world(), CLOCK)
  const org: ResolvedScope = { kind: 'organization' }
  const unit = (unitId: UnitId, include_descendants: boolean): ResolvedScope => ({
    kind: 'unit',
    unit_id: unitId,
    include_descendants,
  })
  const soldier = (name: SoldierName): ResolvedScope => ({ kind: 'soldier', soldier_id: S[name] })

  it.each<[string, ResolvedScope, ResolvedScope, boolean]>([
    ['anything within organization', unit(UNIT.S11, true), org, true],
    ['organization only within organization', org, unit(UNIT.BAT, true), false],
    ['a unit within itself', unit(UNIT.P1, false), unit(UNIT.P1, false), true],
    ['a unit with descendants not within the unit alone', unit(UNIT.P1, true), unit(UNIT.P1, false), false],
    ['a sub-unit within an ancestor with descendants', unit(UNIT.S11, true), unit(UNIT.COMP, true), true],
    ['a sub-unit not within an ancestor alone', unit(UNIT.S11, false), unit(UNIT.COMP, false), false],
    ['a sibling unit is outside', unit(UNIT.S21, false), unit(UNIT.P1, true), false],
    ['a soldier within a unit that covers them', soldier('f11'), unit(UNIT.P1, true), true],
    ['a soldier outside the unit', soldier('f21'), unit(UNIT.P1, true), false],
    ['a soldier within the same soldier', soldier('f11'), soldier('f11'), true],
    ['a unit never within a soldier', unit(UNIT.S11, false), soldier('f11'), false],
    ['an empty scope within nothing', { kind: 'empty' }, org, false],
  ])('%s', (_why, inner, outer, within) => {
    expect(scopeWithin(inner, outer, context)).toBe(within)
  })

  it('limits a grant by the actor\'s own access_grants:create', () => {
    const create = p('access_grants', 'create')
    const open = { constraint: SubjectRankConstraint.enum.any, until: null }
    expect(withinReach(context, S.admin, create, org, open)).toBe(true)
    expect(withinReach(context, S.pc1, create, unit(UNIT.S11, true), open)).toBe(true)
    expect(withinReach(context, S.pc1, create, unit(UNIT.P2, false), open)).toBe(false)
    expect(withinReach(context, S.pc1, create, org, open)).toBe(false)
    expect(withinReach(context, S.sc11, create, unit(UNIT.S11, false), open)).toBe(false)
  })

  it('never widens the granter\'s rank constraint, nor outlasts its source', () => {
    const approve = p('leaves', 'approve')
    const platoon = unit(UNIT.P1, true)
    const any = SubjectRankConstraint.enum.any
    expect(withinReach(context, S.sc11, approve, platoon, { constraint: SubjectRankConstraint.enum.junior, until: null })).toBe(true)
    expect(withinReach(context, S.sc11, approve, platoon, { constraint: SubjectRankConstraint.enum.junior_or_equal, until: null })).toBe(false)
    expect(withinReach(context, S.sc11, approve, platoon, { constraint: any, until: null })).toBe(false)
    const create = p('access_grants', 'create')
    expect(withinReach(context, S.tempadmin, create, org, { constraint: any, until: null })).toBe(false)
    expect(withinReach(context, S.tempadmin, create, org, { constraint: any, until: Timestamp.parse('2026-12-01T00:00:00.000Z') })).toBe(true)
    expect(withinReach(context, S.tempadmin, create, org, { constraint: any, until: Timestamp.parse('2027-02-01T00:00:00.000Z') })).toBe(false)
  })
})
