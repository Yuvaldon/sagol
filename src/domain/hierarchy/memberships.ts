import {
  IssueCode,
  MembershipType,
  type CalendarDate,
  type Issue,
  type SoldierId,
  type UnitId,
  type UnitMembership,
} from '@contracts'
import { spanCovers, spansOverlap } from '../time'

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
