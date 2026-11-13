import { FOCUS_MODE, TOOLTIP } from '@config'
import { t } from '@i18n'
import { Minimize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import { useFocusMode } from './focusMode'

// The one control focus mode leaves (D-301); "מצב מיקוד" itself is in the view sheet.

/** Between a control's name and its key, in its tooltip. */
const SHORTCUT_SEPARATOR = ' · '

/** The one button focus mode leaves, at the bottom corner on the inline end, clear of the name column. */
/** `children`: the page's heading, which the hidden top strip held. */
export function FocusModeRestore({ children }: { readonly children: ReactNode }) {
  const { leave, bind } = useFocusMode()
  const label = t('workspace.focusExit')
  return (
    <nav aria-label={t('workspace.navigation')} className="pointer-events-none absolute end-lg bottom-lg">
      {children}
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        <AriaButton
          ref={bind('restore')}
          aria-label={label}
          aria-keyshortcuts={FOCUS_MODE.shortcut}
          onPress={leave}
          className="glass-bar pointer-events-auto inline-flex size-touch cursor-pointer items-center justify-center rounded-pill text-text outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <Minimize2 aria-hidden size={18} />
        </AriaButton>
        <NameTooltip>{[label, FOCUS_MODE.shortcut].join(SHORTCUT_SEPARATOR)}</NameTooltip>
      </TooltipTrigger>
    </nav>
  )
}
