import { describe, expect, it } from 'vitest'
import { SoldierId, UnitId, UnitLevelId, UnitMembershipId } from '@contracts'
import {
  ancestorAtSteps,
  ancestorOrSelfAtLevel,
  ancestorsOf,
  archiveUnitIssues,
  buildUnitTree,
  depthOf,
  descendantsOf,
  isAncestorOrSelf,
  membershipOverlapIssues,
  moveUnitIssues,
  primaryUnitOn,
  type MembershipSpan,
  type UnitNode,
} from './index'

// Sample hierarchy, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const unit = (n: number) => UnitId.parse(uuid(n))
const level = (n: number) => UnitLevelId.parse(uuid(100 + n))

const COMPANY = level(1)
const PLATOON = level(2)
const C = unit(1)
const P1 = unit(2)
const P2 = unit(3)
const S11 = unit(4)
const S12 = unit(5)
const S21 = unit(6)
const LONE = unit(7)

const node = (id: UnitId, parent: UnitId | null, levelId: UnitLevelId | null): UnitNode => ({
  id,
  parent_id: parent,
  unit_level_id: levelId,
})

const tree = buildUnitTree([
  node(C, null, COMPANY),
  node(P1, C, PLATOON),
  node(P2, C, PLATOON),
  node(S11, P1, null),
  node(S12, P1, null),
  node(S21, P2, null),
  node(LONE, null, null),
])

describe('hierarchy', () => {
  it('derives ancestors, descendants and depth from parent_id', () => {
    expect(ancestorsOf(tree, S11)).toEqual([P1, C])
    expect(ancestorsOf(tree, C)).toEqual([])
    expect(descendantsOf(tree, C)).toEqual([P1, P2, S11, S12, S21])
    expect(descendantsOf(tree, S21)).toEqual([])
    expect(depthOf(tree, S21)).toBe(2)
    expect(depthOf(tree, LONE)).toBe(0)
  })

  it('answers ancestor-or-self', () => {
    expect(isAncestorOrSelf(tree, C, S21)).toBe(true)
    expect(isAncestorOrSelf(tree, S21, S21)).toBe(true)
    expect(isAncestorOrSelf(tree, P1, S21)).toBe(false)
    expect(isAncestorOrSelf(tree, S21, C)).toBe(false)
  })

  it('resolves N steps up and fails past the top (D-055)', () => {
    expect(ancestorAtSteps(tree, S11, 1)).toBe(P1)
    expect(ancestorAtSteps(tree, S11, 2)).toBe(C)
    expect(ancestorAtSteps(tree, S11, 3)).toBeNull()
    expect(ancestorAtSteps(tree, S11, 0)).toBeNull()
  })

  it('resolves the ancestor at a level, the unit itself included (D-055)', () => {
    expect(ancestorOrSelfAtLevel(tree, S11, COMPANY)).toBe(C)
    expect(ancestorOrSelfAtLevel(tree, S11, PLATOON)).toBe(P1)
    expect(ancestorOrSelfAtLevel(tree, P2, PLATOON)).toBe(P2)
    expect(ancestorOrSelfAtLevel(tree, LONE, COMPANY)).toBeNull()
    expect(ancestorOrSelfAtLevel(tree, unit(99), COMPANY)).toBeNull()
  })

  it('rejects a move under the unit itself or a descendant (D-009)', () => {
    const cycle = [{ path: ['parent_id'], code: 'unit_cycle' }]
    expect(moveUnitIssues(tree, P1, S11)).toEqual(cycle)
    expect(moveUnitIssues(tree, P1, P1)).toEqual(cycle)
    expect(moveUnitIssues(tree, P1, P2)).toEqual([])
    expect(moveUnitIssues(tree, C, LONE)).toEqual([])
    expect(moveUnitIssues(tree, P1, null)).toEqual([])
  })

  it('terminates on corrupt cyclic data', () => {
    const corrupt = buildUnitTree([node(unit(1), unit(2), null), node(unit(2), unit(1), null)])
    expect(ancestorsOf(corrupt, unit(1))).toEqual([unit(2)])
    expect(descendantsOf(corrupt, unit(1))).toEqual([unit(2)])
  })
})

describe('memberships', () => {
  const soldier = SoldierId.parse(uuid(201))
  const other = SoldierId.parse(uuid(202))
  const span = (
    n: number,
    unitId: UnitId,
    from: string,
    to: string | null,
    type: MembershipSpan['membership_type'] = 'primary',
    soldierId = soldier,
  ): MembershipSpan => ({
    id: UnitMembershipId.parse(uuid(300 + n)),
    soldier_id: soldierId,
    unit_id: unitId,
    membership_type: type,
    valid_from: from,
    valid_to: to,
  })
  const history = [
    span(1, S11, '2026-01-01', '2026-06-30'),
    span(2, S21, '2026-07-01', null),
    span(3, P1, '2026-01-01', null, 'attached'),
  ]

  it('finds the primary unit on a date (D-054)', () => {
    expect(primaryUnitOn(history, soldier, '2026-06-30')).toBe(S11)
    expect(primaryUnitOn(history, soldier, '2026-07-01')).toBe(S21)
    expect(primaryUnitOn(history, soldier, '2025-12-31')).toBeNull()
    expect(primaryUnitOn(history, other, '2026-07-01')).toBeNull()
  })

  it('rejects overlapping primary memberships of one soldier', () => {
    const overlap = [{ path: ['valid_from'], code: 'membership_overlap' }]
    expect(membershipOverlapIssues(history, span(4, S12, '2026-06-30', null))).toEqual(overlap)
    expect(membershipOverlapIssues(history, span(4, S12, '2025-01-01', '2025-12-31'))).toEqual([])
    // The row itself, attachments and other soldiers do not conflict.
    expect(membershipOverlapIssues(history, span(2, S12, '2026-07-01', null))).toEqual([])
    expect(membershipOverlapIssues(history, span(4, S12, '2026-08-01', null, 'attached'))).toEqual([])
    expect(membershipOverlapIssues(history, span(4, S12, '2026-08-01', null, 'primary', other))).toEqual([])
  })
})

describe('archiving a unit (D-088)', () => {
  const TODAY = '2026-11-08'
  const refused = [{ path: [], code: 'unit_not_empty' }]
  const live = { parent_id: P1, archived_at: null }

  it('allows an empty unit', () => {
    expect(archiveUnitIssues({ units: [], memberships: [] }, P1, TODAY)).toEqual([])
  })

  it('refuses a unit with a live sub-unit, and ignores archived ones and other units', () => {
    expect(archiveUnitIssues({ units: [live], memberships: [] }, P1, TODAY)).toEqual(refused)
    const archived = { parent_id: P1, archived_at: '2026-11-01T00:00:00Z' }
    expect(archiveUnitIssues({ units: [archived], memberships: [] }, P1, TODAY)).toEqual([])
    expect(archiveUnitIssues({ units: [live], memberships: [] }, P2, TODAY)).toEqual([])
  })

  it('refuses a placement that is open, ends today or ends later, and allows a past one', () => {
    const issues = (valid_to: string | null) =>
      archiveUnitIssues({ units: [], memberships: [{ unit_id: P1, valid_to }] }, P1, TODAY)
    expect(issues(null)).toEqual(refused)
    expect(issues(TODAY)).toEqual(refused)
    expect(issues('2026-12-01')).toEqual(refused)
    expect(issues('2026-11-07')).toEqual([])
  })

  it('counts only placements in this unit', () => {
    const memberships = [{ unit_id: P2, valid_to: null }]
    expect(archiveUnitIssues({ units: [], memberships }, P1, TODAY)).toEqual([])
  })
})
