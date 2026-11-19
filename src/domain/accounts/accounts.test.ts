import { describe, expect, it } from 'vitest'
import {
  AccessGrantId,
  AccountLinkRequestStatus,
  AuthUserId,
  RoleId,
  SoldierId,
  UnitId,
  UnitMembershipId,
} from '@contracts'
import { createPolicyContext, type PolicyData } from '../policy'
import {
  approvalEnrichment,
  assessLink,
  autoLinkTarget,
  canReviewLinkRequest,
  linkRequestTransitionIssues,
  namesClose,
  reviewableCandidates,
  normalizeEmail,
  normalizeName,
  normalizePersonalId,
  type LinkClaim,
  type LinkMatchData,
  type NameMatchOptions,
} from './index'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const soldierId = (n: number) => SoldierId.parse(uuid(n))
// Test values; the product's live in config (D-446).
const ASKER = AuthUserId.parse(uuid(900))
const OTHER_IDENTITY = AuthUserId.parse(uuid(901))
const LENIENT: NameMatchOptions = { max_edits: 1, min_typo_length: 4 }

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
  linkedAccount: soldierId(6),
  other: soldierId(7),
  inactive: soldierId(8),
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
      soldier(S.linkedAccount, 'דנה', 'לוי'),
      soldier(S.other, 'Dana', 'Cohen'),
      soldier(S.inactive, 'דנה', 'לוי'),
    ],
    soldier_private: [
      { soldier_id: S.byId, personal_id: '1234567', invite_email: 'Dana@Example.com' },
      { soldier_id: S.both, personal_id: '7654321', invite_email: null },
      { soldier_id: S.archived, personal_id: '1111111', invite_email: 'dana@example.com' },
      { soldier_id: S.linkedAccount, personal_id: '2222222', invite_email: 'dana@example.com' },
    ],
    soldier_accounts: [{ soldier_id: S.linkedAccount, auth_user_id: OTHER_IDENTITY, revoked_at: null }],
  }
}

/** The candidates of a claim with an email no soldier invites. */
const linkCandidates = (claim: Omit<LinkClaim, 'email' | 'auth_user_id'>, data: LinkMatchData) =>
  assessLink({ ...claim, auth_user_id: ASKER, email: 'nobody@example.test' }, data, LENIENT).candidates

