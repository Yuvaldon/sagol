import './theme/tailwind.css'
import { APP_STAGES, DATE_LOCALE } from '@config'
import { t } from '@i18n'
import { useLayoutEffect, type ReactNode } from 'react'
import { I18nProvider } from 'react-aria-components'
import { StageBand } from './shell/StageBand'

interface UiRootProps {
  readonly children: ReactNode
  /** The deploy is staging (production by default): the band, the staging title, and the stage on the root element for the theme (D-300). */
  readonly staging?: boolean
}

/** What every screen stands on: the theme, the document title, the staging band, and RTL for React Aria. */
export function UiRoot({ children, staging = false }: UiRootProps) {
  useLayoutEffect(() => {
    if (!staging) return undefined
    const root = document.documentElement
    root.dataset.stage = APP_STAGES.staging
    return () => {
      delete root.dataset.stage
    }
  }, [staging])
  return (
    <I18nProvider locale={DATE_LOCALE}>
      <title>{staging ? t('app.stagingName') : t('app.name')}</title>
      {staging && <StageBand />}
      {children}
    </I18nProvider>
  )
}
