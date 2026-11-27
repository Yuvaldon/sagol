import { TODAY } from '@config'
import type { CalendarDate } from '@contracts'
import { t } from '@i18n'
import { daysFrom, unitTreeRows, useDayReport, useHeatRow, useModuleAccess, usePresenceDay, useRotationScope, useToday, useUnits } from '@logic'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Fraction } from '../../kit/Fraction'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { PageHead } from '../PageFrame'
import { dayLine } from './standing'
import { UnitDrawer } from './UnitDrawer'

// The open block of a commander's "היום" (D-454): the unit's name, how many of it are on base today at display size,
// and the seven days from today as columns. A day whose rule is broken is amber. A column opens the unit's drawer on
// its day; "דוח 1" opens today's report, for who reads the unit's soldiers while a rotation runs (D-222).

const WORD = ' '
const SEPARATOR = ' · '
const COMMA = ','
const NO_DAYS: readonly CalendarDate[] = []

/** The one root unit in sight, else the organization. */
function useUnitName(fallback: string): string {
  const units = useUnits()
  return useMemo(() => {
    const roots = units.status === 'ready' ? unitTreeRows(units.value).filter((row) => row.depth === 0) : []
    return roots.length === 1 && roots[0] !== undefined ? roots[0].unit.name : fallback
  }, [units, fallback])
}

export function UnitBlock({ name }: { readonly name: string }) {
  const today = useToday()
  const { rotations, openToday } = usePresenceDay()
  const { rotation } = useRotationScope()
  const access = useModuleAccess()
  const unitName = useUnitName(name)
  const days = useMemo(() => (today === null ? NO_DAYS : daysFrom(today, TODAY.unitDays)), [today])
  const report = useDayReport(days, null, rotations)
  const window = useMemo(() => {
    const from = days[0]
    const to = days.at(-1)
    return from === undefined || to === undefined ? null : { from, to, days }
  }, [days])
  const heat = useHeatRow(window, null)
  const [open, setOpen] = useState<CalendarDate | null>(null)

  const reportButton =
    rotation !== null && access.soldiers ? (
      <Button variant="primary" onPress={openToday}>
        {t('presence.title')}
      </Button>
    ) : null
  const broken = new Set(heat.status === 'ready' && heat.value !== null ? heat.value.filter((day) => day.broken > 0).map((day) => day.date) : [])
  const first = report.status === 'ready' ? report.value.days[0] : undefined
  return (
    <section className="flex flex-col gap-md">
      <PageHead>
        <p className="text-body text-text-muted tabular-nums">{today === null ? unitName : [unitName, dayLine(today)].join(SEPARATOR)}</p>
      </PageHead>
      {/* "דוח 1" does not wait for the counts: it is offered as soon as the block is. */}
      <div className="flex min-h-touch items-end justify-between gap-md">
        {first === undefined ? (
          <span />
        ) : (
          <div className="flex flex-col">
            <Fraction value={first.counts.present} of={first.counts.total} low={broken.has(first.date)} />
            <p className="text-body text-text-muted">{t('today.onBase')}</p>
          </div>
        )}
        {reportButton}
      </div>
      {report.status === 'failed' ? <FailureNotice error={report.error} /> : report.status === 'loading' || today === null ? <LoadingNotice /> : null}
      {report.status !== 'ready' ? null : (
        <ol aria-label={t('today.unitDays')} className="flex gap-xs">
          {report.value.days.map((day) => {
            const low = broken.has(day.date)
            const spoken = [
              formatDate(day.date, 'full') + COMMA,
              String(day.counts.present),
              t('kit.fractionOf'),
              String(day.counts.total),
              t('today.onBase'),
              ...(low ? [t('kit.fractionLow')] : []),
            ].join(WORD)
            return (
              <li key={day.date} className="min-w-none flex-1">
                <AriaButton
                  onPress={() => {
                    setOpen(day.date)
                  }}
                  className={`flex min-h-action w-full cursor-pointer flex-col items-center justify-center gap-2xs rounded-chip outline-focus outline-offset-2 data-focus-visible:outline-2 ${
                    day.date === today
                      ? 'bg-action-solid text-on-action'
                      : low
                        ? 'bg-status-pending-bg text-status-pending-text'
                        : 'bg-surface text-text'
                  }`}
                >
                  <span className="sr-only">{spoken}</span>
                  <span aria-hidden className="text-micro">
                    {formatDate(day.date, 'weekdayNarrow')}
                  </span>
                  <span aria-hidden className="text-body font-bold tabular-nums">
                    {day.counts.present}
                  </span>
                </AriaButton>
              </li>
            )
          })}
        </ol>
      )}
      {open === null ? null : (
        <UnitDrawer
          name={unitName}
          day={open}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </section>
  )
}
