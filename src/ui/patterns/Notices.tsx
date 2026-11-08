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
}: {
  readonly titleKey: I18nKey
  readonly bodyKey: I18nKey
  readonly children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-sm py-2xl text-center">
      <h3 className="text-body font-bold">{t(titleKey)}</h3>
      <p className="text-name text-text-muted">{t(bodyKey)}</p>
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
