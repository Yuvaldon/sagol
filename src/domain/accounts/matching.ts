import {
  AccountLinkRequestStatus,
  IssueCode,
  LinkCandidateMatch,
  LinkReadiness,
  LinkReviewReason,
  type AccountLinkRequest,
  type LinkAssessment,
  type Issue,
  type LinkCandidate,
  type Permission,
  type Soldier,
  type SoldierAccount,
  type SoldierId,
  type SoldierPrivate,
} from '@contracts'
import { can, soldierTarget, type PolicyContext } from '../policy'
import { normalizeEmail, normalizeName, normalizePersonalId } from './normalize'

// Account linking (D-005, D-030, D-066, D-445 … D-450). Candidates are shown to the reviewer only, never to the
// requester; the data layer filters them by permission before they leave the adapter.

/** What matching reads. Full contract rows fit. */
export interface LinkMatchData {
  readonly soldiers: Iterable<Pick<Soldier, 'id' | 'first_name' | 'last_name' | 'archived_at'>>
  readonly soldier_private: Iterable<Pick<SoldierPrivate, 'soldier_id' | 'personal_id' | 'invite_email'>>
  /** Every account row; a revoked one frees the soldier for a new link (D-163). */
  readonly soldier_accounts: Iterable<Pick<SoldierAccount, 'soldier_id' | 'auth_user_id' | 'revoked_at'>>
}

/** How lenient a close name is (D-446). The values live in `config`. */
export interface NameMatchOptions {
  /** Edits allowed between two name parts. */
  readonly max_edits: number
  /** A part shorter than this must be equal. */
  readonly min_typo_length: number
}

/** What a request claims: the names, the personal id if given, and the identity's email. */
export type LinkClaim = Pick<
  AccountLinkRequest,
  'auth_user_id' | 'claimed_personal_id' | 'first_name' | 'last_name' | 'email'
>
type SoldierNames = Pick<Soldier, 'first_name' | 'last_name'>

interface LinkableSoldier extends SoldierNames {
  readonly id: SoldierId
  /** Normalized, or NULL. */
  readonly personal_id: string | null
  /** Normalized, or NULL. */
  readonly invite_email: string | null
}

/** Soldiers that can still be linked, with their private details: not archived, no live link (D-066, D-163). */
function linkable(data: LinkMatchData): LinkableSoldier[] {
  const withAccount = new Set<SoldierId>()
  for (const account of data.soldier_accounts) {
    if (account.revoked_at === null) withAccount.add(account.soldier_id)
  }
  const details = new Map<SoldierId, Pick<SoldierPrivate, 'personal_id' | 'invite_email'>>()
  for (const row of data.soldier_private) details.set(row.soldier_id, row)
  return [...data.soldiers]
    .filter((soldier) => soldier.archived_at === null && !withAccount.has(soldier.id))
    .map((soldier) => {
      const personalId = details.get(soldier.id)?.personal_id ?? null
      const inviteEmail = details.get(soldier.id)?.invite_email ?? null
      return {
        id: soldier.id,
        first_name: soldier.first_name,
        last_name: soldier.last_name,
        personal_id: personalId === null ? null : normalizePersonalId(personalId),
        invite_email: inviteEmail === null ? null : normalizeEmail(inviteEmail),
      }
    })
}

/**
 * Who holds each personal id and invite email, normalized, over every soldier: an archived or linked one too, so a
 * detail a soldier who cannot be linked holds still contradicts another candidate (D-451).
 */
function heldDetails(data: LinkMatchData): { byId: Map<string, SoldierId>; byEmail: Map<string, SoldierId> } {
  const byId = new Map<string, SoldierId>()
  const byEmail = new Map<string, SoldierId>()
  for (const row of data.soldier_private) {
    const personalId = row.personal_id === null ? null : normalizePersonalId(row.personal_id)
    if (personalId !== null) byId.set(personalId, row.soldier_id)
    if (row.invite_email !== null) byEmail.set(normalizeEmail(row.invite_email), row.soldier_id)
  }
  return { byId, byEmail }
}

