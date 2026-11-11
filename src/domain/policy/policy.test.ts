import { describe, expect, it } from 'vitest'
import {
  CommandRankId,
  Permission,
  RankRoleBindingId,
  SeniorityOverrideId,
  SubjectRankConstraint,
  Timestamp,
  UnitId,
} from '@contracts'
import {
  ACCESS_MANAGEMENT_PERMISSIONS,
  TARGET_KINDS_BY_RESOURCE,
  accessGrantIssues,
  accessManagerIssues,
  accessManagers,
  can,
  canUnconstrained,
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
} from './index'
import {
  CLOCK,
  MATRIX,
  NOW,
  RANK,
  ROLE,
  S,
  UNIT,
  noScope,
  p,
  soldierTarget,
  unitTarget,
  uuid,
  world,
  type SoldierName,
  type World,
} from '../testing'

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

  it('counts only unconstrained sources for a change of one\'s own rank (D-157)', () => {
    const approve = p('leaves', 'approve')
    expect(can(context, S.pc2, approve, soldierTarget('pc2'))).toBe(true)
    expect(canUnconstrained(context, S.pc2, approve, soldierTarget('pc2'))).toBe(false)
    expect(canUnconstrained(context, S.cc, approve, soldierTarget('cc'))).toBe(true)
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
