import { SoldierPreferences, type PermissionCheck, type Result } from '@contracts'
import { dictionary as he } from '@i18n'
import { LogicProvider, type LogicPorts, type PushAvailability } from '@logic'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationSettings } from './NotificationSettings'

// The notifications card of "אני" (D-356): hidden where the browser cannot push, the device switch with the
// browser's answer, and the kinds only while this device is on. Test data only.

const NO_STORE = { read: () => null, write: () => undefined }

function portsWith(availability: PushAvailability) {
  const quiet = { subscribe: () => () => undefined }
  return {
    data: {
      session: {
        ...quiet,
        current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }),
        can: (checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(() => false) }),
      },
      repositories: {
        soldiers: { list: () => Promise.resolve({ ok: true, value: [] }) },
        soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: null }) },
      },
      commands: { accounts: {}, notifications: {} },
      changes: quiet,
    },
    auth: {},
    device: { local: NO_STORE, session: NO_STORE },
    push: { ...quiet, current: () => availability, enable: vi.fn(), disable: vi.fn() },
  } as unknown as LogicPorts
}

function renderMenu(availability: PushAvailability, onIosInstall = vi.fn()) {
  render(
    <LogicProvider ports={portsWith(availability)}>
      <NotificationSettings onIosInstall={onIosInstall} />
    </LogicProvider>,
  )
}

describe('the notifications group (D-356)', () => {
  it('does not exist where the browser cannot push (D-076)', () => {
    renderMenu('unsupported')
    expect(screen.queryByText(he.notifications.group)).toBeNull()
  })

  it('offers the kinds only while this device is on', async () => {
    renderMenu('on')
    const device = screen.getByRole<HTMLInputElement>('switch', { name: he.notifications.device })
    expect(device.checked).toBe(true)
    const mine = await screen.findByRole<HTMLInputElement>('switch', { name: he.notifications.kindMyRequest })
    // The kinds wait, disabled, until the preferences are read.
    await waitFor(() => {
      expect(mine.disabled).toBe(false)
    })
    expect(mine.checked).toBe(SoldierPreferences.parse({}).notifications.my_request)
    // Only an approver is offered what waits for them.
    expect(screen.queryByText(he.notifications.kindAwaitingMe)).toBeNull()
  })

  it('shows no kinds while the device is off', () => {
    renderMenu('off')
    expect(screen.getByRole<HTMLInputElement>('switch', { name: he.notifications.device }).checked).toBe(false)
    expect(screen.queryByText(he.notifications.kindMyRequest)).toBeNull()
  })

  it('turns the switch off with a hint when the browser refused', () => {
    renderMenu('denied')
    const device = screen.getByRole<HTMLInputElement>('switch', { name: he.notifications.device })
    expect(device.disabled).toBe(true)
    expect(screen.getByText(he.notifications.denied)).toBeTruthy()
  })

  it('points iOS at installing the app', () => {
    const onIosInstall = vi.fn()
    renderMenu('ios_install', onIosInstall)
    screen.getByRole('button', { name: he.notifications.iosInstall }).click()
    expect(onIosInstall).toHaveBeenCalledOnce()
  })
})
