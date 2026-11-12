import { TOOLTIP } from '@config'
import { Appearance, RulesRowPlacement, type AuthIdentity } from '@contracts'
import { t } from '@i18n'
import {
  useAppearance,
  useAuthMode,
  useKnownIdentities,
  useSignIn,
  useSignOut,
  useInstallOffer,
  useModuleAccess,
  useNavigationPreferences,
} from '@logic'
import { Check, CircleUser, Download, LogOut } from 'lucide-react'
import { useState } from 'react'
import { InfoDialog } from '../patterns/Dialogs'
import { NameTooltip } from '../primitives/Button'
import { useReportPreferenceSave } from './preferenceFailure'
import {
  Button as AriaButton,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  TooltipTrigger,
} from 'react-aria-components'

const ITEM =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control outline-none data-focused:bg-inner md:min-h-control'

const APPEARANCES = [
  { key: Appearance.enum.light, labelKey: 'account.appearanceLight' },
  { key: Appearance.enum.dark, labelKey: 'account.appearanceDark' },
  { key: Appearance.enum.system, labelKey: 'account.appearanceSystem' },
] as const

const PLACEMENTS = [
  { key: RulesRowPlacement.enum.above, labelKey: 'account.rulesRowAbove' },
  { key: RulesRowPlacement.enum.below, labelKey: 'account.rulesRowBelow' },
] as const

/** Who is signed in, the dev identity switcher (D-006), the appearance with the rules row's place (D-181, D-253), installing the app when the device offers it (D-184) and sign-out. Nothing about the unit's work is here (D-253). */
export function UserMenu({ identity }: { readonly identity: AuthIdentity }) {
  const authMode = useAuthMode()
  const { signOut } = useSignOut()
  const appearance = useAppearance()
  const navigation = useNavigationPreferences()
  // The rules row's place is for who sees the rules, once the preferences it is saved in have loaded.
  const rulesRow = useModuleAccess().rules && navigation.editable
  const reportSave = useReportPreferenceSave()
  // The account is an avatar at the bar's inline end (V20); its name shows on hover and is read aloud.
  const name = identity.display_name ?? identity.email
  const { offer, install } = useInstallOffer()
  const [iosHintOpen, setIosHintOpen] = useState(false)

  return (
    <>
      <MenuTrigger>
        <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
          <AriaButton className="inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center rounded-pill bg-inner text-text outline-focus outline-offset-2 md:min-h-control md:min-w-control data-focus-visible:outline-2 data-hovered:bg-line">
            <CircleUser aria-hidden size={18} />
            <span className="sr-only">
              {t('account.menu')} {name}
            </span>
          </AriaButton>
          <NameTooltip>{name}</NameTooltip>
        </TooltipTrigger>
        <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
          <Menu className="flex max-w-menu flex-col gap-2xs outline-none">
            {authMode === 'local' ? <IdentitySwitcher identity={identity} /> : null}
            {appearance.editable ? (
              <MenuSection
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[appearance.appearance]}
                onSelectionChange={(keys) => {
                  const chosen = APPEARANCES.find((one) => keys !== 'all' && keys.has(one.key))
                  if (chosen !== undefined) reportSave(appearance.setAppearance(chosen.key))
                }}
                className="flex flex-col gap-2xs border-b border-line pb-xs"
              >
                <Header className="px-md py-xs text-label font-semibold text-text-muted">{t('account.appearance')}</Header>
                {APPEARANCES.map((one) => (
                  <MenuItem key={one.key} id={one.key} textValue={t(one.labelKey)} className={ITEM}>
                    <span className="flex size-icon shrink-0 items-center justify-center">
                      {appearance.appearance === one.key ? <Check aria-hidden size={12} strokeWidth={3} /> : null}
                    </span>
                    {t(one.labelKey)}
                  </MenuItem>
                ))}
              </MenuSection>
            ) : null}
            {rulesRow ? (
              <MenuSection
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[navigation.rulesRow]}
                onSelectionChange={(keys) => {
                  const chosen = PLACEMENTS.find((one) => keys !== 'all' && keys.has(one.key))
                  if (chosen !== undefined) reportSave(navigation.setRulesRow(chosen.key))
                }}
                className="flex flex-col gap-2xs border-b border-line pb-xs"
              >
                <Header className="px-md py-xs text-label font-semibold text-text-muted">{t('account.rulesRow')}</Header>
                {PLACEMENTS.map((one) => (
                  <MenuItem key={one.key} id={one.key} textValue={t(one.labelKey)} className={ITEM}>
                    <span className="flex size-icon shrink-0 items-center justify-center">
                      {navigation.rulesRow === one.key ? <Check aria-hidden size={12} strokeWidth={3} /> : null}
                    </span>
                    {t(one.labelKey)}
                  </MenuItem>
                ))}
              </MenuSection>
            ) : null}
            {offer === 'none' ? null : (
              <MenuSection className="flex flex-col gap-2xs border-b border-line pb-xs">
                <MenuItem
                  id="install"
                  textValue={t('account.install')}
                  className={ITEM}
                  onAction={() => {
                    if (offer === 'prompt') void install()
                    else setIosHintOpen(true)
                  }}
                >
                  <Download aria-hidden size={14} />
                  {t('account.install')}
                </MenuItem>
              </MenuSection>
            )}
            <MenuItem
              id="sign-out"
              textValue={t('account.signOut')}
              className={ITEM}
              onAction={() => {
                void signOut()
              }}
            >
              <LogOut aria-hidden size={14} />
              {t('account.signOut')}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {iosHintOpen ? (
        <InfoDialog
          titleKey="account.installIosTitle"
          hintKey="account.installIosHint"
          onClose={() => {
            setIosHintOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

/** The dev identity switcher (D-006): local mode only, where identities live on this device (D-207). */
function IdentitySwitcher({ identity }: { readonly identity: AuthIdentity }) {
  const identities = useKnownIdentities()
  const { signIn } = useSignIn()
  const others =
    identities.status === 'ready'
      ? identities.value.filter((known) => known.auth_user_id !== identity.auth_user_id)
      : []
  if (others.length === 0) return null
  return (
    <MenuSection className="flex flex-col gap-2xs border-b border-line pb-xs">
      <Header className="px-md py-xs text-label font-semibold text-text-muted">
        {t('account.switchIdentity')}
      </Header>
      {others.map((known) => (
        <MenuItem
          key={known.auth_user_id}
          id={known.auth_user_id}
          textValue={known.email}
          className={ITEM}
          onAction={() => {
            void signIn({ email: known.email, display_name: known.display_name })
          }}
        >
          <span dir="ltr" className="truncate">
            {known.email}
          </span>
        </MenuItem>
      ))}
    </MenuSection>
  )
}
