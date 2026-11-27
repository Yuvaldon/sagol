import { NotificationKind } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useDeviceNotifications, useNotificationKinds } from '@logic'
import { Bell } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { Card } from '../../kit/Card'
import { SwitchField } from '../../primitives/SwitchField'
import { useInboxAccess } from '../inboxAccess'
import { useReportPreferenceSave } from '../preferenceFailure'

// "התראות" on "אני" (D-356): this device's switch, then the kinds the soldier wants on all of their devices. The card
// exists only where the browser can push and the app has its key (D-076); iOS offers push to the installed app only,
// so there the card points at installing it.

const KIND_KEYS: Readonly<Record<NotificationKind, I18nKey>> = {
  my_request: 'notifications.kindMyRequest',
  awaiting_me: 'notifications.kindAwaitingMe',
}

export function NotificationSettings({ onIosInstall }: { readonly onIosInstall: () => void }) {
  const device = useDeviceNotifications()
  const { kinds, setKind } = useNotificationKinds()
  const approves = useInboxAccess()
  const reportSave = useReportPreferenceSave()
  const { availability } = device
  if (availability === 'unsupported' || availability === 'checking') return null

  if (availability === 'ios_install') {
    return (
      <Card titleKey="notifications.group">
        <AriaButton
          onPress={onIosInstall}
          className="flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control text-start text-small outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <Bell aria-hidden size={16} className="shrink-0 text-text-muted" />
          {t('notifications.iosInstall')}
        </AriaButton>
      </Card>
    )
  }

  const on = availability === 'on'
  const denied = availability === 'denied'
  const offered = NotificationKind.options.filter((kind) => kind !== NotificationKind.enum.awaiting_me || approves)
  return (
    <Card titleKey="notifications.group">
      <SwitchField
        labelKey="notifications.device"
        name="notifications_device"
        value={on}
        isDisabled={denied || device.isPending}
        onChange={(value) => {
          // A refused permission is no failure: the switch shows the browser's answer.
          reportSave(value ? device.enable() : device.disable())
        }}
      />
      {denied ? <p className="text-small text-text-muted">{t('notifications.denied')}</p> : null}
      {on
        ? offered.map((kind) => (
            <SwitchField
              key={kind}
              labelKey={KIND_KEYS[kind]}
              name={`notifications_${kind}`}
              value={kinds?.[kind] === true}
              isDisabled={kinds === null}
              onChange={(value) => {
                reportSave(setKind(kind, value))
              }}
            />
          ))
        : null}
    </Card>
  )
}
