import { DEFAULT_TAB } from '@config'
import { Appearance, type AuthIdentity } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useAppearance, useInstallOffer, useMyLeavesAccess, useMyPreferences, useShellPlace, useSignOut } from '@logic'
import { Download, Monitor, Moon, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { InfoDialog } from '../../patterns/Dialogs'
import { Segmented } from '../../primitives/Segmented'
import { ApproveNowSwitch } from '../ApproveNowSwitch'
import { IdentityList } from '../IdentityList'
import { PageFrame } from '../PageFrame'
import { useReportPreferenceSave } from '../preferenceFailure'
import { PageTop } from '../manage/PageTop'
import { NotificationSettings } from './NotificationSettings'

// "העדפות" (the handoff's Preferences, D-488): what is the soldier's to set on their account. "מראה" (D-181), "התראות"
// on this device and of which kinds (D-356), "עבודה" for who approves their own requests (D-121, D-299), "חשבון" with
// who is signed in and installing the app where the device offers it (D-184), the dev identity switcher (D-006), and
// "התנתקות" at the foot.

const ICON = 16

const APPEARANCES = [
  { id: Appearance.enum.light, labelKey: 'account.appearanceLight', icon: <Sun aria-hidden size={ICON} /> },
  { id: Appearance.enum.dark, labelKey: 'account.appearanceDark', icon: <Moon aria-hidden size={ICON} /> },
  { id: Appearance.enum.system, labelKey: 'account.appearanceSystem', icon: <Monitor aria-hidden size={ICON} /> },
] as const

const ROW =
  'flex min-h-touch w-full cursor-pointer items-center justify-between gap-sm rounded-control text-start text-body outline-focus outline-offset-2 data-focus-visible:outline-2'

function Group({ titleKey, children }: { readonly titleKey: I18nKey; readonly children: ReactNode }) {
  return (
    <section aria-label={t(titleKey)} className="flex flex-col gap-xs">
      <h2 className="px-xs text-small font-bold text-text-muted">{t(titleKey)}</h2>
      <div className="flex flex-col gap-sm rounded-card bg-surface p-lg">{children}</div>
    </section>
  )
}

/** "עבודה": for who approves their own requests; it holds nothing for anyone else, so it is absent (D-076). */
function Work() {
  const own = useMyLeavesAccess()
  const preferences = useMyPreferences()
  if (own?.approve !== true || preferences.status !== 'ready') return null
  return (
    <Group titleKey="me.work">
      <ApproveNowSwitch />
    </Group>
  )
}

export function PreferencesPage({ identity }: { readonly identity: AuthIdentity }) {
  const place = useShellPlace()
  const { signOut } = useSignOut()
  const appearance = useAppearance()
  const reportSave = useReportPreferenceSave()
  const { offer, install } = useInstallOffer()
  const [iosHintOpen, setIosHintOpen] = useState(false)
  return (
    <PageFrame>
      <PageTop titleKey="me.preferences" />
      {appearance.editable ? (
        <section className="flex flex-col gap-xs">
          <h2 className="px-xs text-small font-bold text-text-muted">{t('account.appearance')}</h2>
          <Segmented
            labelKey="account.appearance"
            options={APPEARANCES}
            value={appearance.appearance}
            onChange={(next) => {
              reportSave(appearance.setAppearance(next))
            }}
          />
        </section>
      ) : null}
      <NotificationSettings
        onIosInstall={() => {
          setIosHintOpen(true)
        }}
      />
      <Work />
      <Group titleKey="me.account">
        <p className="flex min-h-touch items-center justify-between gap-sm text-body">
          <span className="shrink-0 text-text-muted">{t('me.signedInAs')}</span>
          <span dir="ltr" className="min-w-none truncate">
            {identity.email}
          </span>
        </p>
        {offer === 'none' ? null : (
          <AriaButton
            onPress={() => {
              if (offer === 'prompt') void install()
              else setIosHintOpen(true)
            }}
            className={ROW}
          >
            {t('account.install')}
            <Download aria-hidden size={ICON} className="shrink-0 text-text-muted" />
          </AriaButton>
        )}
        <IdentityList exclude={identity.auth_user_id} />
      </Group>
      <AriaButton
        onPress={() => {
          // The address keeps its search through sign-in (D-092): whoever signs in next starts on "היום", not here.
          place.openTab(DEFAULT_TAB)
          void signOut()
        }}
        className="flex min-h-touch w-full cursor-pointer items-center justify-center rounded-control text-body font-bold outline-focus outline-offset-2 data-focus-visible:outline-2"
      >
        {t('account.signOut')}
      </AriaButton>
      {iosHintOpen ? (
        <InfoDialog
          titleKey="account.installIosTitle"
          hintKey="account.installIosHint"
          onClose={() => {
            setIosHintOpen(false)
          }}
        />
      ) : null}
    </PageFrame>
  )
}
