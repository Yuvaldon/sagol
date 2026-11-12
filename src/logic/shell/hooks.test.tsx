import { DEVICE_KEYS } from '@config'
import { OrganizationId, SoldierId } from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ShellState } from '../ports'
import { allowEverything, fakePorts, memoryDeviceStore, wrapperOf } from '../testing/ports'
import { useAppUpdate, useInstallInvitation, useInstallOffer } from './hooks'

// Sample ids, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))

/** A shell whose state the test changes, as the browser's events would. */
function shellOf(initial: ShellState) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    current: () => state,
    applyUpdate: vi.fn(),
    install: vi.fn(() => Promise.resolve()),
    change(next: ShellState) {
      state = next
      for (const listener of listeners) listener()
    },
  }
}

describe('the shell hooks (D-183, D-184)', () => {
  it('reports a waiting version when the worker says so, and reloads through the port', () => {
    const shell = shellOf({ updateReady: false, install: 'none' })
    const { result } = renderHook(() => useAppUpdate(), { wrapper: wrapperOf(fakePorts({ shell })) })
    expect(result.current.ready).toBe(false)
    act(() => {
      shell.change({ updateReady: true, install: 'none' })
    })
    expect(result.current.ready).toBe(true)
    result.current.reload()
    expect(shell.applyUpdate).toHaveBeenCalledOnce()
  })

  it('follows the install offer and installs through the port', async () => {
    const shell = shellOf({ updateReady: false, install: 'prompt' })
    const { result } = renderHook(() => useInstallOffer(), { wrapper: wrapperOf(fakePorts({ shell })) })
    expect(result.current.offer).toBe('prompt')
    await result.current.install()
    expect(shell.install).toHaveBeenCalledOnce()
    act(() => {
      shell.change({ updateReady: false, install: 'none' })
    })
    expect(result.current.offer).toBe('none')
  })
})

describe('the install offer after sign-in (D-274)', () => {
  function portsWith(shell: ReturnType<typeof shellOf>, local = memoryDeviceStore(), linked = true) {
    const session = linked
      ? { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
      : { status: 'signed_out' }
    return fakePorts({ shell, session: { current: () => Promise.resolve({ ok: true, value: session }), can: allowEverything }, device: { local } })
  }

  it('offers what the device can, once the soldier is signed in, until it is answered on this device', async () => {
    const shell = shellOf({ updateReady: false, install: 'ios_hint' })
    const local = memoryDeviceStore()
    const { result } = renderHook(() => useInstallInvitation(), { wrapper: wrapperOf(portsWith(shell, local)) })
    await waitFor(() => {
      expect(result.current.offer).toBe('ios_hint')
    })
    act(() => {
      result.current.answer()
    })
    expect(result.current.offer).toBe('none')
    expect(local.read(DEVICE_KEYS.installAnswered, ACTOR)).toBe('true')
    const again = renderHook(() => useInstallInvitation(), { wrapper: wrapperOf(portsWith(shell, local)) })
    await waitFor(() => {
      expect(again.result.current.offer).toBe('none')
    })
  })

  it('is never offered before sign-in, nor where the device cannot install', async () => {
    const signedOut = renderHook(() => useInstallInvitation(), {
      wrapper: wrapperOf(portsWith(shellOf({ updateReady: false, install: 'prompt' }), memoryDeviceStore(), false)),
    })
    const installed = renderHook(() => useInstallInvitation(), { wrapper: wrapperOf(portsWith(shellOf({ updateReady: false, install: 'none' }))) })
    await waitFor(() => {
      expect(signedOut.result.current.offer).toBe('none')
      expect(installed.result.current.offer).toBe('none')
    })
  })
})
