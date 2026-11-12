import { Appearance, type AuthIdentity } from '@contracts'
import { t } from '@i18n'
import {
  useAppearance,
  useAuthMode,
  useKnownIdentities,
  useMyPreferences,
  useSignIn,
  useSignOut,
  useInstallOffer,
  useUpdateMyPreferences,
} from '@logic'
import { Check, ChevronDown, CircleUser, Download, LogOut } from 'lucide-react'
import { useState } from 'react'
import { InfoDialog } from '../patterns/Dialogs'
import { useIsDesktop } from '../patterns/media'
import { useInboxAccess } from './inboxAccess'
import {
  Button as AriaButton,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
} from 'react-aria-components'

const ITEM =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control outline-none data-focused:bg-inner md:min-h-control'

const APPROVE_NOW = 'approve-now'

const APPEARANCES = [
  { key: Appearance.enum.light, labelKey: 'account.appearanceLight' },
  { key: Appearance.enum.dark, labelKey: 'account.appearanceDark' },
  { key: Appearance.enum.system, labelKey: 'account.appearanceSystem' },
] as const

/** Who is signed in, the dev identity switcher (D-006), the actor's own default (D-121), the appearance (D-181), installing the app when the device offers it (D-184) and sign-out. Import and export sit in the navigation panel (D-173). */
export function UserMenu({ identity }: { readonly identity: AuthIdentity }) {
  const authMode = useAuthMode()
  const { signOut } = useSignOut()
  const approves = useInboxAccess()
  const preferences = useMyPreferences()
  const savePreferences = useUpdateMyPreferences()
  const appearance = useAppearance()
  // On a phone the bottom bar holds every module, so the menu shows its icon and still reads the name (D-116).
  const isDesktop = useIsDesktop()
  const approveNow = preferences.status === 'ready' && preferences.value.create_leaves_as_approved
  const { offer, install } = useInstallOffer()
  const [iosHintOpen, setIosHintOpen] = useState(false)

  return (
    <>
      <MenuTrigger>
        <AriaButton
          className={`inline-flex min-h-touch cursor-pointer items-center gap-xs rounded-pill bg-inner text-control ${isDesktop ? 'px-md' : 'min-w-touch justify-center'} font-semibold text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2`}
        >
          <span className="sr-only">{t('account.menu')}</span>
          {isDesktop ? null : <CircleUser aria-hidden size={18} />}
          <span className={isDesktop ? 'max-w-menu truncate' : 'sr-only'}>{identity.display_name ?? identity.email}</span>
          {isDesktop ? <ChevronDown aria-hidden size={12} /> : null}
        </AriaButton>
        <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
          <Menu className="flex max-w-menu flex-col gap-2xs outline-none">
            {authMode === 'local' ? <IdentitySwitcher identity={identity} /> : null}
            {approves && preferences.status === 'ready' ? (
              <MenuSection
                selectionMode="multiple"
                selectedKeys={approveNow ? [APPROVE_NOW] : []}
                onSelectionChange={(keys) => {
                  void savePreferences.run({ create_leaves_as_approved: keys === 'all' || keys.has(APPROVE_NOW) })
                }}
                className="flex flex-col gap-2xs border-b border-line pb-xs"
              >
                <Header className="px-md py-xs text-label font-semibold text-text-muted">{t('account.preferences')}</Header>
                <MenuItem id={APPROVE_NOW} textValue={t('account.approveNowDefault')} className={ITEM}>
                  <span className="flex size-icon shrink-0 items-center justify-center rounded-bar border border-line">
                    {approveNow ? <Check aria-hidden size={12} strokeWidth={3} /> : null}
                  </span>
                  {t('account.approveNowDefault')}
                </MenuItem>
              </MenuSection>
            ) : null}
            {appearance.editable ? (
              <MenuSection
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[appearance.appearance]}
                onSelectionChange={(keys) => {
                  const chosen = APPEARANCES.find((one) => keys !== 'all' && keys.has(one.key))
                  if (chosen !== undefined) appearance.setAppearance(chosen.key)
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