describe('assessLink candidates (D-030, D-447)', () => {
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

  it('never offers archived soldiers or soldiers with a live link', () => {
    for (const claimed of ['1111111', '2222222']) {
      const ids = linkCandidates({ claimed_personal_id: claimed, first_name: 'דנה', last_name: 'לוי' }, matchData()).map(
        (candidate) => candidate.soldier_id,
      )
      expect(ids).not.toContain(S.archived)
      expect(ids).not.toContain(S.linkedAccount)
    }
  })

  it('offers a soldier whose link was revoked (D-163)', () => {
    const data = { ...matchData(), soldier_accounts: [{ soldier_id: S.linkedAccount, auth_user_id: OTHER_IDENTITY, revoked_at: '2026-10-01T00:00:00Z' }] }
    const ids = linkCandidates({ claimed_personal_id: '2222222', first_name: 'דנה', last_name: 'לוי' }, data).map(
      (candidate) => candidate.soldier_id,
    )
    expect(ids).toContain(S.linkedAccount)
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

describe('autoLinkTarget on stored data', () => {
  it('links on personal id with a close name, verified invite email included (normalized)', () => {
    const data = { ...matchData(), soldier_private: [...matchData().soldier_private].slice(0, 2) }
    expect(
      autoLinkTarget(
        { auth_user_id: ASKER, personal_id: '01234567', verified_email: 'dana@example.com', first_name: 'Someone', last_name: 'Else' },
        data,
        LENIENT,
      ),
    ).toBe(S.byId)
  })

  it('does not link when another soldier, archived or linked, invites the same email (D-451)', () => {
    expect(
      autoLinkTarget(
        { auth_user_id: ASKER, personal_id: '01234567', verified_email: 'dana@example.com', first_name: 'Someone', last_name: 'Else' },
        matchData(),
        LENIENT,
      ),
    ).toBeNull()
  })

  it('does not link to archived or already-linked soldiers', () => {
    for (const personal_id of ['1111111', '2222222']) {
      expect(
        autoLinkTarget({ auth_user_id: ASKER, personal_id, verified_email: 'x@example.com', first_name: 'דנה', last_name: 'לוי' }, matchData(), LENIENT),
      ).toBeNull()
    }
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
    expect(autoLinkTarget({ auth_user_id: ASKER, personal_id: '123', verified_email: 'dana@example.com', first_name: 'A', last_name: 'B' }, data, LENIENT)).toBeNull()
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

  it('a reviewer reads and may name only the candidates they hold approve over (D-149)', () => {
    const candidates = [
      { soldier_id: OUTSIDE, match: 'personal_id' as const },
      { soldier_id: IN_UNIT, match: 'name' as const },
    ]
    expect(reviewableCandidates(context, REVIEWER, candidates)).toEqual([{ soldier_id: IN_UNIT, match: 'name' }])
    expect(reviewableCandidates(context, ORG_REVIEWER, candidates)).toEqual(candidates)
    expect(reviewableCandidates(context, IN_UNIT, candidates)).toEqual([])
    expect(reviewableCandidates(context, REVIEWER, [])).toEqual([])
  })

  it('a unit reviewer reviews requests whose best candidate is in the unit (D-450)', () => {
    expect(canReviewLinkRequest(context, REVIEWER, [{ soldier_id: IN_UNIT, match: 'name' }])).toBe(true)
    expect(canReviewLinkRequest(context, REVIEWER, [{ soldier_id: OUTSIDE, match: 'name' }])).toBe(false)
    expect(
      canReviewLinkRequest(context, REVIEWER, [
        { soldier_id: OUTSIDE, match: 'personal_id' },
        { soldier_id: IN_UNIT, match: 'name' },
      ]),
    ).toBe(false)
    expect(
      canReviewLinkRequest(context, REVIEWER, [
        { soldier_id: IN_UNIT, match: 'email' },
        { soldier_id: OUTSIDE, match: 'name' },
      ]),
    ).toBe(true)
    expect(
      canReviewLinkRequest(context, ORG_REVIEWER, [
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

  it('only a pending request is reviewed or cancelled', () => {
    for (const status of AccountLinkRequestStatus.options) {
      const expected = status === 'pending' ? [] : [{ path: [], code: 'invalid_transition' }]
      expect(linkRequestTransitionIssues(status)).toEqual(expected)
    }
  })
})

// ============================================================ join linking (D-445 … D-449)


describe('namesClose (D-446)', () => {
  const close = (a: [string, string], b: [string, string]) =>
    namesClose({ first_name: a[0], last_name: a[1] }, { first_name: b[0], last_name: b[1] }, LENIENT)

  it('matches normalized names in order or swapped', () => {
    expect(close(['דָּנָה', 'לוי'], ['דנה', 'לוי'])).toBe(true)
    expect(close(['לוי', 'דנה'], ['דנה', 'לוי'])).toBe(true)
  })

  it('accepts one typo in a long enough part, in either part', () => {
    expect(close(['יוסף', 'כהן'], ['יוסי', 'כהן'])).toBe(true)
    expect(close(['Daniel', 'Levinson'], ['Danial', 'Levinsom'])).toBe(true)
    expect(close(['Levinsn', 'Daniel'], ['Daniel', 'Levinson'])).toBe(true)
  })

  it('refuses two typos in a part, a typo in a short part, and an empty name', () => {
    expect(close(['Daniel', 'Levinson'], ['Danyal', 'Levinson'])).toBe(false)
    expect(close(['דן', 'כהן'], ['רן', 'כהן'])).toBe(false)
    expect(close(['דנה', 'לוי'], ['דינה', 'לוי'])).toBe(false)
    expect(close(['"', 'לוי'], ['', 'לוי'])).toBe(false)
  })
})

describe('assessLink (D-447)', () => {
  const A = soldierId(21)
  const B = soldierId(22)
  const C = soldierId(23)
  const soldier = (id: SoldierId, first_name: string, last_name: string) => ({ id, first_name, last_name, archived_at: null })
  const data = (
    soldiers: LinkMatchData['soldiers'],
    soldier_private: LinkMatchData['soldier_private'] = [],
    soldier_accounts: LinkMatchData['soldier_accounts'] = [],
  ): LinkMatchData => ({ soldiers, soldier_private, soldier_accounts })
  const claim = (overrides: Partial<LinkClaim> = {}): LinkClaim => ({
    auth_user_id: ASKER,
    claimed_personal_id: null,
    first_name: 'Daniel',
    last_name: 'Levinson',
    email: 'dan@example.com',
    ...overrides,
  })
  const priv = (soldier_id: SoldierId, personal_id: string | null, invite_email: string | null) => ({
    soldier_id,
    personal_id,
    invite_email,
  })
  const assess = (request: LinkClaim, matchData: LinkMatchData) => assessLink(request, matchData, LENIENT)

  it('no candidate is no_match', () => {
    expect(assess(claim(), data([soldier(A, 'Someone', 'Else')]))).toEqual({ readiness: 'no_match', candidates: [] })
  })

  it('one close name with no contradiction is ready, a typo included', () => {
    expect(assess(claim({ last_name: 'Levinsom' }), data([soldier(A, 'Daniel', 'Levinson')]))).toEqual({
      readiness: 'ready',
      candidates: [{ soldier_id: A, match: 'name' }],
    })
  })

  it('two close names are several_candidates', () => {
    expect(assess(claim(), data([soldier(A, 'Daniel', 'Levinson'), soldier(B, 'Daniel', 'Levinsom')]))).toMatchObject({
      readiness: 'needs_review',
      reason: 'several_candidates',
    })
  })

  it('a name match holding another personal id is personal_id_differs', () => {
    const matchData = data([soldier(A, 'Daniel', 'Levinson')], [priv(A, '555', null)])
    expect(assess(claim({ claimed_personal_id: '0123' }), matchData)).toMatchObject({
      readiness: 'needs_review',
      reason: 'personal_id_differs',
    })
  })

  it('a name match whose invite email differs is invite_email_differs', () => {
    const matchData = data([soldier(A, 'Daniel', 'Levinson')], [priv(A, null, 'other@example.com')])
    expect(assess(claim(), matchData)).toMatchObject({ readiness: 'needs_review', reason: 'invite_email_differs' })
  })

  it('email and personal id on different soldiers is email_and_id_differ', () => {
    const matchData = data(
      [soldier(A, 'Daniel', 'Levinson'), soldier(B, 'Other', 'Person')],
      [priv(A, '123', null), priv(B, null, 'DAN@example.com ')],
    )
    expect(assess(claim({ claimed_personal_id: '123' }), matchData)).toEqual({
      readiness: 'needs_review',
      reason: 'email_and_id_differ',
      candidates: [
        { soldier_id: A, match: 'personal_id' },
        { soldier_id: B, match: 'email' },
      ],
    })
  })

  it('a personal-id soldier with a different invite email is invite_email_differs', () => {
    const matchData = data([soldier(A, 'Daniel', 'Levinson')], [priv(A, '123', 'other@example.com')])
    expect(assess(claim({ claimed_personal_id: '0-123' }), matchData)).toMatchObject({
      readiness: 'needs_review',
      reason: 'invite_email_differs',
    })
  })

  it('an email soldier holding another personal id is personal_id_differs', () => {
    const matchData = data([soldier(A, 'Other', 'Person')], [priv(A, '999', 'dan@example.com')])
    expect(assess(claim({ claimed_personal_id: '123' }), matchData)).toMatchObject({
      readiness: 'needs_review',
      reason: 'personal_id_differs',
    })
  })

  it('a personal id whose soldier has a name that is not close is name_differs', () => {
    const matchData = data([soldier(A, 'Other', 'Person')], [priv(A, '123', null)])
    expect(assess(claim({ claimed_personal_id: '123' }), matchData)).toEqual({
      readiness: 'needs_review',
      reason: 'name_differs',
      candidates: [{ soldier_id: A, match: 'personal_id' }],
    })
  })

  it('a strong match is ready beside other soldiers matching by name only, and comes first', () => {
    const matchData = data([soldier(B, 'Daniel', 'Levinson'), soldier(A, 'Daniel', 'Levinson')], [priv(A, '123', null)])
    expect(assess(claim({ claimed_personal_id: '123' }), matchData)).toEqual({
      readiness: 'ready',
      candidates: [
        { soldier_id: A, match: 'personal_id' },
        { soldier_id: B, match: 'name' },
      ],
    })
  })

  it('an email match is ready whatever the name', () => {
    const matchData = data([soldier(A, 'Other', 'Person')], [priv(A, null, 'Dan@Example.com')])
    expect(assess(claim(), matchData)).toEqual({ readiness: 'ready', candidates: [{ soldier_id: A, match: 'email' }] })
  })

  it('two soldiers by email are several_candidates', () => {
    const matchData = data(
      [soldier(A, 'X', 'Y'), soldier(B, 'Z', 'W')],
      [priv(A, null, 'dan@example.com'), priv(B, null, 'dan@example.com')],
    )
    expect(assess(claim(), matchData)).toMatchObject({ readiness: 'needs_review', reason: 'several_candidates' })
  })

  it('orders candidates: personal id with a close name, email, personal id alone, name', () => {
    const matchData = data(
      [soldier(C, 'Daniel', 'Levinson'), soldier(B, 'X', 'Y'), soldier(A, 'Other', 'Person')],
      [priv(A, '123', null), priv(B, null, 'dan@example.com')],
    )
    expect(assess(claim({ claimed_personal_id: '123' }), matchData).candidates).toEqual([
      { soldier_id: B, match: 'email' },
      { soldier_id: A, match: 'personal_id' },
      { soldier_id: C, match: 'name' },
    ])
  })

  it('a soldier this identity was unlinked from is previously_unlinked, and never links by itself (D-451)', () => {
    const matchData = data(
      [soldier(A, 'Daniel', 'Levinson')],
      [priv(A, null, 'dan@example.com')],
      [{ soldier_id: A, auth_user_id: ASKER, revoked_at: '2026-11-01T00:00:00Z' }],
    )
    expect(assess(claim(), matchData)).toMatchObject({ readiness: 'needs_review', reason: 'previously_unlinked' })
    const other = data(
      [soldier(A, 'Daniel', 'Levinson')],
      [priv(A, null, 'dan@example.com')],
      [{ soldier_id: A, auth_user_id: OTHER_IDENTITY, revoked_at: '2026-11-01T00:00:00Z' }],
    )
    expect(assess(claim(), other)).toMatchObject({ readiness: 'ready' })
  })

  it('a claimed id or email held by a soldier who cannot be linked contradicts a name match (D-451)', () => {
    const archived = { ...soldier(C, 'Other', 'Person'), archived_at: '2026-10-01T00:00:00Z' }
    const byId = data([soldier(A, 'Daniel', 'Levinson'), archived], [priv(C, '123', null)])
    expect(assess(claim({ claimed_personal_id: '123' }), byId)).toMatchObject({
      readiness: 'needs_review',
      reason: 'personal_id_differs',
    })
    const byEmail = data(
      [soldier(A, 'Daniel', 'Levinson'), soldier(B, 'Other', 'Person')],
      [priv(B, null, 'dan@example.com')],
      [{ soldier_id: B, auth_user_id: OTHER_IDENTITY, revoked_at: null }],
    )
    expect(assess(claim(), byEmail)).toMatchObject({ readiness: 'needs_review', reason: 'invite_email_differs' })
  })

  it('never offers archived soldiers or soldiers with a live link', () => {
    const matchData = data(
      [{ ...soldier(A, 'Daniel', 'Levinson'), archived_at: '2026-10-01T00:00:00Z' }, soldier(B, 'Daniel', 'Levinson')],
      [],
      [{ soldier_id: B, auth_user_id: OTHER_IDENTITY, revoked_at: null }],
    )
    expect(assess(claim(), matchData)).toEqual({ readiness: 'no_match', candidates: [] })
  })
})

describe('autoLinkTarget (D-445)', () => {
  const A = soldierId(31)
  const B = soldierId(32)
  const soldier = (id: SoldierId, first_name: string, last_name: string) => ({ id, first_name, last_name, archived_at: null })
  const target = (claimed: string | null, email: string, matchData: LinkMatchData, names: readonly [string, string] = ['Daniel', 'Levinson']) =>
    autoLinkTarget(
      { auth_user_id: ASKER, personal_id: claimed, verified_email: email, first_name: names[0], last_name: names[1] },
      matchData,
      LENIENT,
    )

  it('links on the invite email alone', () => {
    const matchData: LinkMatchData = {
      soldiers: [soldier(A, 'Other', 'Person')],
      soldier_private: [{ soldier_id: A, personal_id: null, invite_email: 'dan@example.com' }],
      soldier_accounts: [],
    }
    expect(target(null, 'DAN@example.com', matchData)).toBe(A)
  })

  it('links on the personal id with a close name, not with a far one', () => {
    const matchData: LinkMatchData = {
      soldiers: [soldier(A, 'Daniel', 'Levinsom')],
      soldier_private: [{ soldier_id: A, personal_id: '0123', invite_email: null }],
      soldier_accounts: [],
    }
    expect(target('123', 'dan@example.com', matchData)).toBe(A)
    expect(target('123', 'dan@example.com', matchData, ['Someone', 'Else'])).toBeNull()
  })

  it('never links on the name alone, nor on a contradiction', () => {
    const byName: LinkMatchData = { soldiers: [soldier(A, 'Daniel', 'Levinson')], soldier_private: [], soldier_accounts: [] }
    expect(target(null, 'dan@example.com', byName)).toBeNull()
    const split: LinkMatchData = {
      soldiers: [soldier(A, 'Daniel', 'Levinson'), soldier(B, 'Other', 'Person')],
      soldier_private: [
        { soldier_id: A, personal_id: '123', invite_email: null },
        { soldier_id: B, personal_id: null, invite_email: 'dan@example.com' },
      ],
      soldier_accounts: [],
    }
    expect(target('123', 'dan@example.com', split)).toBeNull()
    const otherEmail: LinkMatchData = {
      soldiers: [soldier(A, 'Daniel', 'Levinson')],
      soldier_private: [{ soldier_id: A, personal_id: '123', invite_email: 'other@example.com' }],
      soldier_accounts: [],
    }
    expect(target('123', 'dan@example.com', otherEmail)).toBeNull()
  })
})

describe('approvalEnrichment (D-449)', () => {
  const request = { claimed_personal_id: '012-345', email: ' Dan@Example.com ' }

  it('fills a missing personal id and a missing invite email, normalized', () => {
    expect(approvalEnrichment(request, null)).toEqual({ personal_id: '12345', invite_email: 'dan@example.com' })
    expect(approvalEnrichment(request, { personal_id: null, invite_email: null })).toEqual({
      personal_id: '12345',
      invite_email: 'dan@example.com',
    })
  })

  it('never overwrites a value', () => {
    expect(approvalEnrichment(request, { personal_id: '999', invite_email: null })).toEqual({
      invite_email: 'dan@example.com',
    })
    expect(approvalEnrichment(request, { personal_id: null, invite_email: 'x@example.com' })).toEqual({
      personal_id: '12345',
    })
    expect(approvalEnrichment(request, { personal_id: '999', invite_email: 'x@example.com' })).toBeNull()
    expect(approvalEnrichment({ claimed_personal_id: null, email: 'a@b.co' }, { personal_id: null, invite_email: 'a@b.co' })).toBeNull()
  })
})
