import { SHELL } from '@config'
import { t, type I18nKey } from '@i18n'
import { useEffect } from 'react'
import { Button as AriaButton } from 'react-aria-components'

// The toast of the new interface (D-454): what just happened, in one line over the tab bar, for a few seconds. It
// carries "ביטול" only where the step can truly be taken back, and the action lives as long as the toast.

export interface ToastProps {
  readonly message: string
  readonly actionKey?: I18nKey
  readonly onAction?: () => void
  /** The toast's time is up. */
  readonly onDone: () => void
}

export function Toast({ message, actionKey, onAction, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, SHELL.toastMs)
    return () => {
      clearTimeout(timer)
    }
  }, [message, onDone])
  return (
    <div role="status" className="pointer-events-none fixed inset-x-lg bottom-above-bottom-bar z-10 flex justify-center pb-lg">
      <div className="glass-action pointer-events-auto flex min-h-touch max-w-full items-center gap-md rounded-full py-xs ps-lg pe-xs">
        <span className="min-w-none truncate text-small font-semibold">{message}</span>
        {actionKey === undefined || onAction === undefined ? (
          <span aria-hidden className="w-sm" />
        ) : (
          <AriaButton
            onPress={onAction}
            className="inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full bg-surface px-md text-small font-bold text-text outline-on-action outline-offset-2 data-focus-visible:outline-2"
          >
            {t(actionKey)}
          </AriaButton>
        )}
      </div>
    </div>
  )
}
