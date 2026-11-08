import type { AuthIdentity } from '@contracts'
import { t } from '@i18n'
import { useKnownIdentities, useSignIn, useSignOut } from '@logic'
import { ChevronDown, LogOut } from 'lucide-react'
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

/** Who is signed in, the dev identity switcher (D-006) and sign-out. */
export function UserMenu({ identity }: { readonly identity: AuthIdentity }) {
  const identities = useKnownIdentities()
  const { signIn } = useSignIn()
  const { signOut } = useSignOut()
  const others =
    identities.status === 'ready'
      ? identities.value.filter((known) => known.auth_user_id !== identity.auth_user_id)
      : []

  return (
    <MenuTrigger>
      <AriaButton
        className="inline-flex min-h-touch cursor-pointer items-center gap-xs rounded-pill bg-inner px-md text-control font-semibold text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2"
      >
        <span className="sr-only">{t('account.menu')}</span>
        <span className="max-w-menu truncate">{identity.display_name ?? identity.email}</span>
        <ChevronDown aria-hidden size={12} />
      </AriaButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu className="flex max-w-menu flex-col gap-2xs outline-none">
          {others.length === 0 ? null : (
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
  )
}
