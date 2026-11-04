import {
  IssueCode,
  type CalendarDate,
  type Issue,
  type SeniorityOverride,
  type SoldierId,
} from '@contracts'
import { spanCovers, spansOverlap } from '../time'

// Effective seniority (D-029): the active personal override, else the rank's seniority.
// Derived, never stored.

/** The columns seniority rules read. Full `SeniorityOverride` rows fit. */
export type SeniorityOverrideSpan = Pick<
  SeniorityOverride,
  'id' | 'soldier_id' | 'seniority' | 'valid_from' | 'valid_to' | 'revoked_at'
>

/** The soldier's non-revoked override covering `date`, or NULL. */
export function activeOverrideOn(
  overrides: Iterable<SeniorityOverrideSpan>,
  soldierId: SoldierId,
  date: CalendarDate,
): SeniorityOverrideSpan | null {
  for (const override of overrides) {
    if (override.soldier_id !== soldierId || override.revoked_at !== null) continue
    if (spanCovers(override, date)) return override
  }
  return null
}

/**
 * Effective seniority on `date`: the active override, else the rank's seniority, else NULL
 * (no rank and no override).
 */
export function effectiveSeniority(
  rankSeniority: number | null,
  overrides: Iterable<SeniorityOverrideSpan>,
  soldierId: SoldierId,
  date: CalendarDate,
): number | null {
  return activeOverrideOn(overrides, soldierId, date)?.seniority ?? rankSeniority
}

/** At most one non-revoked override per soldier per day (schema exclusion constraint). */
export function seniorityOverrideOverlapIssues(
  existing: Iterable<SeniorityOverrideSpan>,
  candidate: SeniorityOverrideSpan,
): Issue[] {
  if (candidate.revoked_at !== null) return []
  for (const other of existing) {
    if (other.id === candidate.id || other.soldier_id !== candidate.soldier_id) continue
    if (other.revoked_at !== null) continue
    if (spansOverlap(other, candidate)) {
      return [{ path: ['valid_from'], code: IssueCode.enum.seniority_override_overlap }]
    }
  }
  return []
}
