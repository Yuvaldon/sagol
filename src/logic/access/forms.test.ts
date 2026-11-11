import {
  AccessGrantId,
  CalendarDate,
  CommandRankId,
  OrganizationId,
  RankRoleBindingId,
  RoleId,
  SoldierId,
  Timestamp,
  UnitId,
  type AccessGrant,
  type Permission,
  type RankRoleBinding,
  type Role,
} from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  NEW_ROLE_VALUES,
  NEW_SCOPE_VALUES,
  PERMISSION_GRID,
  anchorFields,
  bindingFormIssues,
  bindingFormValues,
  grantDaysOf,
  grantFormIssues,
  grantStateAt,
  nextGrantBoundary,
  hasPermission,
  liveBindingsOf,
  liveRoles,
  newBindingValues,
  newGrantValues,
  roleFormIssues,
  roleFormValues,
  scopeColumnsOf,
  sortedGrants,
  toCreateRoleInput,
  toGrantAccessInput,
  toUpdateBindingInput,
  toUpdateRoleInput,
  toggledPermission,
} from './forms'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 3, archived_at: null }
const ZONE = 'Asia/Jerusalem'

const VIEW_LEAVES: Permission = { resource: 'leaves', action: 'view' }
const CREATE_LEAVES: Permission = { resource: 'leaves', action: 'create' }

function role(n: number, name: string, overrides: Partial<Role> = {}): Role {
  return { id: RoleId.parse(uuid(n)), organization_id: ORGANIZATION, name, description: null, color_key: null, ...audit, ...overrides }
}

function binding(n: number, roleN: number, overrides: Partial<RankRoleBinding> = {}): RankRoleBinding {
  return {
    id: RankRoleBindingId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    command_rank_id: CommandRankId.parse(uuid(70)),
    role_id: RoleId.parse(uuid(roleN)),
    ...NEW_SCOPE_VALUES,
    ...audit,
    ...overrides,
  }
}

function grant(n: number, overrides: Partial<AccessGrant> = {}): AccessGrant {
  return {
    id: AccessGrantId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    grantee_soldier_id: SoldierId.parse(uuid(50)),
    role_id: RoleId.parse(uuid(1)),
    ...NEW_SCOPE_VALUES,
    valid_from: Timestamp.parse('2026-11-01T00:00:00.000Z'),
    valid_to: null,
    reason: null,
    granted_by: null,
    granted_at: Timestamp.parse(AT),
    revoked_at: null,
    revoked_by: null,
    ...overrides,
  }
}

describe('permission grid', () => {
  it('holds only the valid pairs of D-040', () => {
    const roles = PERMISSION_GRID.find((row) => row.resource === 'access_grants')
    expect(roles?.actions).toEqual(['view', 'create', 'delete'])
  })

  it('toggles a pair on and off', () => {
    const on = toggledPermission([], VIEW_LEAVES)
    expect(hasPermission(on, VIEW_LEAVES)).toBe(true)
    expect(toggledPermission(on, VIEW_LEAVES)).toEqual([])
  })
})

describe('roles', () => {
  it('lists live roles by name', () => {
    const list = liveRoles([role(2, 'ב'), role(1, 'א'), role(3, 'ג', { archived_at: AT })])
    expect(list.map((item) => item.name)).toEqual(['א', 'ב'])
  })

  it('needs a name', () => {
    expect(roleFormIssues(NEW_ROLE_VALUES).map((issue) => issue.path[0])).toContain('name')
  })

  it('stores the pairs in the grid order whatever order they were ticked in', () => {
    const input = toCreateRoleInput({ ...NEW_ROLE_VALUES, name: 'מפקד', permissions: [CREATE_LEAVES, VIEW_LEAVES] })
    expect(input.permissions).toEqual([VIEW_LEAVES, CREATE_LEAVES])
    expect(input.description).toBeNull()
  })

  it('sends nothing when nothing changed, and the whole set when it did', () => {
    const stored = role(1, 'מפקד')
    const values = roleFormValues(stored, [VIEW_LEAVES])
    expect(toUpdateRoleInput(stored, [VIEW_LEAVES], 3, values)).toBeNull()
    const changed = toUpdateRoleInput(stored, [VIEW_LEAVES], 3, { ...values, permissions: [VIEW_LEAVES, CREATE_LEAVES] })
    expect(changed).toEqual({ id: stored.id, expected_version: 3, changes: { permissions: [VIEW_LEAVES, CREATE_LEAVES] } })
  })
})

describe('scope', () => {
  it('shows only the fields the anchor needs', () => {
    expect(anchorFields('unit')).toEqual({ unit: true, soldier: false, level: false, steps: false, descendants: true })
    expect(anchorFields('soldier')).toEqual({ unit: false, soldier: true, level: false, steps: false, descendants: false })
    expect(anchorFields('organization').descendants).toBe(false)
  })

  it('stores NULL for what the anchor does not use', () => {
    const columns = scopeColumnsOf({ ...NEW_SCOPE_VALUES, anchor_type: 'self', anchor_unit_id: UnitId.parse(uuid(10)) })
    expect(columns.anchor_unit_id).toBeNull()
    expect(columns.include_descendants).toBe(false)
  })
})

