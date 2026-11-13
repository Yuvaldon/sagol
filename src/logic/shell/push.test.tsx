import { OrganizationId, SoldierId, type Result, type SubscribePushInput } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PushAvailability, PushPort } from '../ports'
import { useSignOut } from '../session/hooks'
import { allowEverything, fakePorts, wrapperOf } from '../testing/ports'
import { useDeviceNotifications } from './push'

// Sample data, test files only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const INSTALL: SubscribePushInput = {
  endpoint: 'https://push.example.test/device',
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}
const SUBSCRIBED: Result<{ subscribed: boolean }> = { ok: true, value: { subscribed: true } }

/** A browser that keeps one subscription and tells its listeners. */
function browserOf(initial: PushAvailability, answer: SubscribePushInput | null = INSTALL) {
  let state = initial
  let endpoint: string | null = initial === 'on' ? INSTALL.endpoint : null
  const listeners = new Set<() => void>()
  const set = (next: PushAvailability) => {
    state = next
    for (const listener of listeners) listener()
  }
  const enable = vi.fn(() => {
    if (answer === null) {
      set('denied')
      return Promise.resolve(null)
    }
    endpoint = answer.endpoint
    set('on')
    return Promise.resolve(answer)
  })
  const disable = vi.fn(() => {
    const had = endpoint
    endpoint = null
    set('off')
    return Promise.resolve(had)
  })
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    current: () => state,
    enable,
    disable,
  }
}

function render(push: PushPort, commands: { subscribe?: unknown; unsubscribe?: unknown }) {
  return renderHook(() => useDeviceNotifications(), {
    wrapper: wrapperOf(fakePorts({ push, commands: { notifications: commands } })),
  })
}

describe('the device switch (D-354)', () => {
  it('asks the browser, then records the install', async () => {
    const push = browserOf('off')
    const subscribe = vi.fn(() => Promise.resolve(SUBSCRIBED))
    const { result } = render(push, { subscribe })
    expect(result.current.availability).toBe('off')
    let outcome: Result<null> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })
    expect(outcome).toEqual({ ok: true, value: null })
    expect(subscribe).toHaveBeenCalledWith(INSTALL)
    expect(result.current.availability).toBe('on')
  })

  it('takes the browser subscription back when the server refuses it', async () => {
    const push = browserOf('off')
    const subscribe = vi.fn(() => Promise.resolve({ ok: false, error: { code: 'account_not_linked' } }))
    const { result } = render(push, { subscribe })
    let outcome: Result<null> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })
    expect(outcome).toEqual({ ok: false, error: { code: 'account_not_linked' } })
    expect(push.disable).toHaveBeenCalledTimes(1)
    expect(result.current.availability).toBe('off')
  })

  it('records nothing when the permission is not given, and that is not a failure', async () => {
    const push = browserOf('off', null)
    const subscribe = vi.fn()
    const { result } = render(push, { subscribe })
    let outcome: Result<null> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })
    expect(outcome).toEqual({ ok: true, value: null })
    expect(subscribe).not.toHaveBeenCalled()
    expect(result.current.availability).toBe('denied')
  })

  it('unsubscribes the browser, then forgets the install on the server', async () => {
    const push = browserOf('on')
    const unsubscribe = vi.fn(() => Promise.resolve({ ok: true, value: { subscribed: false } }))
    const { result } = render(push, { unsubscribe })
    await act(async () => {
      await result.current.disable()
    })
    expect(unsubscribe).toHaveBeenCalledWith({ endpoint: INSTALL.endpoint })
    expect(result.current.availability).toBe('off')
  })

  it('answers unavailable when the browser throws', async () => {
    const push = { ...browserOf('off'), enable: () => Promise.reject(new Error('blocked')) }
    const { result } = render(push, {})
    let outcome: Result<null> | undefined
    await act(async () => {
      outcome = await result.current.enable()
    })
    expect(outcome).toEqual({ ok: false, error: { code: 'unavailable' } })
  })
})

describe('sign-out (D-356)', () => {
  const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }

  it('forgets this device before it signs out', async () => {
    const order: string[] = []
    const push = browserOf('on')
    const unsubscribe = vi.fn(() => {
      order.push('unsubscribe')
      return Promise.resolve({ ok: true, value: { subscribed: false } })
    })
    const signOut = vi.fn(() => {
      order.push('signOut')
      return Promise.resolve({ ok: true, value: null })
    })
    const ports = fakePorts({
      push,
      session: { current: () => Promise.resolve({ ok: true, value: session }), can: allowEverything },
      commands: { notifications: { unsubscribe } },
      auth: { signOut },
    })
    const { result } = renderHook(() => useSignOut(), { wrapper: wrapperOf(ports) })
    await act(async () => {
      await result.current.signOut()
    })
    expect(order).toEqual(['unsubscribe', 'signOut'])
  })

  it('signs out even when forgetting the device fails', async () => {
    const push = { ...browserOf('on'), disable: () => Promise.reject(new Error('gone')) }
    const signOut = vi.fn(() => Promise.resolve({ ok: true, value: null }))
    const ports = fakePorts({ push, auth: { signOut } })
    const { result } = renderHook(() => useSignOut(), { wrapper: wrapperOf(ports) })
    await act(async () => {
      await result.current.signOut()
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