/** Levenshtein distance, stopping early once it passes `limit`. */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost)
      current.push(value)
      rowMin = Math.min(rowMin, value)
    }
    if (rowMin > limit) return limit + 1
    previous = current
  }
  return previous[b.length] ?? limit + 1
}

/** Two normalized name parts are close: equal, or a light typo apart when both are long enough (D-446). */
function partsClose(a: string, b: string, options: NameMatchOptions): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < options.min_typo_length) return false
  return editDistance(a, b, options.max_edits) <= options.max_edits
}

/**
 * The names are close (D-066, D-446): after `normalizeName`, first and last match in order or swapped, each part
 * equal or within the allowed typos. A name that normalizes to nothing matches nobody.
 */
export function namesClose(claim: SoldierNames, soldier: SoldierNames, options: NameMatchOptions): boolean {
  const claimFirst = normalizeName(claim.first_name)
  const claimLast = normalizeName(claim.last_name)
  if (claimFirst === '' || claimLast === '') return false
  const first = normalizeName(soldier.first_name)
  const last = normalizeName(soldier.last_name)
  const close = (a: string, b: string) => partsClose(a, b, options)
  return (close(first, claimFirst) && close(last, claimLast)) || (close(first, claimLast) && close(last, claimFirst))
}

/** The one element, or NULL when there are none; `several` when more than one. */
function single<T>(items: readonly T[]): T | null | 'several' {
  if (items.length > 1) return 'several'
  return items[0] ?? null
}

/**
 * A request's candidates and readiness (D-447), judged over every linkable soldier. Candidates come best first:
 * personal id with a close name, invite email, personal id with a name that is not close, close name only; a soldier
 * once, under its strongest match; ties by `data.soldiers` order. The data layer narrows the candidates to the ones
 * the reviewer approves over; the readiness stays as judged here.
 */
export function assessLink(request: LinkClaim, data: LinkMatchData, options: NameMatchOptions): LinkAssessment {
  const soldiers = linkable(data)
  const claimedId = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  const email = normalizeEmail(request.email)
  const close = (soldier: LinkableSoldier) => namesClose(request, soldier, options)

  const byId = soldiers.filter((soldier) => claimedId !== null && soldier.personal_id === claimedId)
  const byEmail = soldiers.filter((soldier) => soldier.invite_email === email)
  const byName = soldiers.filter(close)
  /** Soldiers this identity was unlinked from: never linked again without a person (D-451). */
  const unlinkedFrom = new Set<SoldierId>()
  for (const account of data.soldier_accounts) {
    if (account.revoked_at !== null && account.auth_user_id === request.auth_user_id) unlinkedFrom.add(account.soldier_id)
  }
  /** The claimed id and email as any soldier holds them, linkable or not (D-451). */
  const holders = heldDetails(data)

  const seen = new Set<SoldierId>()
  const candidates: LinkCandidate[] = []
  const add = (list: readonly LinkableSoldier[], match: LinkCandidate['match']) => {
    for (const soldier of list) {
      if (seen.has(soldier.id)) continue
      seen.add(soldier.id)
      candidates.push({ soldier_id: soldier.id, match })
    }
  }
  add(byId.filter(close), LinkCandidateMatch.enum.personal_id)
  add(byEmail, LinkCandidateMatch.enum.email)
  add(byId, LinkCandidateMatch.enum.personal_id)
  add(byName, LinkCandidateMatch.enum.name)

  const review = (reason: LinkReviewReason): LinkAssessment => ({
    readiness: LinkReadiness.enum.needs_review,
    reason,
    candidates,
  })
  const ready: LinkAssessment = { readiness: LinkReadiness.enum.ready, candidates }
  /** The contradictions a single soldier can hold against the request. */
  const contradiction = (soldier: LinkableSoldier): LinkReviewReason | null => {
    if (unlinkedFrom.has(soldier.id)) return LinkReviewReason.enum.previously_unlinked
    const emailHolder = holders.byEmail.get(email)
    if (soldier.invite_email !== null && soldier.invite_email !== email) return LinkReviewReason.enum.invite_email_differs
    if (emailHolder !== undefined && emailHolder !== soldier.id) return LinkReviewReason.enum.invite_email_differs
    if (claimedId !== null && soldier.personal_id !== null && soldier.personal_id !== claimedId) {
      return LinkReviewReason.enum.personal_id_differs
    }
    const idHolder = claimedId === null ? undefined : holders.byId.get(claimedId)
    if (idHolder !== undefined && idHolder !== soldier.id) return LinkReviewReason.enum.personal_id_differs
    return null
  }

  const idOne = single(byId)
  const emailOne = single(byEmail)
  if (idOne === 'several' || emailOne === 'several') return review(LinkReviewReason.enum.several_candidates)
  if (idOne !== null && emailOne !== null && idOne.id !== emailOne.id) {
    return review(LinkReviewReason.enum.email_and_id_differ)
  }
  const strong = idOne ?? emailOne
  if (strong !== null) {
    const reason = contradiction(strong)
    if (reason !== null) return review(reason)
    if (strong === idOne && emailOne === null && !close(strong)) return review(LinkReviewReason.enum.name_differs)
    return ready
  }

  const nameOne = single(byName)
  if (nameOne === null) return { readiness: LinkReadiness.enum.no_match, candidates }
  if (nameOne === 'several') return review(LinkReviewReason.enum.several_candidates)
  const reason = contradiction(nameOne)
  return reason === null ? ready : review(reason)
}

