import { DEFAULT_TAB, PANEL_IDS } from '@config'
import { Appearance, type AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useAppearance, useInstallOffer, useMyLeavesAccess, usePanel, useRotationScope, useShellPlace, useSignOut } from '@logic'
import { ChevronLeft, Download, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Card } from '../../kit/Card'
import { InfoDialog } from '../../patterns/Dialogs'
import { Segmented } from '../../primitives/Segmented'
import { IdentityList } from '../IdentityList'
import { PageFrame, PageHead } from '../PageFrame'
import { useReportPreferenceSave } from '../preferenceFailure'
import { NotificationSettings } from './NotificationSettings'

// "אני" (D-455): who is signed in, their own requests, and what is theirs to set on this account: the appearance
// (D-181), notifications (D-356), installing the app where the device offers it (D-184), the dev identity switcher
// (D-006) and sign-out. Nothing about the unit's work is here (D-253).

const ICON = 16

const APPEARANCES = [
  { id: Appearance.enum.light, labelKey: 'account.appearanceLight', icon: <Sun aria-hidden size={ICON} /> },
  { id: Appearance.enum.dark, labelKey: 'account.appearanceDark', icon: <Moon aria-hidden size={ICON} /> },
  { id: Appearance.enum.system, labelKey: 'account.appearanceSystem', icon: <Monitor aria-hidden size={ICON} /> },
] as const

const ROW =
  'flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control text-start text-body font-semibold outline-focus outline-offset-2 data-focus-visible:outline-2'

export function MePage({ identity }: { readonly identity: AuthIdentity }) {
  const panel = usePanel()
  const place = useShellPlace()
  const { signOut } = useSignOut()
  const appearance = useAppearance()
  const reportSave = useReportPreferenceSave()
  const { offer, install } = useInstallOffer()
  const mine = useMyLeavesAccess()
  const { requests } = useRotationScope()
  const [iosHintOpen, setIosHintOpen] = useState(false)
  const named = identity.display_name !== null && identity.display_name !== ''
  return (
    <PageFrame updates>
      <PageHead>
        <h1 className="truncate text-title font-bold tracking-tight">{named ? identity.display_name : t('shell.tabMe')}</h1>
        <p dir="ltr" className="truncate text-end text-body text-text-muted">
          {identity.email}
        </p>
      </PageHead>
      {/* The soldier's own requests are a request surface: they exist while a rotation they can be about does (D-218). */}
      {requests && mine?.view === true ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.myLeaves)
          }}
          className="flex min-h-touch w-full cursor-pointer items-center justify-between gap-sm rounded-card bg-surface p-lg text-start text-body font-semibold outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          {t('myLeaves.openTitle')}
          <ChevronLeft aria-hidden size={ICON} className="shrink-0 text-text-muted" />
        </AriaButton>
      ) : null}
      {appearance.editable ? (
        <Card titleKey="account.appearance">
          <Segmented
            labelKey="account.appearance"
            options={APPEARANCES}
            value={appearance.appearance}
            onChange={(next) => {
              reportSave(appearance.setAppearance(next))
            }}
          />
        </Card>
      ) : null}
      <NotificationSettings
        onIosInstall={() => {
          setIosHintOpen(true)
        }}
      />
      <Card titleKey="me.account">
        {offer === 'none' ? null : (
          <AriaButton
            onPress={() => {
              if (offer === 'prompt') void install()
              else setIosHintOpen(true)
            }}
            className={ROW}
          >
            <Download aria-hidden size={ICON} className="shrink-0 text-text-muted" />
            {t('account.install')}
          </AriaButton>
        )}
        <AriaButton
          onPress={() => {
            // The address keeps its search through sign-in (D-092): whoever signs in next starts on "היום", not here.
            place.openTab(DEFAULT_TAB)
            void signOut()
          }}
          className={ROW}
        >
          <LogOut aria-hidden size={ICON} className="shrink-0 text-text-muted" />
          {t('account.signOut')}
        </AriaButton>
        <IdentityList exclude={identity.auth_user_id} />
      </Card>
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
