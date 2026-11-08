import './theme/tailwind.css'
import { DATE_LOCALE } from '@config'
import { t } from '@i18n'
import type { ReactNode } from 'react'
import { I18nProvider } from 'react-aria-components'

/** What every screen stands on: the theme, the document title, and RTL for React Aria. */
export function UiRoot({ children }: { readonly children: ReactNode }) {
  return (
    <I18nProvider locale={DATE_LOCALE}>
      <title>{t('app.name')}</title>
      {children}
    </I18nProvider>
  )
}
