import { NotificationKind } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useDeviceNotifications, useNotificationKinds } from '@logic'
import { Bell, Check } from 'lucide-react'
import { Header, MenuItem, MenuSection, Text } from 'react-aria-components'
import { useInboxAccess } from './inboxAccess'
import { useReportPreferenceSave } from './preferenceFailure'

// The profile's "התראות" group (D-356): this device's switch, then the kinds the soldier wants on all of their devices.
// It exists only where the browser can push and the app has its key (D-076); iOS offers push to the installed app
// only, so there the group points at installing it.

const DEVICE = 'device'
const KIND_KEYS: Readonly<Record<NotificationKind, I18nKey>> = {
  my_request: 'notifications.kindMyRequest',
  awaiting_me: 'notifications.kindAwaitingMe',
}

function Checkmark({ shown }: { readonly shown: boolean }) {
  return <span className="flex size-icon shrink-0 items-center justify-center">{shown ? <Check aria-hidden size={12} strokeWidth={3} /> : null}</span>
}

export function NotificationsMenu({ item, onIosInstall }: { readonly item: string; readonly onIosInstall: () => void }) {
  const device = useDeviceNotifications()
  const { kinds, setKind } = useNotificationKinds()
  const approves = useInboxAccess()
  const reportSave = useReportPreferenceSave()
  const { availability } = device
  if (availability === 'unsupported' || availability === 'checking') return null

  const header = <Header className="px-md py-xs text-label font-semibold text-text-muted">{t('notifications.group')}</Header>
  if (availability === 'ios_install') {
    return (
      <MenuSection className="flex flex-col gap-2xs border-b border-line pb-xs">
        {header}
        <MenuItem id="notifications-install" textValue={t('notifications.iosInstall')} className={item} onAction={onIosInstall}>
          <Bell aria-hidden size={14} className="shrink-0" />
          <span className="min-w-none whitespace-normal">{t('notifications.iosInstall')}</span>
        </MenuItem>
      </MenuSection>
    )
  }

  const on = availability === 'on'
  const offered = NotificationKind.options.filter((kind) => kind !== NotificationKind.enum.awaiting_me || approves)
  const selected = [...(on ? [DEVICE] : []), ...(on && kinds !== null ? offered.filter((kind) => kinds[kind]) : [])]

  return (
    <MenuSection
      selectionMode="multiple"
      selectedKeys={selected}
      onSelectionChange={(keys) => {
        if (keys === 'all') return
        if (keys.has(DEVICE) !== on) {
          // A refused permission is no failure: the switch shows the browser's answer.
          reportSave(on ? device.disable() : device.enable())
          return
        }
        const changed = offered.find((kind) => kinds !== null && keys.has(kind) !== kinds[kind])
        if (changed !== undefined) reportSave(setKind(changed, keys.has(changed)))
      }}
      className="flex flex-col gap-2xs border-b border-line pb-xs"
    >
      {header}
      <MenuItem
        id={DEVICE}
        textValue={t('notifications.device')}
        isDisabled={availability === 'denied' || device.isPending}
        className={`${item} data-disabled:cursor-default`}
      >
        <Checkmark shown={on} />
        <span className="flex min-w-none flex-col">
          <Text slot="label">{t('notifications.device')}</Text>
          {availability === 'denied' ? (
            <Text slot="description" className="whitespace-normal text-micro text-text-muted">
              {t('notifications.denied')}
            </Text>
          ) : null}
        </span>
      </MenuItem>
      {on
        ? offered.map((kind) => (
            <MenuItem key={kind} id={kind} textValue={t(KIND_KEYS[kind])} isDisabled={kinds === null} className={item}>
              <Checkmark shown={kinds?.[kind] === true} />
              {t(KIND_KEYS[kind])}
            </MenuItem>
          ))
        : null}
    </MenuSection>
  )
}
