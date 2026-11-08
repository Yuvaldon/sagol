import {
  AccountLinkRequestStatus,
  IssueCode,
  type AccountLinkRequest,
  type Issue,
  type Permission,
  type PolicyTarget,
  type Soldier,
  type SoldierAccount,
  type SoldierId,
  type SoldierPrivate,
} from '@contracts'
import { can, type PolicyContext } from '../policy'
import { normalizeEmail, normalizeName, normalizePersonalId } from './normalize'

// Account linking (D-005, D-030, D-066). Candidates are shown to the reviewer only, never to
// the requester; the data layer filters them by permission before they leave the adapter.

/** What matching reads. Full contract rows fit. */
export interface LinkMatchData {
  readonly soldiers: Iterable<Pick<Soldier, 'id' | 'first_name' | 'last_name' | 'archived_at'>>
  readonly soldier_private: Iterable<Pick<SoldierPrivate, 'soldier_id' | 'personal_id' | 'invite_email'>>
  /** Every account row, revoked included: the schema allows one account per soldier. */
  readonly soldier_accounts: Iterable<Pick<SoldierAccount, 'soldier_id'>>
}

export type LinkMatchKind = 'personal_id' | 'name'

export interface LinkCandidate {
  readonly soldier_id: SoldierId
  readonly match: LinkMatchKind
}

type LinkClaim = Pick<AccountLinkRequest, 'claimed_personal_id' | 'first_name' | 'last_name'>
type SoldierNames = Pick<Soldier, 'first_name' | 'last_name'>

/** Soldiers that can still be linked: not archived and without an account row (D-066). */
function linkable(data: LinkMatchData): Pick<Soldier, 'id' | 'first_name' | 'last_name'>[] {
  const withAccount = new Set<SoldierId>()
  for (const account of data.soldier_accounts) withAccount.add(account.soldier_id)
  return [...data.soldiers].filter((soldier) => soldier.archived_at === null && !withAccount.has(soldier.id))
}

/** Normalized first and last names are equal, in order or swapped (D-066). */
function namesMatch(claim: SoldierNames, soldier: SoldierNames): boolean {
  const claimFirst = normalizeName(claim.first_name)
  const claimLast = normalizeName(claim.last_name)
  if (claimFirst === '' || claimLast === '') return false
  const first = normalizeName(soldier.first_name)
  const last = normalizeName(soldier.last_name)
  return (first === claimFirst && last === claimLast) || (first === claimLast && last === claimFirst)
}

function personalIdsOf(data: LinkMatchData): Map<SoldierId, string> {
  const ids = new Map<SoldierId, string>()
  for (const row of data.soldier_private) {
    const normalized = row.personal_id === null ? null : normalizePersonalId(row.personal_id)
    if (normalized !== null) ids.set(row.soldier_id, normalized)
  }
  return ids
}

/**
 * Candidate soldiers for a link request (D-030): exact personal id first, then normalized
 * names. A soldier appears once, under its strongest match. Order within a kind follows
 * `data.soldiers`.
 */
export function linkCandidates(request: LinkClaim, data: LinkMatchData): LinkCandidate[] {
  const soldiers = linkable(data)
  const claimedId = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  const personalIds = personalIdsOf(data)
  const byId = soldiers.filter((soldier) => claimedId !== null && personalIds.get(soldier.id) === claimedId)
  const matchedIds = new Set(byId.map((soldier) => soldier.id))
  const byName = soldiers.filter((soldier) => !matchedIds.has(soldier.id) && namesMatch(request, soldier))
  return [
    ...byId.map((soldier) => ({ soldier_id: soldier.id, match: 'personal_id' as const })),
    ...byName.map((soldier) => ({ soldier_id: soldier.id, match: 'name' as const })),
  ]
}

/** What onboarding claims, with the email the provider verified. */
export interface AutoLinkClaim {
  readonly personal_id: string | null
  readonly verified_email: string
}

/**
 * The soldier a sign-in links to without review (D-005, D-030): exactly one linkable soldier
 * whose personal id matches AND whose invite email equals the verified email. Otherwise
 * NULL, and onboarding creates a pending request.
 */
export function autoLinkSoldier(claim: AutoLinkClaim, data: LinkMatchData): SoldierId | null {
  const claimedId = claim.personal_id === null ? null : normalizePersonalId(claim.personal_id)
  if (claimedId === null) return null
  const email = normalizeEmail(claim.verified_email)
  const linkableIds = new Set(linkable(data).map((soldier) => soldier.id))
  const matches = [...data.soldier_private].filter(
    (row) =>
      linkableIds.has(row.soldier_id) &&
      row.personal_id !== null &&
      normalizePersonalId(row.personal_id) === claimedId &&
      row.invite_email !== null &&
      normalizeEmail(row.invite_email) === email,
  )
  const [only, ...rest] = matches
  return only !== undefined && rest.length === 0 ? only.soldier_id : null
}

export const ACCOUNT_REVIEW_PERMISSION = {
  resource: 'accounts',
  action: 'approve',
} as const satisfies Permission

/** The targets a reviewer needs `accounts:approve` over: the candidates, else the organization (D-030). */
export function linkReviewTargets(candidates: readonly LinkCandidate[]): PolicyTarget[] {
  if (candidates.length === 0) return [{ kind: 'organization' }]
  return candidates.map((candidate) => ({ kind: 'soldier', soldier_id: candidate.soldier_id }))
}

/** True when the actor may see and review the request: `accounts:approve` over one target. */
export function canReviewLinkRequest(
  context: PolicyContext,
  actorId: SoldierId,
  candidates: readonly LinkCandidate[],
): boolean {
  return linkReviewTargets(candidates).some((target) => can(context, actorId, ACCOUNT_REVIEW_PERMISSION, target))
}

/** Only a pending request is reviewed or cancelled; anything else is `invalid_transition`. */
export function linkRequestTransitionIssues(status: AccountLinkRequestStatus): Issue[] {
  if (status === AccountLinkRequestStatus.enum.pending) return []
  return [{ path: [], code: IssueCode.enum.invalid_transition }]
}

/**
 * Fields approval fills on the linked soldier (D-030): the claimed personal id, normalized,
 * when the soldier has none. Names are never missing (NOT NULL) and are never overwritten.
 * NULL = nothing to fill.
 */
export function linkEnrichment(
  request: Pick<AccountLinkRequest, 'claimed_personal_id'>,
  soldierPrivate: Pick<SoldierPrivate, 'personal_id'> | null,
): { personal_id: string } | null {
  if (soldierPrivate !== null && soldierPrivate.personal_id !== null) return null
  const claimed = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  return claimed === null ? null : { personal_id: claimed }
}
