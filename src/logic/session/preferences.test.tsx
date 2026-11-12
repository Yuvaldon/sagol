import {
  OrganizationId,
  SoldierId,
  SoldierPreferences,
  type Result,
  type SoldierPreferencesRecord,
  type UpdateMyPreferencesInput,
} from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { allowEverything, fakePorts, wrapperOf } from '../testing/ports'
import { useAppearance, useNavigationPreferences } from './preferences'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const AT = '2026-11-12T10:00:00.000Z'

/** A store that keeps one row and answers `stale_version` to a save at the wrong version, as the adapters do. */
function storeOf() {
  let row: SoldierPreferencesRecord | null = null
  const updateMyPreferences = vi.fn((request: UpdateMyPreferencesInput): Promise<Result<SoldierPreferencesRecord>> => {
    if (request.expected_version !== (row?.version ?? null)) return Promise.resolve({ ok: false, error: { code: 'stale_version' } })
    row = {
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences: SoldierPreferences.parse(request.preferences),
      updated_at: AT,
      version: (row?.version ?? 0) + 1,
    }
    return Promise.resolve({ ok: true, value: row })
  })
  const ports = fakePorts({
    session: {
      current: () => Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION } }),
      can: allowEverything,
    },
    repositories: { soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: row }) } },
    commands: { accounts: { updateMyPreferences } },
    now: () => AT,
  })
  /** Another device saves `preferences` over the stored row. */
  const elsewhere = (preferences: Partial<SoldierPreferences>) => {
    const current = row?.preferences ?? SoldierPreferences.parse({})
    row = {
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences: { ...current, ...preferences },
      updated_at: AT,
      version: (row?.version ?? 0) + 1,
    }
  }
  return { ports, updateMyPreferences, elsewhere }
}

describe('navigation preferences (D-173)', () => {
  it('starts with no pins and the rules row below', async () => {
    const { ports } = storeOf()
    const { result } = renderHook(() => useNavigationPreferences(), { wrapper: wrapperOf(ports) })
    expect(result.current.settled).toBe(false)
    await waitFor(() => {
      expect(result.current.settled).toBe(true)
    })
    expect(result.current.pinned).toEqual([])
    expect(result.current.rulesRow).toBe('below')
    expect(result.current.editable).toBe(true)
  })

  it('keeps two quick pins: each save builds on the one before', async () => {
    const { ports, updateMyPreferences } = storeOf()
    const { result } = renderHook(() => useNavigationPreferences(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.editable).toBe(true)
    })
    act(() => {
      result.current.togglePin('units')
      result.current.togglePin('rules')
    })
    await waitFor(() => {
      expect(result.current.pinned).toEqual(['units', 'rules'])
    })
    expect(updateMyPreferences).toHaveBeenCalledTimes(2)
  })

  it('a second press on the same pin takes it off again', async () => {
    const { ports } = storeOf()
    const { result } = renderHook(() => useNavigationPreferences(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.editable).toBe(true)
    })
    act(() => {
      result.current.togglePin('units')
      result.current.togglePin('units')
    })
    await waitFor(() => {
      expect(result.current.pinned).toEqual([])
    })
  })
})

describe('a save that fails (D-187)', () => {
  it('answers the failure, and the hook reads the stored row again', async () => {
    const { ports, elsewhere } = storeOf()
    const { result } = renderHook(() => useNavigationPreferences(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.editable).toBe(true)
    })
    elsewhere({ pinned_modules: ['rules'] })
    let saved: Awaited<ReturnType<typeof result.current.togglePin>> | undefined
    await act(async () => {
      saved = await result.current.togglePin('units')
    })
    expect(saved).toEqual({ ok: false, error: { code: 'stale_version' } })
    await waitFor(() => {
      expect(result.current.pinned).toEqual(['rules'])
    })
  })
})

describe('appearance (D-181)', () => {
  it('is light until chosen, and keeps the choice with the other preferences', async () => {
    const { ports, updateMyPreferences } = storeOf()
    const { result } = renderHook(() => useAppearance(), { wrapper: wrapperOf(ports) })
    expect(result.current.appearance).toBe('light')
    expect(result.current.editable).toBe(false)
    await waitFor(() => {
      expect(result.current.editable).toBe(true)
    })
    act(() => {
      result.current.setAppearance('dark')
    })
    await waitFor(() => {
      expect(result.current.appearance).toBe('dark')
    })
    expect(updateMyPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ preferences: expect.objectContaining({ appearance: 'dark', pinned_modules: [] }) }),
    )
  })
})
