import { t, type I18nKey } from '@i18n'
import { ChevronLeft } from 'lucide-react'
import { useId, type ReactNode, type Ref } from 'react'
import { Button as AriaButton } from 'react-aria-components'

// The card of the new interface (D-454): white on the canvas, the card radius, 16 px inside, its title at heading
// size. A card whose title opens a page shows a chevron beside it.

const PRESS = 'cursor-pointer rounded-control outline-focus outline-offset-2 data-focus-visible:outline-2'

export interface CardProps {
  readonly titleKey: I18nKey
  /** Opens the page behind the card, from its title. */
  readonly onOpen?: () => void
  /** The title's button, for whoever returns the keyboard to it when that page closes. */
  readonly openRef?: Ref<HTMLButtonElement>
  /** Beside the title, at its inline end: a count or a badge. */
  readonly aside?: ReactNode
  readonly children: ReactNode
}

export function Card({ titleKey, onOpen, openRef, aside, children }: CardProps) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-sm rounded-card bg-surface p-lg">
      <div className="flex items-center justify-between gap-sm">
        <h2 id={id} className="min-w-none text-heading font-bold">
          {onOpen === undefined ? (
            t(titleKey)
          ) : (
            <AriaButton {...(openRef === undefined ? {} : { ref: openRef })} onPress={onOpen} className={`flex min-h-touch items-center gap-xs text-start ${PRESS}`}>
              {t(titleKey)}
              <ChevronLeft aria-hidden size={18} className="shrink-0 text-text-muted" />
            </AriaButton>
          )}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** The door at the foot of a card to everything it did not show (D-459). */
export function CardDoor({ labelKey, onPress }: { readonly labelKey: I18nKey; readonly onPress: () => void }) {
  return (
    <AriaButton
      onPress={onPress}
      className={`flex min-h-touch w-full items-center justify-between gap-sm text-small font-semibold text-text-muted ${PRESS}`}
    >
      {t(labelKey)}
      <ChevronLeft aria-hidden size={16} className="shrink-0" />
    </AriaButton>
  )
}
