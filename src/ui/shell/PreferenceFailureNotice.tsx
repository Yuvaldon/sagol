import type { AppError } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { X } from 'lucide-react'
import { failureKey } from '../errors/messages'
import { IconButton } from '../primitives/Button'
import { usePreferenceFailure } from './preferenceFailure'

/** A choice another device changed first reads as such; the soldier chooses again over the stored row (D-187). */
function messageOf(error: AppError): I18nKey {
  return error.code === 'stale_version' ? 'account.preferenceChangedElsewhere' : failureKey(error)
}

/** A preference save that failed, over the workspace until dismissed or a later save succeeds (D-187). */
export function PreferenceFailureNotice() {
  const { error, dismiss } = usePreferenceFailure()
  if (error === null) return null
  return (
    <div className="pointer-events-none fixed inset-x-lg top-safe z-10 flex justify-center">
      <div role="alert" className="glass-card pointer-events-auto flex items-center gap-sm rounded-pill py-xs ps-lg pe-xs">
        <span className="text-name font-semibold text-status-rejected">{t(messageOf(error))}</span>
        <IconButton labelKey="common.close" onPress={dismiss}>
          <X aria-hidden size={16} />
        </IconButton>
      </div>
    </div>
  )
}
