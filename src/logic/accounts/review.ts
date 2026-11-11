import type { LinkCandidate } from '@contracts'
import type { SoldierRow } from '../roster/roster'

// What the review module shows of a request's candidates (D-149, D-150). Pure.

export interface CandidateRow {
  readonly candidate: LinkCandidate
  /** NULL when the reviewer reads no soldier row for the candidate, which the screen says as "a soldier". */
  readonly row: SoldierRow | null
}

/** Each candidate with the soldier the reviewer reads, in the order the adapter gave (personal number first, D-066). */
export function candidateRows(candidates: readonly LinkCandidate[], rows: readonly SoldierRow[]): CandidateRow[] {
  const byId = new Map(rows.map((row) => [row.soldier.id, row]))
  return candidates.map((candidate) => ({ candidate, row: byId.get(candidate.soldier_id) ?? null }))
}
