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
import { compareDates, spanCovers, spansOverlap } from '../time'

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
