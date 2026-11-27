import { t, type I18nKey } from '@i18n'
import { usePresenceDay, useReportSentAt, useTimezone } from '@logic'
import { Check } from 'lucide-react'
import { formatInstant } from '../../patterns/dates'
import { Button } from '../../primitives/Button'

// The button that opens today's "דוח 1" (D-454, D-472). Once the report was sent, it says so with a check and the
// time, "✓ 07:40", read aloud as "נשלח"; it still opens the report.

const WORD = ' '
const CHECK_ICON = 14

export function ReportButton({ labelKey }: { readonly labelKey: I18nKey }) {
  const { today, rotations, openToday } = usePresenceDay()
  const sentAt = useReportSentAt(today, rotations)
  const timezone = useTimezone()
  if (sentAt === null || timezone === null) {
    return (
      <Button variant="primary" onPress={openToday}>
        {t(labelKey)}
      </Button>
    )
  }
  const time = formatInstant(sentAt, timezone, 'time')
  return (
    <Button aria-label={[t('presence.title'), t('presence.statusConfirmed'), time].join(WORD)} onPress={openToday}>
      <Check aria-hidden size={CHECK_ICON} className="text-status-ok-text" />
      <span className="tabular-nums">{time}</span>
    </Button>
  )
}
