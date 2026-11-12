import { t, type I18nKey } from '@i18n'
import { useState, type ReactNode } from 'react'

// What scrolls in the viewport for an engine that draws no grid of its own (D-174): content starts under the floating
// bars and ends above the bottom bar and the floating "+" (D-115), as on the timeline.

export function EngineScroller({
  labelKey,
  children,
}: {
  readonly labelKey: I18nKey
  /** Receives the element that scrolls, for a virtualizer. */
  readonly children: (scroller: HTMLElement | null) => ReactNode
}) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null)
  return (
    <div
      ref={setScroller}
      role="region"
      aria-label={t(labelKey)}
      // A region that scrolls must be reachable by keyboard.
      tabIndex={0}
      className="h-full overflow-auto overscroll-contain outline-focus -outline-offset-2 focus-visible:outline-2"
    >
      <div aria-hidden className="h-under-bars md:h-under-bars-md" />
      {children(scroller)}
      <div aria-hidden className="h-above-bottom-bar" />
    </div>
  )
}
