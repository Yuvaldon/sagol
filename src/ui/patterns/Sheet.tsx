import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'

/** A full-screen state outside the workspace: one glass card on the canvas. */
export function CenteredSheet({
  titleKey,
  hintKey,
  children,
}: {
  readonly titleKey: I18nKey
  readonly hintKey?: I18nKey
  readonly children?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-lg">
      <div className="glass-card flex w-full max-w-sheet flex-col gap-lg rounded-sheet p-xl">
        <header className="flex flex-col gap-xs">
          <h1 className="text-title font-bold tracking-tight">{t(titleKey)}</h1>
          {hintKey === undefined ? null : <p className="text-name text-text-muted">{t(hintKey)}</p>}
        </header>
        {children}
      </div>
    </main>
  )
}
