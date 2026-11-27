import type { AppError } from '@contracts'
import type { I18nKey } from '@i18n'
import { createContext, useContext } from 'react'

// The toast of "ניהול" and of the drawers over it (D-482): what a step on a page or in a drawer did, in one line over the
// tab bar. A step that can be taken back carries "ביטול" (D-461); a refusal stays until it is put away (D-473). One
// region for the workspace (`NoticeScope`), so a drawer that closes as it answers still shows its answer.

export interface NoticeAction {
  readonly labelKey: I18nKey
  readonly run: () => void
}

export interface Notices {
  /** Says what happened, with what can be done about it. */
  readonly say: (message: string, action?: NoticeAction) => void
  /** Says why a step was refused; it stays until it is put away. */
  readonly fail: (error: AppError) => void
}

export const NoticeContext = createContext<Notices>({
  say: () => undefined,
  fail: () => undefined,
})

export function useNotices(): Notices {
  return useContext(NoticeContext)
}

