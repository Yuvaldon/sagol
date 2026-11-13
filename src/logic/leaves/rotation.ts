import { IssueCode, type CalendarDate, type Deployment, type DeploymentId, type Issue, type SoldierId } from '@contracts'
import { compareCodeUnits, compareDates, leaveRotationIssues, wholeUnitRotationIssues, type RotationMembership } from '@domain'
import { useCallback, useMemo } from 'react'
import { liveDeployments } from '../deployments/deployments'
import { useDeployments, useRotationMembership } from '../deployments/hooks'
import { scopeRotation, useDateWindow } from '../view-state/window'

// The rotation a new request belongs to (D-216, D-220). The form does not ask for it: it is the rotation in which every
// soldier chosen serves on the request's days, the one in view first. Pure part first, then the hook.

export interface RequestRotation {
  /** NULL when no rotation holds the request; `issues` then say why. */
  readonly deployment_id: DeploymentId | null
  /** On the form's fields: `soldier_id` (not a member), `start_date` and `end_date` (outside the member's days). */
  readonly issues: readonly Issue[]
}

const NONE: RequestRotation = { deployment_id: null, issues: [] }

/**
 * The first open rotation, `preferred` first, then by start, that holds the request for every soldier. Otherwise the issues
 * of the first rotation every soldier serves in, else `not_a_member` on the soldier. Incomplete dates answer nothing:
 * the schema answers them.
 */
export function requestRotation(
  rotations: readonly Deployment[],
  membership: RotationMembership,
  soldierIds: readonly SoldierId[],
  dates: { readonly start_date: CalendarDate | ''; readonly end_date: CalendarDate | '' },
  preferred: DeploymentId | null = null,
): RequestRotation {
  const { start_date, end_date } = dates
  if (soldierIds.length === 0 || start_date === '' || end_date === '') return NONE
  const span = { start_date, end_date }
  const candidates = rotations.filter((rotation) => rotation.closed_at === null).sort(
    (a, b) => Number(b.id === preferred) - Number(a.id === preferred) || compareDates(a.start_date, b.start_date) || compareCodeUnits(a.id, b.id),
  )
  // The command's own test (D-336): a listed member on their days, else the whole unit's memberships (D-259, D-221).
  const issuesOf = (rotation: Deployment, soldierId: SoldierId) => {
    const days = membership.daysOf(rotation, soldierId)
    if (!membership.isListed(rotation)) return wholeUnitRotationIssues(rotation, days, span)
    const own = days[0]
    return leaveRotationIssues(rotation, own === undefined ? null : { start_date: own.valid_from, end_date: own.valid_to }, span)
  }
  const issuesIn = (rotation: Deployment) => soldierIds.flatMap((soldierId) => issuesOf(rotation, soldierId))
  let fallback: readonly Issue[] | null = null
  for (const rotation of candidates) {
    const issues = issuesIn(rotation)
    if (issues.length === 0) return { deployment_id: rotation.id, issues: [] }
    if (fallback === null && !issues.some((issue) => issue.code === IssueCode.enum.not_a_member)) fallback = dedupe(issues)
  }
  return { deployment_id: null, issues: fallback ?? [{ path: ['soldier_id'], code: IssueCode.enum.not_a_member }] }
}

function dedupe(issues: readonly Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.path.join('.')}:${issue.code}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The resolver the request forms use: the live rotations the actor reads, the one in view first. Nothing while they load. */
export function useRequestRotation(): (
  soldierIds: readonly SoldierId[],
  dates: { readonly start_date: CalendarDate | ''; readonly end_date: CalendarDate | '' },
) => RequestRotation {
  const deployments = useDeployments()
  const membership = useRotationMembership()
  const { window, rotations, today } = useDateWindow()
  const live = useMemo(() => (deployments.status === 'ready' ? liveDeployments(deployments.value) : []), [deployments])
  const preferred = window?.rotationId ?? (today === null ? null : (scopeRotation(rotations, today)?.id ?? null))
  return useCallback(
    (soldierIds, dates) => (membership === null ? NONE : requestRotation(live, membership, soldierIds, dates, preferred)),
    [live, membership, preferred],
  )
}
