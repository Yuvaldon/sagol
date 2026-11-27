import { SHELL } from '@config'
import { t, type I18nKey } from '@i18n'
import { useShellPlace } from '@logic'
import { ArrowRight, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCapsule, GlassCircle } from '../../kit/Glass'
import { PageHeading } from '../PageFrame'

// The head of a page of "ניהול" (the handoff's inner pages, D-482): a round glass back button, the title at 28 on the
// background, the page's tools on one glass capsule at the other end, and one quiet line under them. A temporary full
// screen closes with ✕ instead of going back.

export interface PageTopProps {
  readonly titleKey: I18nKey
  /** What the page holds, in one line: "פלוגה ב׳ · 16 חיילים". */
  readonly detail?: string | null
  /** The page's tools, on the capsule. */
  readonly tools?: ReactNode
  /** A temporary full screen: ✕ in place of the back button. */
  readonly closes?: boolean
}

export function PageTop({ titleKey, detail = null, tools = null, closes = false }: PageTopProps) {
  const place = useShellPlace()
  return (
    <header className="flex flex-col gap-xs">
      <div className="flex min-h-touch items-center gap-sm">
        <GlassCircle labelKey={closes ? 'common.close' : 'shell.back'} onPress={place.closePage}>
          {closes ? <X aria-hidden size={SHELL.cornerIconPx} /> : <ArrowRight aria-hidden size={SHELL.cornerIconPx} />}
        </GlassCircle>
        <PageHeading opens className="min-w-none flex-1 truncate text-title font-bold tracking-tight">
          {t(titleKey)}
        </PageHeading>
        {tools === null ? null : <GlassCapsule>{tools}</GlassCapsule>}
      </div>
      {detail === null ? null : <p className="text-body text-text-muted tabular-nums">{detail}</p>}
    </header>
  )
}
