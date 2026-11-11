import { describe, expect, it } from 'vitest'
import {
  AccessGrantId,
  AccountLinkRequestStatus,
  RoleId,
  SoldierId,
  UnitId,
  UnitMembershipId,
} from '@contracts'
import { createPolicyContext, type PolicyData } from '../policy'
import {
  autoLinkSoldier,
  canLinkSoldier,
  canReviewLinkRequest,
  canRevokeAccount,
  linkCandidates,
  linkEnrichment,
  linkRequestTransitionIssues,
  linkReviewTargets,
  linkTargetIssues,
  normalizeEmail,
  normalizeName,
  normalizePersonalId,
  type LinkMatchData,
} from './index'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const soldierId = (n: number) => SoldierId.parse(uuid(n))

// ============================================================== normalization (D-066)

describe('normalizeName', () => {
  const same = (a: string, b: string) => expect(normalizeName(a)).toBe(normalizeName(b))

  it('ignores niqqud, accents, case and extra spaces', () => {
    same('יוֹסֵף', 'יוסף')
    same('José', 'jose')
    same('  Dana   Levi ', 'dana levi')
    expect(normalizeName('  Dana   Levi ')).toBe('dana levi')
  })

  it('drops geresh, gershayim and apostrophes; hyphen and maqaf are spaces', () => {
    same('ז׳ניה', 'זניה')
    same("ז'ניה", 'זניה')
    same('בן-דוד', 'בן דוד')
    same('בן־דוד', 'בן דוד')
    same('O’Brien', 'obrien')
  })

  it('treats final letters as regular letters', () => {
    same('שלום', 'שלומ')
    same('ךםןףץ', 'כמנפצ')
  })

  it('keeps different names different', () => {
    expect(normalizeName('דנה')).not.toBe(normalizeName('דינה'))
  })
})

