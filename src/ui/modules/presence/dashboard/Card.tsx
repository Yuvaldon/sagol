import type { AppError } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { FailureNotice, LoadingNotice } from '../../../patterns/Notices'
import { IconButton } from '../../../primitives/Button'

// A module of the command board (D-349): its title, what it counts, and in edit mode the way to move or remove it.

/** The edit controls of a card, present only while the board is edited. */
export interface CardEdit {
  readonly onUp: (() => void) | null
  readonly onDown: (() => void) | null
  readonly onRemove: () => void
}

const SURFACE = 'flex min-w-none flex-col gap-sm rounded-control border border-line bg-surface p-md'

export function Card({
  titleKey,
  note,
  state,
  error,
  edit,
  span,
  children,
}: {
  readonly titleKey: I18nKey
  /** "לפי {n} ימים", or a hint of what the card shows. */
  readonly note: string | null
  readonly state: 'loading' | 'ready' | 'failed' | 'hidden'
  readonly error: AppError | null
  readonly edit: CardEdit | null
  /** The card's width on the board's grid. */
  readonly span: string
  readonly children?: ReactNode
}) {
  const headingId = useId()
  const body = (() => {
    if (state === 'loading') return <LoadingNotice />
    if (state === 'failed' && error !== null) return <FailureNotice error={error} />
    if (state === 'hidden') return <p className="text-name text-text-muted">{t('dashboard.hiddenHere')}</p>
    return children
  })()
  const className = `${SURFACE} ${span}`
  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex items-start gap-sm">
        <div className="flex min-w-none flex-1 flex-col">
          <h3 id={headingId} className="text-label font-semibold text-text-muted">
            {t(titleKey)}
          </h3>
          {note === null ? null : <p className="text-micro text-text-muted">{note}</p>}
        </div>
        {edit === null ? null : (
          <div className="flex shrink-0 items-center gap-2xs">
            <IconButton labelKey="dashboard.moveUp" isDisabled={edit.onUp === null} onPress={() => edit.onUp?.()}>
              <ArrowUp aria-hidden size={14} />
            </IconButton>
            <IconButton labelKey="dashboard.moveDown" isDisabled={edit.onDown === null} onPress={() => edit.onDown?.()}>
              <ArrowDown aria-hidden size={14} />
            </IconButton>
            <IconButton labelKey="dashboard.remove" onPress={edit.onRemove}>
              <X aria-hidden size={14} />
            </IconButton>
          </div>
        )}
      </div>
      {body}
    </section>
  )
}
