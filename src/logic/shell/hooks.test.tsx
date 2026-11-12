import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ShellState } from '../ports'
import { fakePorts, wrapperOf } from '../testing/ports'
import { useAppUpdate, useInstallOffer } from './hooks'

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