describe('rank bindings', () => {
  const ROLE = RoleId.parse(uuid(1))

  it('names the missing anchor field, not the anchor', () => {
    const values = { ...newBindingValues(), command_rank_id: CommandRankId.parse(uuid(70)), anchor_type: 'unit' as const }
    const paths = bindingFormIssues(ROLE, values).map((issue) => issue.path[0])
    expect(paths).toEqual(['anchor_unit_id'])
  })

  it('needs a rank', () => {
    expect(bindingFormIssues(ROLE, newBindingValues()).map((issue) => issue.path[0])).toContain('command_rank_id')
  })

  it('updates only when the scope changed', () => {
    const stored = binding(5, 1)
    expect(toUpdateBindingInput(stored, 3, bindingFormValues(stored))).toBeNull()
    const changed = toUpdateBindingInput(stored, 3, { ...bindingFormValues(stored), subject_rank_constraint: 'junior' })
    expect(changed?.changes.subject_rank_constraint).toBe('junior')
  })

  it('lists the live bindings of one role', () => {
    const rows = [binding(5, 1), binding(6, 2), binding(7, 1, { archived_at: AT })]
    expect(liveBindingsOf(rows, ROLE).map((row) => row.id)).toEqual([uuid(5)])
  })
})

describe('access grants (D-166)', () => {
  const values = {
    ...newGrantValues(),
    grantee_soldier_id: SoldierId.parse(uuid(50)),
    role_id: RoleId.parse(uuid(1)),
    anchor_type: 'organization' as const,
    valid_from: CalendarDate.parse('2026-11-12'),
    valid_to: CalendarDate.parse('2026-11-14'),
  }

  it('stores the window from the start of the first day to the start of the day after the last', () => {
    const input = toGrantAccessInput(values, ZONE)
    expect(input.valid_from).toBe('2026-11-11T22:00:00.000Z')
    expect(input.valid_to).toBe('2026-11-14T22:00:00.000Z')
  })

  it('leaves open ends NULL', () => {
    const input = toGrantAccessInput({ ...values, valid_from: null, valid_to: null }, ZONE)
    expect(input.valid_from).toBeNull()
    expect(input.valid_to).toBeNull()
  })

  it('refuses a last day before the first', () => {
    const issues = grantFormIssues({ ...values, valid_to: CalendarDate.parse('2026-11-11') }, ZONE)
    expect(issues).toContainEqual({ path: ['valid_to'], code: 'range_inverted' })
  })

  it('accepts a one-day grant', () => {
    expect(grantFormIssues({ ...values, valid_to: values.valid_from }, ZONE)).toEqual([])
  })

  it('reads the days back, the last one inclusive', () => {
    const stored = grant(20, {
      valid_from: Timestamp.parse('2026-11-11T22:00:00.000Z'),
      valid_to: Timestamp.parse('2026-11-14T22:00:00.000Z'),
    })
    expect(grantDaysOf(stored, ZONE)).toEqual({ from: '2026-11-12', to: '2026-11-14' })
  })

  it('tells active, scheduled, expired and revoked apart, and lists the live ones first', () => {
    const now = Timestamp.parse('2026-11-10T00:00:00.000Z')
    const active = grant(21)
    const scheduled = grant(22, { valid_from: Timestamp.parse('2026-11-20T00:00:00.000Z') })
    const expired = grant(23, { valid_to: Timestamp.parse('2026-11-05T00:00:00.000Z') })
    const revoked = grant(24, { revoked_at: Timestamp.parse(AT) })
    expect([active, scheduled, expired, revoked].map((row) => grantStateAt(row, now))).toEqual([
      'active',
      'scheduled',
      'expired',
      'revoked',
    ])
    expect(sortedGrants([expired, active, revoked, scheduled], now).slice(0, 2).map((row) => row.id)).toEqual([
      active.id,
      scheduled.id,
    ])
  })
  it('finds the next start or end of a live grant, and none past the last', () => {
    const now = Timestamp.parse('2026-11-10T00:00:00.000Z')
    const ending = grant(25, { valid_to: Timestamp.parse('2026-11-15T00:00:00.000Z') })
    const starting = grant(26, { valid_from: Timestamp.parse('2026-11-12T00:00:00.000Z') })
    const revoked = grant(27, { valid_from: Timestamp.parse('2026-11-11T00:00:00.000Z'), revoked_at: Timestamp.parse(AT) })
    expect(nextGrantBoundary([ending, starting, revoked], now)).toBe('2026-11-12T00:00:00.000Z')
    expect(nextGrantBoundary([grant(21)], now)).toBeNull()
  })
})
