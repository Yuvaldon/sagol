import { TOOLTIP } from '@config'
import { t } from '@i18n'
import { useEffect, useRef } from 'react'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'
import { useBoardView, viewMeta } from './views'
import { NameTooltip } from '../primitives/Button'
import { useFocusMode } from '../shell/focusMode'
import { useLongPress } from './gestures'

// The view switcher, "the fan" (the handoff's `02`, "Board"; §2 of its board spec): the icon of the view in sight; a
// tap fans the other views out along the capsule, the one in sight underlined, and a pick folds them into the new one.
// A tap anywhere else, or Escape, folds them back. Holding the icon opens the saved views, which the options menu also
// holds (D-458).

const ICON = 20
const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const BUTTON = `relative inline-flex size-touch shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-text ${FOCUS}`

export interface ViewFanProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Opens the saved views: what holding the icon does. NULL where there are none to offer. */
  readonly onSavedViews: (() => void) | null
}

export function ViewFan({ open, onOpenChange, onSavedViews }: ViewFanProps) {
  const { view, views, select } = useBoardView()
  const fan = useRef<HTMLDivElement>(null)
  const hold = useLongPress(onSavedViews)
  const focusMode = useFocusMode()
  // A tap outside the fan folds it (the handoff's board spec, §1.7).
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && fan.current?.contains(event.target) === true) return
      onOpenChange(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])
  const current = viewMeta(view)
  const label = t('workspace.view')
  if (!open) {
    return (
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        <AriaButton
          // The keyboard returns here when focus mode ends (D-301).
          ref={focusMode.bind('control')}
          aria-label={label}
          aria-expanded={false}
          onPointerDownCapture={hold.onPointerDown}
          onPointerMove={hold.onPointerMove}
          onPointerUpCapture={hold.onPointerUp}
          onPointerCancel={hold.onPointerCancel}
          onPress={() => {
            if (hold.consumed()) return
            onOpenChange(true)
          }}
          className={BUTTON}
        >
          <current.Icon aria-hidden size={ICON} />
        </AriaButton>
        <NameTooltip>{t(current.labelKey)}</NameTooltip>
      </TooltipTrigger>
    )
  }
  return (
    <div ref={fan} role="group" aria-label={t('board.fan')} className="flex items-center gap-2xs">
      {views.map((id) => {
        const entry = viewMeta(id)
        const shown = id === view
        return (
          <AriaButton
            key={id}
            // The view in sight takes the keyboard as the fan opens, so Escape and Tab start from it.
            autoFocus={shown}
            aria-pressed={shown}
            aria-label={t(entry.labelKey)}
            onPress={() => {
              select(id)
              onOpenChange(false)
            }}
            className={`${BUTTON} enter-fan`}
          >
            <entry.Icon aria-hidden size={ICON} />
            {shown ? <span aria-hidden className="absolute inset-x-md bottom-xs h-hairline rounded-full bg-action-solid" /> : null}
          </AriaButton>
        )
      })}
    </div>
  )
}
