import { SoldierPreferences, type PermissionCheck, type Result } from '@contracts'
import { dictionary as he } from '@i18n'
import { LogicProvider, type LogicPorts, type PushAvailability } from '@logic'
import { render, screen, waitFor } from '@testing-library/react'
import { Menu } from 'react-aria-components'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsMenu } from './NotificationsMenu'

// The profile's notifications group (D-354): hidden where the browser cannot push, the device switch with the
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
      <Menu aria-label={he.notifications.group}>
        <NotificationsMenu item="" onIosInstall={onIosInstall} />
      </Menu>
    </LogicProvider>,
  )
}

describe('the notifications group (D-354)', () => {
  it('does not exist where the browser cannot push (D-076)', () => {
    renderMenu('unsupported')
    expect(screen.queryByText(he.notifications.group)).toBeNull()
  })

  it('offers the kinds only while this device is on', async () => {
    renderMenu('on')
    const device = screen.getByRole('menuitemcheckbox', { name: he.notifications.device })
    expect(device.getAttribute('aria-checked')).toBe('true')
    const mine = await screen.findByRole('menuitemcheckbox', { name: he.notifications.kindMyRequest })
    // The kinds wait, disabled, until the preferences are read.
    await waitFor(() => {
      expect(mine.getAttribute('aria-disabled')).toBeNull()
    })
    expect(mine.getAttribute('aria-checked')).toBe(String(SoldierPreferences.parse({}).notifications.my_request))
    // Only an approver is offered what waits for them.
    expect(screen.queryByText(he.notifications.kindAwaitingMe)).toBeNull()
  })

  it('shows no kinds while the device is off', () => {
    renderMenu('off')
    expect(screen.getByRole('menuitemcheckbox', { name: he.notifications.device }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText(he.notifications.kindMyRequest)).toBeNull()
  })

  it('turns the switch off with a hint when the browser refused', () => {
    renderMenu('denied')
    const device = screen.getByRole('menuitemcheckbox', { name: he.notifications.device })
    expect(device.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText(he.notifications.denied)).toBeTruthy()
  })

  it('points iOS at installing the app', () => {
    const onIosInstall = vi.fn()
    renderMenu('ios_install', onIosInstall)
    screen.getByRole('menuitem', { name: he.notifications.iosInstall }).click()
    expect(onIosInstall).toHaveBeenCalledOnce()
  })
})
