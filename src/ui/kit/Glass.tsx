import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'

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

/** One icon on glass, 44 px. Its name is read aloud; a number that waits shows as a dot and is read with it. */
export function GlassCircle({ labelKey, onPress, count = 0, countKey, children }: GlassCircleProps) {
  return (
    <AriaButton
      onPress={onPress}
      className={`glass-regular pointer-events-auto relative inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text ${FOCUS}`}
    >
      {children}
      <span className="sr-only">{t(labelKey)}</span>
      {count > 0 ? (
        <>
          <span aria-hidden className="absolute end-sm top-sm size-dot rounded-full border border-surface bg-status-pending-line" />
          {countKey === undefined ? null : (
            // The leading space keeps the number apart from the name when both are read as one.
            <span className="sr-only">{['', String(count), t(countKey)].join(WORD)}</span>
          )}
        </>
      ) : null}
    </AriaButton>
  )
}

/** A row of controls on one piece of glass. */
export function GlassCapsule({ children }: { readonly children: ReactNode }) {
  return <div className="glass-bar pointer-events-auto flex items-center gap-2xs rounded-full p-xs">{children}</div>
}
