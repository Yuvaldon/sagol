import { NOTIFICATIONS } from '@config'
import { OrganizationId, SoldierId, SoldierPreferences, type Result, type SoldierPreferencesRecord, type SubscribePushInput, type UpdateMyPreferencesInput } from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PushAvailability, PushPort } from '../ports'
import { useSession, useSignOut } from '../session/hooks'
import { allowEverything, fakePorts, wrapperOf } from '../testing/ports'
import { useDeviceNotifications, useNotificationKinds } from './push'

// Sample data, test files only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const INSTALL: SubscribePushInput = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/sample-device',
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
    installed: () => Promise.resolve(endpoint === null ? null : { ...INSTALL, endpoint }),
  }
}

function render(push: PushPort, commands: { subscribe?: unknown; unsubscribe?: unknown }) {
  return renderHook(() => useDeviceNotifications(), {
    wrapper: wrapperOf(fakePorts({ push, commands: { notifications: commands } })),
  })
}

describe('the device switch (D-356)', () => {
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

describe('sign-out (D-358)', () => {
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

  it('signs out when the push service never answers, after the limit (D-433)', async () => {
    vi.useFakeTimers()
    try {
      const hangs = () => new Promise<never>(() => undefined)
      const push = { ...browserOf('on'), disable: hangs }
      const signOut = vi.fn(() => Promise.resolve({ ok: true, value: null }))
      const ports = fakePorts({ push, commands: { notifications: { unsubscribe: hangs } }, auth: { signOut } })
      const { result } = renderHook(() => useSignOut(), { wrapper: wrapperOf(ports) })
      let done: Promise<unknown> = Promise.resolve()
      act(() => {
        done = result.current.signOut()
      })
      await act(() => vi.advanceTimersByTimeAsync(NOTIFICATIONS.signOutUnsubscribeTimeoutMs - 1))
      expect(signOut).not.toHaveBeenCalled()
      await act(() => vi.advanceTimersByTimeAsync(1))
      await act(() => done)
      expect(signOut).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('sign-out when the browser never answers (D-438)', () => {
  it('still forgets the install on the server, before signing out', async () => {
    vi.useFakeTimers()
    try {
      const push = { ...browserOf('on'), disable: () => new Promise<string | null>(() => undefined) }
      const unsubscribe = vi.fn(() => Promise.resolve({ ok: true, value: { subscribed: false } }))
      const signOut = vi.fn(() => Promise.resolve({ ok: true, value: null }))
      const ports = fakePorts({ push, commands: { notifications: { unsubscribe } }, auth: { signOut } })
      const { result } = renderHook(() => useSignOut(), { wrapper: wrapperOf(ports) })
      let done: Promise<unknown> = Promise.resolve()
      act(() => {
        done = result.current.signOut()
      })
      await act(() => vi.advanceTimersByTimeAsync(NOTIFICATIONS.signOutUnsubscribeTimeoutMs))
      await act(() => done)
      expect(unsubscribe).toHaveBeenCalledWith({ endpoint: INSTALL.endpoint })
      expect(signOut).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the kinds (D-358)', () => {
  it('keeps both of two quick switches', async () => {
    const stored = (preferences: SoldierPreferences, version: number): SoldierPreferencesRecord => ({
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences,
      updated_at: '2026-11-08T08:00:00.000Z',
      version,
    })
    let row = stored(SoldierPreferences.parse({}), 1)
    const updateMyPreferences = vi.fn((input: UpdateMyPreferencesInput) => {
      row = stored(SoldierPreferences.parse(input.preferences), row.version + 1)
      return Promise.resolve({ ok: true, value: row })
    })
    const ports = fakePorts({
      repositories: { soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: row }) } },
      commands: { accounts: { updateMyPreferences } },
    })
    const { result } = renderHook(() => useNotificationKinds(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current.kinds).not.toBeNull()
    })
    await act(async () => {
      await Promise.all([result.current.setKind('my_request', false), result.current.setKind('awaiting_me', false)])
    })
    expect(row.preferences.notifications).toMatchObject({ my_request: false, awaiting_me: false })
  })
})

describe('the install on start (D-434)', () => {
  const linked = {
    status: 'linked',
    identity: { auth_user_id: uuid(902), email: null, display_name: null },
    soldier_id: ACTOR,
    organization_id: ORGANIZATION,
  }

  function start(push: PushPort, session: unknown) {
    const subscribe = vi.fn(() => Promise.resolve(SUBSCRIBED))
    const ports = fakePorts({
      push,
      session: { current: () => Promise.resolve({ ok: true, value: session }) },
      commands: { notifications: { subscribe } },
    })
    const view = renderHook(() => useSession(), { wrapper: wrapperOf(ports) })
    return { subscribe, view }
  }

  it("sends the browser's current install again once a linked session is read", async () => {
    const renewed = { ...INSTALL, endpoint: 'https://fcm.googleapis.com/fcm/send/renewed-device' }
    const { subscribe, view } = start({ ...browserOf('on'), installed: () => Promise.resolve(renewed) }, linked)
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith(renewed))
    view.rerender()
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('sends nothing for a browser with no install, or a session not linked', async () => {
    const none = start(browserOf('off'), linked)
    await waitFor(() => expect(none.view.result.current.status).toBe('ready'))
    const unlinked = start(browserOf('on'), { status: 'signed_out' })
    await waitFor(() => expect(unlinked.view.result.current.status).toBe('ready'))
    expect(none.subscribe).not.toHaveBeenCalled()
    expect(unlinked.subscribe).not.toHaveBeenCalled()
  })
})
