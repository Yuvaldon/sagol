import { TOOLTIP } from '@config'
import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'

// The glass of the new interface (D-454): a circle for one floating action in a corner, and a capsule that holds a row
// of controls. Glass floats over content only; a card or a list is never glass.

const WORD = ' '
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'

export interface GlassCircleProps {
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** What waits behind the circle; zero shows nothing. Read with `countKey` after the name. */
  readonly count?: number
  readonly countKey?: I18nKey
  readonly children: ReactNode
}

/** One icon on glass, 44 px. Its name is read aloud and shows as a tooltip; a number that waits shows as a dot and is read with the name. */
export function GlassCircle({ labelKey, onPress, count = 0, countKey, children }: GlassCircleProps) {
  const label = t(labelKey)
  const name = count > 0 && countKey !== undefined ? [label, String(count), t(countKey)].join(WORD) : label
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        aria-label={name}
        onPress={onPress}
        className={`glass-regular pointer-events-auto relative inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text ${FOCUS}`}
      >
        {children}
        {count > 0 ? <span aria-hidden className="absolute end-sm top-sm size-dot rounded-full border border-surface bg-status-pending-line" /> : null}
      </AriaButton>
      <NameTooltip>{label}</NameTooltip>
    </TooltipTrigger>
  )
}

/** A row of controls on one piece of glass. */
export function GlassCapsule({ children }: { readonly children: ReactNode }) {
  return <div className="glass-bar pointer-events-auto flex items-center gap-2xs rounded-full p-xs">{children}</div>
}