describe('normalizePersonalId', () => {
  it('drops separators and the leading zeros of an all-digit id', () => {
    expect(normalizePersonalId('0123-456 7')).toBe('1234567')
    expect(normalizePersonalId('1.234.567')).toBe('1234567')
    expect(normalizePersonalId('000')).toBe('0')
    expect(normalizePersonalId('１２３')).toBe('123')
  })

  it('upper-cases an id with letters and keeps its zeros', () => {
    expect(normalizePersonalId(' ab-012 ')).toBe('AB012')
  })

  it('is NULL when nothing remains', () => {
    expect(normalizePersonalId(' - . ')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('ignores case and surrounding spaces', () => {
    expect(normalizeEmail('  Dana.Levi@Example.COM ')).toBe('dana.levi@example.com')
  })
})

// ================================================================ candidates (D-030)

const S = {
  byId: soldierId(1),
  byName: soldierId(2),
  swapped: soldierId(3),
  both: soldierId(4),
  archived: soldierId(5),
  revokedAccount: soldierId(6),
  other: soldierId(7),
  inactive: soldierId(8),
  linked: soldierId(9),
}

function matchData(): LinkMatchData {
  const soldier = (id: SoldierId, first_name: string, last_name: string, archived_at: string | null = null) => ({
    id,
    first_name,
    last_name,
    archived_at,
  })
  return {
    soldiers: [
      soldier(S.byId, 'Someone', 'Else'),
      soldier(S.byName, 'דָּנָה', 'לוי'),
      soldier(S.swapped, 'לוי', 'דנה'),
      soldier(S.both, 'דנה', 'לוי'),
      soldier(S.archived, 'דנה', 'לוי', '2026-10-01T00:00:00Z'),
      soldier(S.revokedAccount, 'דנה', 'לוי'),
      soldier(S.other, 'Dana', 'Cohen'),
      soldier(S.inactive, 'דנה', 'לוי'),
      soldier(S.linked, 'דנה', 'לוי'),
    ],
    soldier_private: [
      { soldier_id: S.byId, personal_id: '1234567', invite_email: 'Dana@Example.com' },
      { soldier_id: S.both, personal_id: '7654321', invite_email: null },
      { soldier_id: S.archived, personal_id: '1111111', invite_email: 'dana@example.com' },
      { soldier_id: S.revokedAccount, personal_id: '2222222', invite_email: 'dana@example.com' },
      { soldier_id: S.linked, personal_id: '3333333', invite_email: 'dana@example.com' },
    ],
    soldier_accounts: [
      { soldier_id: S.revokedAccount, revoked_at: '2026-10-01T00:00:00Z' },
      { soldier_id: S.linked, revoked_at: null },
    ],
  }
}

describe('linkCandidates', () => {
  it('lists personal-id matches first, then name matches (in order or swapped)', () => {
    const candidates = linkCandidates(
      { claimed_personal_id: '0123-4567', first_name: ' דנה ', last_name: 'לוי' },
      matchData(),
    )
    expect(candidates).toEqual([
      { soldier_id: S.byId, match: 'personal_id' },
      { soldier_id: S.byName, match: 'name' },
      { soldier_id: S.swapped, match: 'name' },
      { soldier_id: S.both, match: 'name' },
      { soldier_id: S.revokedAccount, match: 'name' },
      { soldier_id: S.inactive, match: 'name' },
    ])
  })

  it('a soldier matching both ways appears once, as a personal-id match', () => {
    const candidates = linkCandidates({ claimed_personal_id: '7654321', first_name: 'דנה', last_name: 'לוי' }, matchData())
    expect(candidates.filter((candidate) => candidate.soldier_id === S.both)).toEqual([
      { soldier_id: S.both, match: 'personal_id' },
    ])
    expect(candidates[0]).toEqual({ soldier_id: S.both, match: 'personal_id' })
  })

  it('never offers archived soldiers or soldiers with an account that is not revoked', () => {
    for (const claimed of ['1111111', '3333333']) {
      const ids = linkCandidates({ claimed_personal_id: claimed, first_name: 'דנה', last_name: 'לוי' }, matchData()).map(
        (candidate) => candidate.soldier_id,
      )
      expect(ids).not.toContain(S.archived)
      expect(ids).not.toContain(S.linked)
    }
  })

  it('offers a soldier whose only account was revoked (D-156)', () => {
    expect(
      linkCandidates({ claimed_personal_id: '2222222', first_name: 'X', last_name: 'Y' }, matchData()),
    ).toEqual([{ soldier_id: S.revokedAccount, match: 'personal_id' }])
  })

  it('names alone match without a personal id; no match gives no candidates', () => {
    expect(linkCandidates({ claimed_personal_id: null, first_name: 'Dana', last_name: 'COHEN' }, matchData())).toEqual([
      { soldier_id: S.other, match: 'name' },
    ])
    expect(linkCandidates({ claimed_personal_id: '999', first_name: 'Nobody', last_name: 'Here' }, matchData())).toEqual([])
  })

  it('a name that normalizes to nothing matches nobody', () => {
    const data: LinkMatchData = {
      soldiers: [{ id: S.other, first_name: "'", last_name: '-', archived_at: null }],
      soldier_private: [],
      soldier_accounts: [],
    }
    expect(linkCandidates({ claimed_personal_id: null, first_name: '"', last_name: '־' }, data)).toEqual([])
  })
})

describe('autoLinkSoldier', () => {
  it('links on personal id AND verified invite email (normalized)', () => {
    expect(autoLinkSoldier({ personal_id: '01234567', verified_email: 'dana@example.com' }, matchData())).toBe(S.byId)
  })

  it('does not link without both, nor to archived or already-linked soldiers', () => {
    const data = matchData()
    expect(autoLinkSoldier({ personal_id: '1234567', verified_email: 'other@example.com' }, data)).toBeNull()
    expect(autoLinkSoldier({ personal_id: null, verified_email: 'dana@example.com' }, data)).toBeNull()
    expect(autoLinkSoldier({ personal_id: '7654321', verified_email: 'dana@example.com' }, data)).toBeNull()
    expect(autoLinkSoldier({ personal_id: '1111111', verified_email: 'dana@example.com' }, data)).toBeNull()
    expect(autoLinkSoldier({ personal_id: '3333333', verified_email: 'dana@example.com' }, data)).toBeNull()
  })

  it('links again a soldier whose account was revoked (D-156)', () => {
    expect(autoLinkSoldier({ personal_id: '2222222', verified_email: 'dana@example.com' }, matchData())).toBe(
      S.revokedAccount,
    )
  })

  it('does not link when two soldiers match (ids stored before normalization)', () => {
    const data: LinkMatchData = {
      soldiers: [
        { id: S.byId, first_name: 'A', last_name: 'B', archived_at: null },
        { id: S.other, first_name: 'C', last_name: 'D', archived_at: null },
      ],
      soldier_private: [
        { soldier_id: S.byId, personal_id: '0123', invite_email: 'dana@example.com' },
        { soldier_id: S.other, personal_id: '123', invite_email: 'DANA@example.com' },
      ],
      soldier_accounts: [],
    }
    expect(autoLinkSoldier({ personal_id: '123', verified_email: 'dana@example.com' }, data)).toBeNull()
  })
})

// ================================================================== review (D-030)

describe('link review', () => {
  const UNIT = UnitId.parse(uuid(100))
  const OTHER_UNIT = UnitId.parse(uuid(101))
  const ROLE = RoleId.parse(uuid(200))
  const REVIEWER = soldierId(10)
  const ORG_REVIEWER = soldierId(11)
  const IN_UNIT = soldierId(12)
  const OUTSIDE = soldierId(13)
  const NOW = '2026-11-04T08:00:00Z'

  const grant = (n: number, grantee: SoldierId, scope: { anchor_type: 'unit' | 'organization'; anchor_unit_id: UnitId | null }) => ({
    id: AccessGrantId.parse(uuid(n)),
    grantee_soldier_id: grantee,
    role_id: ROLE,
    subject_rank_constraint: 'any' as const,
    valid_from: '2026-01-01T00:00:00Z',
    valid_to: null,
    revoked_at: null,
    anchor_soldier_id: null,
    anchor_level_id: null,
    anchor_steps: null,
    include_descendants: false,
    ...scope,
  })
  const member = (n: number, soldier: SoldierId, unit: UnitId) => ({
    id: UnitMembershipId.parse(uuid(n)),
    soldier_id: soldier,
    unit_id: unit,
    membership_type: 'primary' as const,
    valid_from: '2026-01-01',
    valid_to: null,
  })
  const active = (id: SoldierId) => ({ id, command_rank_id: null, status: 'active' as const, archived_at: null })

  const data: PolicyData = {
    baseline_role_id: null,
    units: [
      { id: UNIT, parent_id: null, unit_level_id: null },
      { id: OTHER_UNIT, parent_id: null, unit_level_id: null },
    ],
    soldiers: [active(REVIEWER), active(ORG_REVIEWER), active(IN_UNIT), active(OUTSIDE)],
    command_ranks: [],
    seniority_overrides: [],
    unit_memberships: [member(300, REVIEWER, UNIT), member(301, IN_UNIT, UNIT), member(302, OUTSIDE, OTHER_UNIT)],
    soldier_accounts: [
      { soldier_id: REVIEWER, revoked_at: null },
      { soldier_id: ORG_REVIEWER, revoked_at: null },
    ],
    roles: [{ id: ROLE, archived_at: null }],
    role_permissions: [{ role_id: ROLE, resource: 'accounts', action: 'approve' }],
    rank_role_bindings: [],
    access_grants: [
      grant(400, REVIEWER, { anchor_type: 'unit', anchor_unit_id: UNIT }),
      grant(401, ORG_REVIEWER, { anchor_type: 'organization', anchor_unit_id: null }),
    ],
  }
  const context = createPolicyContext(data, { today: '2026-11-04', now: NOW })

  it('targets the candidates, or the organization without candidates', () => {
    expect(linkReviewTargets([])).toEqual([{ kind: 'organization' }])
    expect(linkReviewTargets([{ soldier_id: IN_UNIT, match: 'name' }])).toEqual([{ kind: 'soldier', soldier_id: IN_UNIT }])
  })

  it('a unit reviewer reviews requests whose candidate is in the unit', () => {
    expect(canReviewLinkRequest(context, REVIEWER, [{ soldier_id: IN_UNIT, match: 'name' }])).toBe(true)
    expect(canReviewLinkRequest(context, REVIEWER, [{ soldier_id: OUTSIDE, match: 'name' }])).toBe(false)
    expect(
      canReviewLinkRequest(context, REVIEWER, [
        { soldier_id: OUTSIDE, match: 'personal_id' },
        { soldier_id: IN_UNIT, match: 'name' },
      ]),
    ).toBe(true)
  })

  it('a request without candidates goes to organization-scope approvers only', () => {
    expect(canReviewLinkRequest(context, REVIEWER, [])).toBe(false)
    expect(canReviewLinkRequest(context, ORG_REVIEWER, [])).toBe(true)
    expect(canReviewLinkRequest(context, IN_UNIT, [])).toBe(false)
  })

  it('a link names a candidate (D-156)', () => {
    const candidates = [{ soldier_id: IN_UNIT, match: 'name' as const }]
    expect(linkTargetIssues(candidates, IN_UNIT)).toEqual([])
    expect(linkTargetIssues(candidates, OUTSIDE)).toEqual([{ path: ['resolution', 'soldier_id'], code: 'not_a_candidate' }])
    expect(linkTargetIssues([], IN_UNIT)).toHaveLength(1)
  })

  it('linking needs accounts:approve over the soldier linked, not over any candidate (D-156)', () => {
    expect(canLinkSoldier(context, REVIEWER, IN_UNIT)).toBe(true)
    expect(canLinkSoldier(context, REVIEWER, OUTSIDE)).toBe(false)
    expect(canLinkSoldier(context, ORG_REVIEWER, OUTSIDE)).toBe(true)
  })

  it('revoking needs accounts:approve over the soldier, and never the own account (D-156)', () => {
    expect(canRevokeAccount(context, REVIEWER, IN_UNIT)).toBe(true)
    expect(canRevokeAccount(context, REVIEWER, OUTSIDE)).toBe(false)
    expect(canRevokeAccount(context, ORG_REVIEWER, ORG_REVIEWER)).toBe(false)
    expect(canRevokeAccount(context, ORG_REVIEWER, REVIEWER)).toBe(true)
  })

  it('only a pending request is reviewed or cancelled', () => {
    for (const status of AccountLinkRequestStatus.options) {
      const expected = status === 'pending' ? [] : [{ path: [], code: 'invalid_transition' }]
      expect(linkRequestTransitionIssues(status)).toEqual(expected)
    }
  })
})

describe('linkEnrichment', () => {
  it('fills a missing personal id from the request, normalized, and never overwrites', () => {
    expect(linkEnrichment({ claimed_personal_id: '012-345' }, null)).toEqual({ personal_id: '12345' })
    expect(linkEnrichment({ claimed_personal_id: '012-345' }, { personal_id: null })).toEqual({ personal_id: '12345' })
    expect(linkEnrichment({ claimed_personal_id: '012-345' }, { personal_id: '999' })).toBeNull()
    expect(linkEnrichment({ claimed_personal_id: null }, null)).toBeNull()
  })
})