/** What onboarding claims: the names, the personal id if given, and the email the provider verified. */
export interface AutoLinkTargetClaim extends SoldierNames {
  readonly auth_user_id: AccountLinkRequest['auth_user_id']
  readonly personal_id: string | null
  readonly verified_email: string
}

/** Matches strong enough to link with no one in the loop (D-445). */
const STRONG_MATCHES: ReadonlySet<LinkCandidate['match']> = new Set([
  LinkCandidateMatch.enum.personal_id,
  LinkCandidateMatch.enum.email,
])

/**
 * The soldier a sign-in links to without review (D-445): the request would be `ready` (D-447) and its one candidate
 * was found by invite email, or by personal id with a close name. Otherwise NULL, and onboarding creates a pending
 * request. The caller passes only an email the provider verified (D-005).
 */
export function autoLinkTarget(claim: AutoLinkTargetClaim, data: LinkMatchData, options: NameMatchOptions): SoldierId | null {
  const assessment = assessLink(
    {
      auth_user_id: claim.auth_user_id,
      claimed_personal_id: claim.personal_id,
      first_name: claim.first_name,
      last_name: claim.last_name,
      email: claim.verified_email,
    },
    data,
    options,
  )
  const [best] = assessment.candidates
  if (assessment.readiness !== LinkReadiness.enum.ready || best === undefined) return null
  return STRONG_MATCHES.has(best.match) ? best.soldier_id : null
}

export const ACCOUNT_REVIEW_PERMISSION = {
  resource: 'accounts',
  action: 'approve',
} as const satisfies Permission

/**
 * The candidates a reviewer may read and name: those over which they hold `accounts:approve` (D-149, OI-034). The data layer
 * shows no other candidate and refuses a `link` to a soldier outside this list.
 */
export function reviewableCandidates(
  context: PolicyContext,
  actorId: SoldierId,
  candidates: readonly LinkCandidate[],
): LinkCandidate[] {
  return candidates.filter((candidate) =>
    can(context, actorId, ACCOUNT_REVIEW_PERMISSION, soldierTarget(candidate.soldier_id)),
  )
}

/**
 * True when the actor may see and review the request (D-066, D-450): they hold `accounts:approve` over its best
 * candidate (the first, D-447), or, when it has none, at organization scope.
 */
export function canReviewLinkRequest(
  context: PolicyContext,
  actorId: SoldierId,
  candidates: readonly LinkCandidate[],
): boolean {
  const [best] = candidates
  if (best === undefined) return can(context, actorId, ACCOUNT_REVIEW_PERMISSION, { kind: 'organization' })
  return can(context, actorId, ACCOUNT_REVIEW_PERMISSION, soldierTarget(best.soldier_id))
}

