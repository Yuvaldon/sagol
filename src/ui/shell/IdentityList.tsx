import { t } from '@i18n'
import { useKnownIdentities, useSignIn } from '@logic'
import { Button } from '../primitives/Button'

/** Identities that signed in on this device: the dev identity switcher (D-006, D-048). */
export function IdentityList({ exclude }: { readonly exclude?: string }) {
  const identities = useKnownIdentities()
  const { signIn, isPending } = useSignIn()
  if (identities.status !== 'ready') return null
  const others = identities.value.filter((identity) => identity.auth_user_id !== exclude)
  if (others.length === 0) return null
  return (
    <section className="flex flex-col gap-sm border-t border-line pt-lg">
      <h2 className="text-label font-semibold text-text-muted">{t('identities.title')}</h2>
      <ul className="flex flex-col gap-xs">
        {others.map((identity) => (
          <li key={identity.auth_user_id}>
            <Button
              isDisabled={isPending}
              onPress={() => {
                void signIn({ email: identity.email, display_name: identity.display_name })
              }}
            >
              <span className="font-normal">{t('identities.signInAs')}</span>
              <span dir="ltr">{identity.email}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
