import { t } from '@i18n'
import { useDateWindow } from '@logic'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateRange } from '../patterns/dates'
import { Button, IconButton } from '../primitives/Button'

// Week navigation (D-103). The product is RTL only, so "back" points to the inline start, the right.
// "Today" appears only while the window does not hold today (D-076).

export function WindowNavigator() {
  const { window, shift, goToToday } = useDateWindow()
  if (window === null) return null
  return (
    <div className="flex shrink-0 items-center gap-2xs">
      <IconButton
        labelKey="workspace.previousWindow"
        onPress={() => {
          shift(-1)
        }}
      >
        <ChevronRight aria-hidden size={14} />
      </IconButton>
      <p aria-live="polite" className="text-control font-semibold whitespace-nowrap tabular-nums">
        <span className="sr-only">{t('workspace.window')} </span>
        {formatDateRange(window.from, window.to)}
      </p>
      <IconButton
        labelKey="workspace.nextWindow"
        onPress={() => {
          shift(1)
        }}
      >
        <ChevronLeft aria-hidden size={14} />
      </IconButton>
      {window.holdsToday ? null : <Button onPress={goToToday}>{t('workspace.today')}</Button>}
    </div>
  )
}