/** Only a pending request is reviewed or cancelled; anything else is `invalid_transition`. */
export function linkRequestTransitionIssues(status: AccountLinkRequestStatus): Issue[] {
  if (status === AccountLinkRequestStatus.enum.pending) return []
  return [{ path: [], code: IssueCode.enum.invalid_transition }]
}

/** What approval may fill on the soldier (D-030, D-449). */
export interface LinkEnrichment {
  readonly personal_id?: string
  readonly invite_email?: string
}

/**
 * Fields approval fills on the linked soldier (D-030, D-449): the claimed personal id, normalized, when the soldier has
 * none, and the requester's email, normalized, when the soldier has no invite email. Names are never missing (NOT
 * NULL) and are never overwritten. NULL = nothing to fill. Whether another soldier holds a value is the data layer's
 * check (D-149).
 */
export function approvalEnrichment(
  request: Pick<AccountLinkRequest, 'claimed_personal_id' | 'email'>,
  soldierPrivate: Pick<SoldierPrivate, 'personal_id' | 'invite_email'> | null,
): LinkEnrichment | null {
  const claimed = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  const personalId = (soldierPrivate?.personal_id ?? null) === null ? claimed : null
  const email = normalizeEmail(request.email)
  const inviteEmail = (soldierPrivate?.invite_email ?? null) === null && email !== '' ? email : null
  if (personalId === null && inviteEmail === null) return null
  return {
    ...(personalId === null ? {} : { personal_id: personalId }),
    ...(inviteEmail === null ? {} : { invite_email: inviteEmail }),
  }
}

// Legacy matching, kept until the data layer moves to the functions above (D-127).

function legacyNamesMatch(claim: SoldierNames, soldier: SoldierNames): boolean {
  const claimFirst = normalizeName(claim.first_name)
  const claimLast = normalizeName(claim.last_name)
  if (claimFirst === '' || claimLast === '') return false
  const first = normalizeName(soldier.first_name)
  const last = normalizeName(soldier.last_name)
  return (first === claimFirst && last === claimLast) || (first === claimLast && last === claimFirst)
}

function legacyPersonalIds(data: LinkMatchData): Map<SoldierId, string> {
  const ids = new Map<SoldierId, string>()
  for (const row of data.soldier_private) {
    const normalized = row.personal_id === null ? null : normalizePersonalId(row.personal_id)
    if (normalized !== null) ids.set(row.soldier_id, normalized)
  }
  return ids
}

/** Legacy: candidates by exact personal id, then exact names (D-030). */
export function linkCandidates(
  request: Pick<AccountLinkRequest, 'claimed_personal_id' | 'first_name' | 'last_name'>,
  data: LinkMatchData,
): LinkCandidate[] {
  const soldiers = linkable(data)
  const claimedId = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  const personalIds = legacyPersonalIds(data)
  const byId = soldiers.filter((soldier) => claimedId !== null && personalIds.get(soldier.id) === claimedId)
  const matchedIds = new Set(byId.map((soldier) => soldier.id))
  const byName = soldiers.filter((soldier) => !matchedIds.has(soldier.id) && legacyNamesMatch(request, soldier))
  return [
    ...byId.map((soldier) => ({ soldier_id: soldier.id, match: 'personal_id' as const })),
    ...byName.map((soldier) => ({ soldier_id: soldier.id, match: 'name' as const })),
  ]
}

/** Legacy: what onboarding claims, with the email the provider verified. */
export interface AutoLinkClaim {
  readonly personal_id: string | null
  readonly verified_email: string
}

/** Legacy: one linkable soldier with both the personal id and the invite email (D-005). */
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

/** Legacy: the claimed personal id when the soldier has none (D-030). */
export function linkEnrichment(
  request: Pick<AccountLinkRequest, 'claimed_personal_id'>,
  soldierPrivate: Pick<SoldierPrivate, 'personal_id'> | null,
): { personal_id: string } | null {
  if (soldierPrivate !== null && soldierPrivate.personal_id !== null) return null
  const claimed = request.claimed_personal_id === null ? null : normalizePersonalId(request.claimed_personal_id)
  return claimed === null ? null : { personal_id: claimed }
}
