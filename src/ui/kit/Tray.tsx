import { t, type I18nKey } from '@i18n'
import { X } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'

// The tray (D-454): while something is selected, it takes the tab bar's place and offers the one action the selection
// has. Clearing the selection returns the bar.

export interface TrayProps {
  /** Names the tray for readers. */
  readonly labelKey: I18nKey
  /** The action with what it will act on, "בקשת יציאה · 3 ימים". */
  readonly action: string
  readonly onAction: () => void
  readonly clearKey: I18nKey
  readonly onClear: () => void
}

const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'

export function Tray({ labelKey, action, onAction, clearKey, onClear }: TrayProps) {
  return (
    <div role="group" aria-label={t(labelKey)} className="glass-regular pointer-events-auto flex max-w-full items-center gap-xs rounded-full p-xs">
      <AriaButton
        onPress={onAction}
        className={`inline-flex min-h-tab min-w-none cursor-pointer items-center justify-center rounded-full bg-action-solid px-xl text-body font-bold text-on-action shadow-primary ${FOCUS}`}
      >
        <span className="truncate tabular-nums">{action}</span>
      </AriaButton>
      <AriaButton
        aria-label={t(clearKey)}
        onPress={onClear}
        className={`inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted ${FOCUS}`}
      >
        <X aria-hidden size={18} />
      </AriaButton>
    </div>
  )
}
