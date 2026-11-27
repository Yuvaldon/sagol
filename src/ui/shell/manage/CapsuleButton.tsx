import { TOOLTIP } from '@config'
import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../../primitives/Button'

// A tool on a page's capsule (D-482): an icon on the glass, 44 px, its name read aloud and shown as a tooltip, as the
// options menu's trigger is drawn beside it.

export function CapsuleButton({
  labelKey,
  onPress,
  pressed,
  children,
}: {
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** A tool that stays on, the search: read as pressed while it is. */
  readonly pressed?: boolean
  readonly children: ReactNode
}) {
  const label = t(labelKey)
  return (
    <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
      <AriaButton
        aria-label={label}
        {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
        onPress={onPress}
        className={`inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text outline-focus outline-offset-2 data-focus-visible:outline-2 ${
          pressed === true ? 'bg-surface' : ''
        }`}
      >
        {children}
      </AriaButton>
      <NameTooltip>{label}</NameTooltip>
    </TooltipTrigger>
  )
}
