import { t } from '@i18n'
import { useAppUpdate } from '@logic'
import { Button } from '../primitives/Button'

/** A new version is waiting (D-183): the soldier reloads when it suits them, never in the middle of a form. */
export function UpdateToast() {
  const { ready, reload } = useAppUpdate()
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-lg top-safe z-10 flex justify-center">
      {ready ? (
        <div className="glass-card pointer-events-auto flex items-center gap-md rounded-pill py-xs ps-lg pe-xs">
          <span className="text-name font-semibold">{t('app.updateReady')}</span>
          <Button variant="primary" onPress={reload}>
            {t('app.updateReload')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
