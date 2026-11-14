import { LeaveId, type Leave, type LeaveQuery, type Result, type UnitMembership } from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { useCountedLeaves } from './hooks'

// A store whose counter and leaves move together, as one organization's commits do (D-373). Test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const leaveOf = (n: number): Leave => ({ id: LeaveId.parse(uuid(n)) }) as Leave
const membershipOf = (n: number): UnitMembership => ({ id: uuid(n) }) as UnitMembership
const SPAN = { from: '2026-11-13', to: '2026-11-15' }

function organization() {
  const state = { seq: 5, leaves: [leaveOf(1)], memberships: [membershipOf(1)] }
  const reads: string[] = []
  const commit = () => {
    state.seq += 1
    state.leaves = [...state.leaves, leaveOf(state.seq)]
    state.memberships = [...state.memberships, membershipOf(state.seq)]
  }
  return { state, reads, commit }
}

interface During {
  readonly counter?: () => void
  readonly leaves?: () => void
  readonly memberships?: () => void
}

function render(org: ReturnType<typeof organization>, during: During) {
  const ports = fakePorts({
    repositories: {
      change_counters: {
        current: () => {
          org.reads.push('counter')
          const seq = org.state.seq
          during.counter?.()
          return Promise.resolve<Result<number>>({ ok: true, value: seq })
        },
      },
      leaves: {
        list: (_query: LeaveQuery) => {
          org.reads.push('leaves')
          const rows = [...org.state.leaves]
          during.leaves?.()
          return Promise.resolve<Result<Leave[]>>({ ok: true, value: rows })
        },
      },
      unit_memberships: {
        list: () => {
          org.reads.push('memberships')
          const rows = [...org.state.memberships]
          during.memberships?.()
          return Promise.resolve<Result<UnitMembership[]>>({ ok: true, value: rows })
        },
      },
    },
  })
  return renderHook(() => useCountedLeaves(SPAN), { wrapper: wrapperOf(ports) })
}

describe('useCountedLeaves reads the change number before the leaves and memberships (D-402, D-432)', () => {
  it('reads the counter first, in the same query', async () => {
    const org = organization()
    const { result } = render(org, {})
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(org.reads).toEqual(['counter', 'leaves', 'memberships'])
  })

  it('never covers a change committed between the counter read and the leaves read', async () => {
    const org = organization()
    // The write commits right after the counter is read: the leaves hold it, its number is above the one carried.
    const { result } = render(org, { counter: org.commit })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    if (result.current.status !== 'ready') return
    expect(result.current.value.seq).toBe(5)
    expect(result.current.value.leaves.map((leave) => leave.id)).toContain(uuid(6))
    // A confirmation at 5 leaves change 6 above it: shown as changed until the next read, never taken as seen.
    expect(org.state.seq).toBeGreaterThan(result.current.value.seq)
  })

  it('carries a number no larger than any change the leaves miss', async () => {
    const org = organization()
    // The write commits after the leaves are read: the list misses it, and so does the number.
    const { result } = render(org, { leaves: org.commit })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    if (result.current.status !== 'ready') return
    expect(result.current.value.seq).toBe(5)
    expect(result.current.value.leaves.map((leave) => leave.id)).not.toContain(uuid(6))
  })

  it('never covers a membership committed after the counter read', async () => {
    const org = organization()
    const { result } = render(org, { leaves: org.commit })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    if (result.current.status !== 'ready') return
    // The membership of change 6 is in the list, and 6 is above the number carried: shown as changed, never covered.
    expect(result.current.value.seq).toBe(5)
    expect(result.current.value.memberships.map((row) => row.id)).toContain(uuid(6))
  })

  it('carries a number no larger than any membership change the list misses', async () => {
    const org = organization()
    const { result } = render(org, { memberships: org.commit })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    if (result.current.status !== 'ready') return
    expect(result.current.value.seq).toBe(5)
    expect(result.current.value.memberships.map((row) => row.id)).not.toContain(uuid(6))
  })
})
