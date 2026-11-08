import type { EnvIssue } from '@config'
import type { AppError } from '@contracts'
import { t } from '@i18n'
import { envIssueKey, errorKey } from '../errors/messages'
import { CenteredSheet } from '../patterns/Sheet'
import { Button } from '../primitives/Button'

export function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas">
      <p role="status" className="text-name text-text-muted">
        {t('app.loading')}
      </p>
    </main>
  )
}

export function FailureScreen({ error }: { readonly error: AppError }) {
  return (
    <CenteredSheet titleKey="failure.title">
      <p role="alert" className="text-name">
        {t(errorKey(error))}
      </p>
      <Button
        onPress={() => {
          location.reload()
        }}
      >
        {t('failure.retry')}
      </Button>
    </CenteredSheet>
  )
}

/** The env is invalid, or names a provider that is not built yet (D-086). */
export type StartupFailure =
  | { readonly kind: 'invalid_env'; readonly issues: readonly EnvIssue[] }
  | { readonly kind: 'not_built' }

export function StartupFailureScreen({ failure }: { readonly failure: StartupFailure }) {
  if (failure.kind === 'not_built') {
    return (
      <CenteredSheet titleKey="startup.title">
        <p role="alert" className="text-name">
          {t('startup.unsupported')}
        </p>
      </CenteredSheet>
    )
  }
  return (
    <CenteredSheet titleKey="startup.title" hintKey="startup.hint">
      <div role="alert">
        <ul className="flex flex-col gap-xs text-name">
          {failure.issues.map((issue) => (
            <li key={issue.variable} className="flex flex-wrap items-baseline gap-sm">
              <code dir="ltr">{issue.variable}</code>
              <span className="text-text-muted">{t(envIssueKey(issue.code))}</span>
            </li>
          ))}
        </ul>
      </div>
    </CenteredSheet>
  )
}
