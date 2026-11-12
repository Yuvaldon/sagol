import { t } from '@i18n'
import { useInstallInvitation } from '@logic'
import { useState } from 'react'
import { InfoDialog } from '../patterns/Dialogs'
import { Button } from '../primitives/Button'

/**
 * The one-time install offer after sign-in (D-274), as the user menu offers it (D-184): the browser's own prompt, or
 * on an iPhone the Share hint. Either answer, or "not now", keeps it away on this device; the menu item stays.
 */
export function InstallInvitation() {
  const { offer, install, answer } = useInstallInvitation()
  const [iosHintOpen, setIosHintOpen] = useState(false)
  if (iosHintOpen) {
    return (
      <InfoDialog
        titleKey="account.installIosTitle"
        hintKey="account.installIosHint"
        onClose={() => {
          setIosHintOpen(false)
          answer()
        }}
      />
    )
  }
  if (offer === 'none') return null
  return (
    <div className="pointer-events-none fixed inset-x-lg bottom-above-bottom-bar z-10 flex justify-center">
      <section
        aria-label={t('account.installOffer')}
        className="glass-card pointer-events-auto flex flex-wrap items-center justify-center gap-sm rounded-panel py-xs ps-lg pe-xs"
      >
        <span className="text-name font-semibold">{t('account.installOffer')}</span>
        <div className="flex items-center gap-xs">
          <Button
            variant="primary"
            onPress={() => {
              if (offer === 'prompt') {
                answer()
                void install()
              } else setIosHintOpen(true)
            }}
          >
            {t('account.installAccept')}
          </Button>
          <Button onPress={answer}>{t('account.installNotNow')}</Button>
        </div>
      </section>
    </div>
  )
}
