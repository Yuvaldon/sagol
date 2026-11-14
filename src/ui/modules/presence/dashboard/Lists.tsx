import { PANEL_IDS } from '@config'
import type { LeaveType, SoldierId } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  usePanel,
  usePresenceDay,
  useRulesDay,
  type Dashboard,
  type DashboardOutstanding,
  type DashboardReport,
  type DashboardReportDay,
  type ReportSectionStatus,
  type UpcomingLeave,
} from '@logic'
import { AlertCircle, CheckCircle2, CircleDashed, ShieldAlert, Send } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { groupLabel } from '../../../board/labels'
import { formatDate } from '../../../patterns/dates'
import { dayHeading, moreText, reportHeading, REPORT_STATUS_KEYS, reportTotals, requestText, upcomingText } from './listText'

// The board's lists (D-349): who leaves and returns this week, what waits for the actor, and today's report. Each item
// opens where it is handled: the leave, the rules panel on the day (D-134), or the day report.

const ROW =
  'flex min-h-touch w-full cursor-pointer items-center gap-xs rounded-control px-xs text-start text-name outline-focus -outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner'
const EMPTY = 'text-name text-text-muted'

function Upcoming({ items, types }: { readonly items: readonly UpcomingLeave[]; readonly types: readonly LeaveType[] }) {
  const panel = usePanel()
  return (
    <ul className="flex flex-wrap gap-xs">
      {items.map((item) => {
        const edge = item.pending ? 'border-dashed border-status-pending' : 'border-line'
        const chip = `inline-flex min-h-touch max-w-full cursor-pointer items-center rounded-pill border bg-surface px-sm text-label outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner ${edge}`
        return (
          <li key={item.leave.id} className="min-w-none">
            <AriaButton className={chip} onPress={() => panel.open(PANEL_IDS.leaves, { entity: item.leave.id })}>
              <span className="truncate">{upcomingText(item, types)}</span>
            </AriaButton>
          </li>
        )
      })}
    </ul>
  )
}

/** "יוצאים וחוזרים": per day of the week ahead, who leaves and who returns. */
export function UpcomingList({ dashboard, types }: { readonly dashboard: Dashboard; readonly types: readonly LeaveType[] }) {
  const days = dashboard.tally.upcoming.filter((day) => day.leaving.length > 0 || day.returning.length > 0)
  if (days.length === 0) return <p className={EMPTY}>{t('dashboard.noUpcoming')}</p>
  return (
    <ul className="flex flex-col gap-sm">
      {days.map((day) => (
        <li key={day.date} className="flex flex-col gap-2xs">
          <h4 className="text-label font-semibold">{dayHeading(day.date)}</h4>
          {day.leaving.length === 0 ? null : (
            <Group label={t('dashboard.leaving')}>
              <Upcoming items={day.leaving} types={types} />
            </Group>
          )}
          {day.returning.length === 0 ? null : (
            <Group label={t('dashboard.returning')}>
              <Upcoming items={day.returning} types={types} />
            </Group>
          )}
        </li>
      ))}
    </ul>
  )
}

function Group({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2xs">
      <span className="text-micro text-text-muted">{label}</span>
      {children}
    </div>
  )
}

/** "ממתין לטיפול": requests awaiting the actor, then the days ahead that break a rule. */
export function OutstandingList({ dashboard, outstanding }: { readonly dashboard: Dashboard; readonly outstanding: DashboardOutstanding }) {
  const panel = usePanel()
  const rules = useRulesDay()
  const names = useMemo(
    () => new Map<SoldierId, string>(dashboard.scope.rows.map((row) => [row.soldier.id, fullName(row.soldier)])),
    [dashboard.scope.rows],
  )
  if (outstanding.items.length === 0) return <p className={EMPTY}>{t('dashboard.nothingOutstanding')}</p>
  const rest = outstanding.total - outstanding.items.length
  return (
    <ul className="flex flex-col">
      {outstanding.items.map((item) =>
        item.kind === 'request' ? (
          <li key={item.leave.id}>
            <AriaButton className={ROW} onPress={() => panel.open(PANEL_IDS.leaves, { entity: item.leave.id })}>
              <Send aria-hidden size={14} className="shrink-0 text-text-muted" />
              <span className="min-w-none flex-1 truncate">{requestText(names.get(item.leave.soldier_id) ?? t('accountLinks.unknownSoldier'))}</span>
              <span className="text-micro text-text-muted tabular-nums">{formatDate(item.leave.start_date, 'dayMonth')}</span>
            </AriaButton>
          </li>
        ) : (
          <li key={item.date}>
            <AriaButton className={ROW} onPress={() => rules.openOn(item.date)}>
              <ShieldAlert aria-hidden size={14} className="shrink-0 text-status-rejected" />
              <span className="min-w-none flex-1 truncate">{t('dashboard.ruleBreak')}</span>
              <span className="text-micro text-text-muted tabular-nums">{formatDate(item.date, 'dayMonth')}</span>
            </AriaButton>
          </li>
        ),
      )}
      {rest <= 0 || !dashboard.approver ? null : (
        <li>
          <AriaButton className={`${ROW} text-text-muted`} onPress={() => panel.open(PANEL_IDS.leaveInbox)}>
            {moreText(rest)}
          </AriaButton>
        </li>
      )}
    </ul>
  )
}

const STATUS_ICONS = {
  confirmed: <CheckCircle2 aria-hidden size={14} className="shrink-0 text-status-approved" />,
  not_yet: <CircleDashed aria-hidden size={14} className="shrink-0 text-text-muted" />,
  changed_since: <AlertCircle aria-hidden size={14} className="shrink-0 text-status-pending-text" />,
} as const satisfies Record<ReportSectionStatus['status'], ReactNode>

/** "סטטוס דוח 1": each section's confirmation; pressing opens the day report. After the cut-over hour it shows tomorrow's too (D-443). */
export function ReportStatusList({ report }: { readonly report: DashboardReport }) {
  return (
    <div className="flex flex-col gap-sm">
      <ReportStatusDay day={report} />
      {report.next === null ? null : <ReportStatusDay day={report.next} />}
    </div>
  )
}

function ReportStatusDay({ day }: { readonly day: DashboardReportDay }) {
  const { openOn } = usePresenceDay()
  return (
    <div className="flex flex-col gap-xs">
      <AriaButton className={`${ROW} flex-col items-stretch py-xs`} onPress={() => openOn(day.date)}>
        <span className="text-label font-semibold">{reportHeading(day.date)}</span>
        <span className="text-micro text-text-muted">{reportTotals(day.present, day.absent)}</span>
      </AriaButton>
      <ul className="flex flex-col gap-2xs px-xs">
        {day.sections.map((section) => (
          <li key={section.key} className="flex items-center gap-xs text-name">
            {STATUS_ICONS[section.status]}
            <span className="min-w-none flex-1 truncate">{groupLabel(section.label)}</span>
            <span className="text-micro text-text-muted">{t(REPORT_STATUS_KEYS[section.status])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
