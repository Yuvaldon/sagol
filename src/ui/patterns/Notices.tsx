import type { AppError } from '@contracts'
import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { failureKey } from '../errors/messages'

// What a module shows beside its content: a refused action, a state of the list.

/** Why an action was refused. It is announced as soon as it appears. */
export function FailureNotice({ error, children }: { readonly error: AppError; readonly children?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-sm rounded-control border border-status-rejected p-md">
      <p className="text-name text-status-rejected">{t(failureKey(error))}</p>
      {children}
    </div>
  )
}

export function EmptyNotice({
  titleKey,
  bodyKey,
  children,
  headingLevel = 3,
}: {
  readonly titleKey: I18nKey
  /** Only when it says why there is nothing to do here (D-215). */
  readonly bodyKey?: I18nKey | undefined
  readonly children?: ReactNode
  /** 3 inside a drawer, 2 in the viewport, so headings never skip a level. */
  readonly headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-col items-center gap-sm py-2xl text-center">
      <Heading className="text-body font-bold">{t(titleKey)}</Heading>
      {bodyKey === undefined ? null : <p className="text-name text-text-muted">{t(bodyKey)}</p>}
      {children}
    </div>
  )
}

export function LoadingNotice() {
  return (
    <p role="status" className="py-xl text-center text-name text-text-muted">
      {t('app.loading')}
    </p>
  )
}
