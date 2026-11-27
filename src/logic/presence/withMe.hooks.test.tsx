import { OrganizationId, SoldierId, type PermissionCheck, type Result } from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, organizationIn, wrapperOf } from '../testing/ports'
import { usePresentWithMe } from './withMe'

// "איתך היום" (D-478, D-479): the hook asks the server only for who holds the pair, and shows an answer of today
// only. Sample data, test file only.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ACTOR = SoldierId.parse(uuid(1))
const ORGANIZATION = OrganizationId.parse(uuid(2))
/** TEST_NOW's day in Asia/Jerusalem. */
const TODAY = '2026-11-08'
const LINKED = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
const ROWS = [
  { id: SoldierId.parse(uuid(3)), first_name: 'נועה', last_name: 'לוי' },
  { id: SoldierId.parse(uuid(4)), first_name: 'תמר', last_name: 'כהן' },
]

function portsWith(options: { session?: object; can?: (checks: readonly PermissionCheck[]) => Promise<Result<boolean[]>>; date?: string }) {
  const presentWithMe = vi.fn(() => Promise.resolve({ ok: true, value: { date: options.date ?? TODAY, soldiers: ROWS } }))
  const can = options.can ?? ((checks: readonly PermissionCheck[]) => Promise.resolve({ ok: true as const, value: checks.map(() => true) }))
  const ports = fakePorts({
    session: { current: () => Promise.resolve({ ok: true, value: options.session ?? LINKED }), can },
    repositories: { organizations: organizationIn(), soldiers: { presentWithMe } },
  })
  return { ports, presentWithMe }
}

describe('usePresentWithMe (D-478, D-479)', () => {
  it('answers the names of today in name order for who holds the pair', async () => {
    const { ports } = portsWith({})
    const { result } = renderHook(() => usePresentWithMe(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: [ROWS[1], ROWS[0]] })
    })
  })

  it('asks nothing and answers NULL without the pair', async () => {
    const { ports, presentWithMe } = portsWith({ can: (checks) => Promise.resolve({ ok: true, value: checks.map(() => false) }) })
    const { result } = renderHook(() => usePresentWithMe(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: null })
    })
    expect(presentWithMe).not.toHaveBeenCalled()
  })

  it('answers NULL without an actor, and asks nothing', async () => {
    const { ports, presentWithMe } = portsWith({ session: { status: 'signed_out' } })
    const { result } = renderHook(() => usePresentWithMe(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: null })
    })
    expect(presentWithMe).not.toHaveBeenCalled()
  })

  it('waits while the pair is not known yet', async () => {
    const { ports, presentWithMe } = portsWith({ can: () => new Promise(() => undefined) })
    const { result } = renderHook(() => usePresentWithMe(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'loading' })
    })
    expect(presentWithMe).not.toHaveBeenCalled()
  })

  it('drops an answer about another day than the screen\'s', async () => {
    const { ports, presentWithMe } = portsWith({ date: '2026-11-09' })
    const { result } = renderHook(() => usePresentWithMe(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(presentWithMe).toHaveBeenCalled()
      expect(result.current).toEqual({ status: 'ready', value: null })
    })
  })
})
