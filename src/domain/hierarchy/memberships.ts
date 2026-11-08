import {
  IssueCode,
  MembershipType,
  type CalendarDate,
  type Issue,
  type SoldierId,
  type Unit,
  type UnitId,
  type UnitMembership,
} from '@contracts'
import { compareDates, dayBefore, spanCovers, spansOverlap } from '../time'

// Time-bounded unit memberships (D-010). A soldier has at most one primary membership on
// any day (schema exclusion constraint, checked here before the write).

/** The columns membership rules read. Full `UnitMembership` rows fit. */
export type MembershipSpan = Pick<
  UnitMembership,
  'id' | 'soldier_id' | 'unit_id' | 'membership_type' | 'valid_from' | 'valid_to'
>

/** The unit of the soldier's primary membership covering `date`, or NULL (D-054). */
export function primaryUnitOn(
  memberships: Iterable<MembershipSpan>,
  soldierId: SoldierId,
  date: CalendarDate,
): UnitId | null {
  for (const membership of memberships) {
    if (membership.soldier_id !== soldierId) continue
    if (membership.membership_type !== MembershipType.enum.primary) continue
    if (spanCovers(membership, date)) return membership.unit_id
  }
  return null
}

/** A primary membership may not share a day with another primary of the same soldier. */
export function membershipOverlapIssues(
  existing: Iterable<MembershipSpan>,
  candidate: MembershipSpan,
): Issue[] {
  if (candidate.membership_type !== MembershipType.enum.primary) return []
  for (const other of existing) {
    if (other.id === candidate.id || other.soldier_id !== candidate.soldier_id) continue
    if (other.membership_type !== MembershipType.enum.primary) continue
    if (spansOverlap(other, candidate)) {
      return [{ path: ['valid_from'], code: IssueCode.enum.membership_overlap }]
    }
  }
  return []
}

/** The columns of the open row that `changeMembership` reads. Full rows fit. */
export type OpenMembership = Pick<UnitMembership, 'unit_id' | 'valid_from'>

/**
 * Why this membership change is refused (D-097). Paths are the command's. With no open row, only the
 * overlap check of the data layer has anything to say.
 */
export function membershipChangeIssues(
  current: OpenMembership | null,
  effectiveDate: CalendarDate,
  newUnitId: UnitId | null,
): Issue[] {
  if (current === null) return []
  if (current.unit_id === newUnitId) {
    return [{ path: ['new_membership', 'unit_id'], code: IssueCode.enum.no_changes }]
  }
  const order = compareDates(effectiveDate, current.valid_from)
  if (order < 0 || (order === 0 && newUnitId === null)) {
    return [{ path: ['effective_date'], code: IssueCode.enum.range_inverted }]
  }
  return []
}

/** What a change that passed `membershipChangeIssues` writes (D-097). */
export type MembershipChangePlan =
  /** On the open row's first day: the row takes the new unit, and no history is kept. */
  | { readonly kind: 'correct'; readonly unit_id: UnitId }
  /** `close_on` ends the open row, if there is one. `open_unit_id` opens a new row, if there is one. */
  | { readonly kind: 'move'; readonly close_on: CalendarDate | null; readonly open_unit_id: UnitId | null }

export function planMembershipChange(
  current: OpenMembership | null,
  effectiveDate: CalendarDate,
  newUnitId: UnitId | null,
): MembershipChangePlan {
  if (current === null) return { kind: 'move', close_on: null, open_unit_id: newUnitId }
  if (newUnitId !== null && effectiveDate === current.valid_from) return { kind: 'correct', unit_id: newUnitId }
  return { kind: 'move', close_on: dayBefore(effectiveDate), open_unit_id: newUnitId }
}

/** The columns `archiveUnitIssues` reads. Full rows fit. */
export type ArchiveUnitFacts = {
  readonly units: Iterable<Pick<Unit, 'parent_id' | 'archived_at'>>
  /** Memberships of soldiers who are not archived. */
  readonly memberships: Iterable<Pick<UnitMembership, 'unit_id' | 'valid_to'>>
}

/** A unit with a live sub-unit, or with a soldier placed today or later, stays (D-088). */
export function archiveUnitIssues(facts: ArchiveUnitFacts, unitId: UnitId, today: CalendarDate): Issue[] {
  for (const unit of facts.units) {
    if (unit.parent_id === unitId && unit.archived_at === null) {
      return [{ path: [], code: IssueCode.enum.unit_not_empty }]
    }
  }
  for (const membership of facts.memberships) {
    if (membership.unit_id !== unitId) continue
    if (membership.valid_to === null || compareDates(membership.valid_to, today) >= 0) {
      return [{ path: [], code: IssueCode.enum.unit_not_empty }]
    }
  }
  return []
}
