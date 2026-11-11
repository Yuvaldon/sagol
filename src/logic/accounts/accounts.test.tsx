import {
  AccountLinkRequestId,
  AuthUserId,
  OrganizationId,
  SoldierAccountId,
  SoldierId,
  UnitId,
  type AccountLinkRequest,
  type PermissionCheck,
  type Result,
  type Session,
  type Soldier,
  type SoldierAccount,
} from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { useAccountPermissions, useLinkReviewAccess, useRequestLink } from './hooks'
import { activeAccountOf, asLinkRequestFormError, linkRequestIssues, toRequestLinkInput, toReviewLinkInput } from './linking'

// Sample data, test files only.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(1))
const SELF = SoldierId.parse(uuid(2))
const OTHER = SoldierId.parse(uuid(3))
const AT = '2026-11-08T10:00:00.000Z'

const REQUEST: AccountLinkRequest = {
  id: AccountLinkRequestId.parse(uuid(4)),
  organization_id: ORGANIZATION,
  auth_user_id: AuthUserId.parse(uuid(5)),
  email: 'yael@example.test',
  claimed_personal_id: null,
  first_name: 'יעל',
  last_name: 'בר',
  status: 'pending',
  resolved_soldier_id: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: AT,
}

function account(n: number, revoked: boolean): SoldierAccount {
  return {
    id: SoldierAccountId.parse(uuid(100 + n)),
    organization_id: ORGANIZATION,
    auth_user_id: AuthUserId.parse(uuid(200 + n)),
    soldier_id: OTHER,
    provider: 'local',
    email: 'a@example.test',
    linked_at: AT,
    linked_by: null,
    revoked_at: revoked ? AT : null,
    revoked_by: revoked ? SELF : null,
  }
}

const VALUES = { first_name: 'יעל', last_name: 'בר', personal_id: '' }

describe('link request form', () => {
  it('sends an empty personal id as NULL, with new ids each time', () => {
    const input = toRequestLinkInput(VALUES)
    expect(input).toMatchObject({ first_name: 'יעל', last_name: 'בר', claimed_personal_id: null })
    expect(toRequestLinkInput(VALUES).id).not.toBe(input.id)
    expect(toRequestLinkInput({ ...VALUES, personal_id: '123' }).claimed_personal_id).toBe('123')
  })

  it('reports issues at the names the form uses', () => {
    expect(linkRequestIssues(VALUES)).toEqual([])
    expect(linkRequestIssues({ ...VALUES, first_name: '' })).toEqual([{ path: ['first_name'], code: 'required' }])
    expect(linkRequestIssues({ ...VALUES, personal_id: 'x'.repeat(51) })).toEqual([{ path: ['personal_id'], code: 'too_long' }])
    expect(
      asLinkRequestFormError({ code: 'validation_failed', issues: [{ path: ['claimed_personal_id'], code: 'already_exists' }] }),
    ).toEqual({ code: 'validation_failed', issues: [{ path: ['personal_id'], code: 'already_exists' }] })
    expect(asLinkRequestFormError({ code: 'forbidden' })).toEqual({ code: 'forbidden' })
  })
})

describe('review choices', () => {
  it('builds each resolution with fresh ids', () => {
    expect(toReviewLinkInput(REQUEST, { kind: 'reject' })).toEqual({ id: REQUEST.id, resolution: { kind: 'reject' } })
    expect(toReviewLinkInput(REQUEST, { kind: 'link', soldier_id: OTHER }).resolution).toMatchObject({ kind: 'link', soldier_id: OTHER })
    const unplaced = toReviewLinkInput(REQUEST, { kind: 'create_soldier', placement: null })
    expect(unplaced.resolution).toMatchObject({ kind: 'create_soldier', membership: null, command_rank_id: null })
    const placed = toReviewLinkInput(REQUEST, { kind: 'create_soldier', placement: { unit_id: UnitId.parse(uuid(9)), valid_from: '2026-11-08' } })
    expect(placed.resolution).toMatchObject({ membership: { unit_id: uuid(9), valid_from: '2026-11-08' } })
  })

  it('finds the account in force', () => {
    expect(activeAccountOf([account(1, true)])).toBeNull()
    expect(activeAccountOf([account(1, true), account(2, false)])?.id).toBe(uuid(102))
  })
})

const LINKED: Session = {
  status: 'linked',
  identity: { auth_user_id: AuthUserId.parse(uuid(6)), provider: 'local', email: 'o@example.test', email_verified: true, display_name: null },
  soldier_id: SELF,
  organization_id: ORGANIZATION,
}

const soldierWith = (id: SoldierId) => ({ id }) as Soldier

describe('account hooks', () => {
  it('never offers to revoke the own account (D-156)', async () => {
    const ports = fakePorts({
      session: {
        current: () => Promise.resolve({ ok: true, value: LINKED }),
        can: (checks: readonly PermissionCheck[]) => Promise.resolve({ ok: true, value: checks.map(() => true) }),
      },
    })
    const own = renderHook(() => useAccountPermissions(soldierWith(SELF)), { wrapper: wrapperOf(ports) })
    const other = renderHook(() => useAccountPermissions(soldierWith(OTHER)), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(other.result.current).toEqual({ view: true, revoke: true })
    })
    expect(own.result.current).toEqual({ view: true, revoke: false })
  })

  it('opens the review module for approval over any unit seen (D-157)', async () => {
    const unit = UnitId.parse(uuid(9))
    const can = vi.fn((checks: readonly PermissionCheck[]) =>
      Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map((check) => check.target.kind === 'unit') }),
    )
    const ports = fakePorts({ session: { can } })
    const { result, rerender } = renderHook(({ units }) => useLinkReviewAccess(units), {
      wrapper: wrapperOf(ports),
      initialProps: { units: [] as { id: UnitId }[] as never[] },
    })
    await waitFor(() => {
      expect(can).toHaveBeenCalled()
    })
    expect(result.current).toBe(false)
    rerender({ units: [{ id: unit }] as never[] })
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('files a request through the command', async () => {
    const requestLink = vi.fn(() => Promise.resolve({ ok: true as const, value: { outcome: 'pending_review' as const } }))
    const ports = fakePorts({ commands: { accounts: { requestLink } } })
    const { result } = renderHook(() => useRequestLink(), { wrapper: wrapperOf(ports) })
    let answer: unknown
    await act(async () => {
      answer = await result.current.run(VALUES)
    })
    expect(answer).toEqual({ ok: true, value: { outcome: 'pending_review' } })
    expect(requestLink).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'יעל', claimed_personal_id: null }))
  })
})
