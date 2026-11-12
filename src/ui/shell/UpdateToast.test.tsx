import { dictionary as he } from '@i18n'
import { LogicProvider, type LogicPorts, type ShellState } from '@logic'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateToast } from './UpdateToast'

// The update notice shows only when a new version waits, and its button applies it (D-183).

function portsWithShell(initial: ShellState) {
  let state = initial
  const listeners = new Set<() => void>()
  const applyUpdate = vi.fn()
  const shell = {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    current: () => state,
    applyUpdate,
    install: () => Promise.resolve(),
  }
  const publish = (next: ShellState) => {
    state = next
    for (const listener of listeners) listener()
  }
  const quiet = { subscribe: () => () => undefined }
  const data = { changes: quiet, session: quiet }
  return { ports: { data, shell } as unknown as LogicPorts, applyUpdate, publish }
}

describe('UpdateToast', () => {
  it('stays empty until a version waits, then reloads on request', () => {
    const { ports, applyUpdate, publish } = portsWithShell({ updateReady: false, install: 'none' })
    render(
      <LogicProvider ports={ports}>
        <UpdateToast />
      </LogicProvider>,
    )
    expect(screen.queryByText(he.app.updateReady)).toBeNull()
    act(() => {
      publish({ updateReady: true, install: 'none' })
    })
    expect(screen.getByRole('status').textContent).toContain(he.app.updateReady)
    fireEvent.click(screen.getByRole('button', { name: he.app.updateReload }))
    expect(applyUpdate).toHaveBeenCalledOnce()
  })
})
