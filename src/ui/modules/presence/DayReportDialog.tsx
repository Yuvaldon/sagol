import { DAY_REPORT, DAY_REPORT_CATEGORIES, DEVICE_KEYS, PANEL_IDS } from '@config'
import type { AppError, CalendarDate, Timestamp, UnitId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  reportText,
  unitTreeRows,
  useDayReport,
  useDeviceFlag,
  useModuleAccess,
  usePanel,
  usePresenceDay,
  useUnits,
  useConfirmDayReport,
  useReportConfirmations,
  useViewFilter,
  type ConfirmationSummary,
  type DayConfirmations,
  type DayReport,
  type ReportCounts,
  type ReportDay,
  type ReportEntry,
  type ReportSection,
  type SectionConfirmation,
} from '@logic'
import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button as AriaButton, Dialog, Disclosure, DisclosurePanel, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { groupLabel } from '../../board/labels'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate, formatDateRange } from '../../patterns/dates'
import { Button, IconButton } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SwitchField } from '../../primitives/SwitchField'
import { canShareFiles, downloadFile, imageLines, reportFile, reportImage } from './reportImage'
import { CATEGORY_KEYS, entryDetails, entryName, reportWords } from './reportWords'

// The day report (D-193 … D-196): a centered dialog over the board, on the URL's day or span. The counts, then one
// section per unit with its names; the reasons behind a switch kept on the device; a text copy and an image to send.
// Each unit's section is confirmed by who may, and shows when it changed since; the owner reads the tally (D-293).

const NOTICES = { copied: 'presence.copied', copyFailed: 'presence.copyFailed', imageFailed: 'presence.imageFailed' } as const satisfies Record<string, I18nKey>

/** A notice and its count, so the same notice twice in a row shows its full time again. */
type Notice = { readonly kind: keyof typeof NOTICES; readonly seq: number } | null

/** The selected scope's name: the unit, the single root in sight, or the whole organization. */
function useScopeName(): string {
  const units = useUnits()
  const { unit } = useViewFilter()
  return useMemo(() => {
    const rows = units.status === 'ready' ? unitTreeRows(units.value) : []
    if (unit.kind === 'unit') return rows.find((row) => row.unit.id === unit.unitId)?.unit.name ?? t('workspace.unitUnavailable')
    if (unit.kind === 'other') return t('workspace.otherFilter')
    const roots = rows.filter((row) => row.depth === 0)
    return roots.length === 1 && roots[0] !== undefined ? roots[0].unit.name : t('workspace.wholeOrganization')
  }, [units, unit])
}

function Counts({ counts, size }: { readonly counts: ReportCounts; readonly size: 'large' | 'small' }) {
  const cells = [{ key: 'total', value: counts.total }, ...DAY_REPORT_CATEGORIES.map((key) => ({ key, value: counts[key] }))] as const
  return (
    <dl className={`grid grid-cols-5 gap-xs ${size === 'large' ? '' : 'text-label'}`}>
      {cells.map((cell) => (
        <div key={cell.key} className={`flex flex-col items-center rounded-control ${size === 'large' ? 'bg-inner py-xs' : ''}`}>
          <dt className="text-micro text-text-muted">{t(CATEGORY_KEYS[cell.key])}</dt>
          <dd className={`tabular-nums ${size === 'large' ? 'text-body font-bold' : 'font-semibold'}`}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Names({ entries, withReasons }: { readonly entries: readonly ReportEntry[]; readonly withReasons: boolean }) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const details = withReasons ? entryDetails(entry) : ''
        return (
          <li key={entry.soldier.id} className="flex min-h-control flex-col justify-center border-b border-line py-2xs last:border-b-0">
            <span className="text-name">{entryName(entry)}</span>
            {details === '' ? null : <span className="text-micro text-text-muted">{details}</span>}
          </li>
        )
      })}
    </ul>
  )
}

const STATUS = {
  confirmed: { key: 'presence.statusConfirmed', tone: 'text-status-approved' },
  not_yet: { key: 'presence.statusNotYet', tone: 'text-text-muted' },
  changed_since: { key: 'presence.statusChanged', tone: 'text-status-pending-text' },
} as const satisfies Record<SectionConfirmation['status'], { readonly key: I18nKey; readonly tone: string }>

/**
 * Where a unit's section stands, and the button for who may confirm it now; while the view filter hides some of its
 * soldiers, a line says confirming needs the full list instead (D-293).
 */
function Confirmation({
  confirmation,
  date,
  seenAt,
  confirm,
}: {
  readonly confirmation: SectionConfirmation
  readonly date: CalendarDate
  readonly seenAt: Timestamp
  readonly confirm: Confirm
}) {
  const status = STATUS[confirmation.status]
  const open = confirmation.status !== 'confirmed'
  return (
    <div className="flex min-h-control flex-wrap items-center gap-sm border-t border-line px-sm py-2xs">
      <span className={`min-w-none flex-1 text-label font-semibold ${status.tone}`}>{t(status.key)}</span>
      {open && confirmation.needsFullList ? (
        <p className="w-full text-micro text-text-muted">{t('presence.confirmNeedsFullList')}</p>
      ) : null}
      {open && confirmation.canConfirm ? (
        <Button
          isDisabled={confirm.isPending}
          onPress={() => {
            void confirm.run(confirmation.unitId, date, seenAt)
          }}
        >
          <CheckCheck aria-hidden size={14} />
          {t(confirmation.status === 'not_yet' ? 'presence.confirm' : 'presence.confirmAgain')}
        </Button>
      ) : null}
    </div>
  )
}

function UnitSection({
  section,
  withReasons,
  level,
  date,
  confirmation,
  seenAt,
  confirm,
}: {
  readonly section: ReportSection
  readonly withReasons: boolean
  readonly level: 3 | 4
  readonly date: CalendarDate
  readonly confirmation: SectionConfirmation | undefined
  readonly seenAt: Timestamp | undefined
  readonly confirm: Confirm
}) {
  const ListHeading = level === 3 ? 'h4' : 'h5'
  const lists = [...DAY_REPORT.text.listed, 'present' as const].filter((category) => section[category].length > 0)
  return (
    <Disclosure className="group rounded-control border border-line">
      <Heading level={level}>
        <AriaButton
          slot="trigger"
          className="flex min-h-touch w-full cursor-pointer flex-col gap-2xs rounded-control px-sm py-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          <span className="flex w-full items-center gap-sm">
            <span className="min-w-none flex-1 truncate text-name font-bold">{groupLabel(section.label)}</span>
            <ChevronDown aria-hidden size={14} className="shrink-0 text-text-muted group-data-expanded:rotate-180" />
          </span>
          <Counts counts={section.counts} size="small" />
        </AriaButton>
      </Heading>
      <DisclosurePanel className="flex flex-col gap-sm px-sm pb-sm">
        {lists.map((category) => (
          <section key={category} className="flex flex-col gap-2xs">
            <ListHeading className="text-label font-semibold text-text-muted">
              {t(CATEGORY_KEYS[category])} <span className="tabular-nums">{section[category].length}</span>
            </ListHeading>
            <Names entries={section[category]} withReasons={withReasons && category !== 'present'} />
          </section>
        ))}
      </DisclosurePanel>
      {confirmation === undefined || seenAt === undefined ? null : (
        <Confirmation confirmation={confirmation} date={date} seenAt={seenAt} confirm={confirm} />
      )}
    </Disclosure>
  )
}

/** "N of M confirmed", and how many changed since, for the report's owner. */
function Summary({ summary }: { readonly summary: ConfirmationSummary }) {
  return (
    <p className="flex flex-wrap gap-x-md text-name font-semibold">
      <span className="flex gap-2xs">
        <span>{t('presence.summaryConfirmed')}</span>
        <span className="tabular-nums">{summary.confirmed}</span>
        <span>{t('presence.summaryOf')}</span>
        <span className="tabular-nums">{summary.total}</span>
      </span>
      {summary.changed === 0 ? null : (
        <span className="text-status-pending-text">
          {t('presence.summaryChanged')} <span className="tabular-nums">{summary.changed}</span>
        </span>
      )}
    </p>
  )
}

interface Confirm {
  readonly run: (unitId: UnitId, date: CalendarDate, seenAt: Timestamp) => Promise<unknown>
  readonly isPending: boolean
}

function Day({
  day,
  span,
  withReasons,
  confirmations,
  confirm,
}: {
  readonly day: ReportDay
  readonly span: boolean
  readonly withReasons: boolean
  readonly confirmations: DayConfirmations | undefined
  readonly confirm: Confirm
}) {
  const words = reportWords('')
  const rotations = words.rotations(day.rotations)
  return (
    <section className="flex flex-col gap-sm">
      {span ? <h3 className="text-body font-bold">{formatDate(day.date, 'full')}</h3> : null}
      {rotations === null ? null : <p className="text-name text-text-muted">{rotations}</p>}
      {confirmations?.summary == null ? null : <Summary summary={confirmations.summary} />}
      <Counts counts={day.counts} size="large" />
      {day.counts.absent === 0 ? <p className="text-name text-text-muted">{t('presence.noneAbsent')}</p> : null}
      <div className="flex flex-col gap-xs">
        {day.units.map((section) => (
          <UnitSection
            key={section.key}
            section={section}
            withReasons={withReasons}
            level={span ? 4 : 3}
            date={day.date}
            confirmation={confirmations?.sections.get(section.key)}
            seenAt={confirmations?.seenAt}
            confirm={confirm}
          />
        ))}
      </div>
    </section>
  )
}

function Actions({ report, scope, withReasons }: { readonly report: DayReport; readonly scope: string; readonly withReasons: boolean }) {
  const [notice, setNotice] = useState<Notice>(null)
  const notify = useCallback((kind: keyof typeof NOTICES) => {
    setNotice((previous) => ({ kind, seq: (previous?.seq ?? 0) + 1 }))
  }, [])
  const [busy, setBusy] = useState(false)
  const shares = useMemo(() => canShareFiles(), [])
  const first = report.days[0]?.date
  useEffect(() => {
    if (notice === null) return undefined
    const timer = setTimeout(() => {
      setNotice(null)
    }, DAY_REPORT.noticeMs)
    return () => {
      clearTimeout(timer)
    }
  }, [notice])
  if (first === undefined) return null
  const words = reportWords(scope)

  const copy = () => {
    // An insecure page or an old browser has no clipboard at all.
    if (typeof navigator.clipboard?.writeText !== 'function') {
      notify('copyFailed')
      return
    }
    navigator.clipboard.writeText(reportText(report, words, withReasons)).then(
      () => {
        notify('copied')
      },
      () => {
        notify('copyFailed')
      },
    )
  }
  const sendImage = async () => {
    setBusy(true)
    let file: File | null = null
    try {
      file = reportFile(await reportImage(imageLines(report, words, withReasons)), first)
      if (shares) await navigator.share({ files: [file], title: t('presence.title') })
      else downloadFile(file)
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      // Closing the share sheet is not a failure; a share the browser refuses falls back to a download.
      if (name === 'AbortError') return
      if (file !== null && shares && (name === 'NotAllowedError' || name === 'TypeError')) downloadFile(file)
      else notify('imageFailed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-sm">
        <Button variant="primary" onPress={copy}>
          <Copy aria-hidden size={14} />
          {t('presence.copy')}
        </Button>
        <Button
          isDisabled={busy}
          onPress={() => {
            void sendImage()
          }}
        >
          {shares ? <Share2 aria-hidden size={14} /> : <Download aria-hidden size={14} />}
          {t(shares ? 'presence.share' : 'presence.download')}
        </Button>
      </div>
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-lg top-safe z-10 flex justify-center">
        {notice === null ? null : (
          <div className="glass-card rounded-pill px-lg py-xs text-name font-semibold">{t(NOTICES[notice.kind])}</div>
        )}
      </div>
    </>
  )
}

function SpanControl({ until, setUntil }: { readonly until: CalendarDate | null; readonly setUntil: (next: CalendarDate | null) => void }) {
  const [open, setOpen] = useState(until !== null)
  // The field keeps what is typed, a year half written too; the URL takes only a day after the first one.
  const [draft, setDraft] = useState<CalendarDate | ''>(until ?? '')
  // The URL may change the last day from outside (back, forward, a link): the field follows it.
  const [seen, setSeen] = useState(until)
  if (until !== seen) {
    setSeen(until)
    if (until !== (draft === '' ? null : draft)) setDraft(until ?? '')
    if (until !== null) setOpen(true)
  }
  if (!open && until === null) {
    return (
      <Button
        onPress={() => {
          setOpen(true)
        }}
      >
        {t('presence.span')}
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap items-end gap-sm">
      <DateField
        labelKey="presence.until"
        name="until"
        value={draft}
        onChange={(next) => {
          setDraft(next)
          setUntil(next === '' ? null : next)
        }}
        error={null}
      />
      <Button
        onPress={() => {
          setOpen(false)
          setDraft('')
          setUntil(null)
        }}
      >
        {t('presence.oneDay')}
      </Button>
      <p className="w-full text-micro text-text-muted">
        {t('presence.spanLimit')} <span className="tabular-nums">{DAY_REPORT.maxSpanDays}</span>
      </p>
    </div>
  )
}

function DayReportBody() {
  const { day, until, today, days, rotations, canShift, shift, goToToday, setUntil } = usePresenceDay()
  const { filter } = useViewFilter()
  const report = useDayReport(days, filter, rotations)
  const confirmations = useReportConfirmations(days, report, rotations)
  const confirmCommand = useConfirmDayReport()
  const [refused, setRefused] = useState<AppError | null>(null)
  const confirm = useMemo(
    (): Confirm => ({
      isPending: confirmCommand.isPending,
      run: async (unitId, date, seenAt) => {
        setRefused(null)
        const result = await confirmCommand.run(unitId, date, seenAt)
        if (!result.ok) setRefused(result.error)
      },
    }),
    [confirmCommand],
  )
  const reasons = useDeviceFlag(DEVICE_KEYS.dayReportReasons)
  const scope = useScopeName()
  const last = days.at(-1)
  const title = day === null ? '' : until === null || last === undefined || last === day ? formatDate(day, 'full') : formatDateRange(day, last)

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center gap-xs">
        <IconButton
          labelKey="presence.previousDay"
          isDisabled={!canShift(-1)}
          onPress={() => {
            shift(-1)
          }}
        >
          <ChevronRight aria-hidden size={16} />
        </IconButton>
        <p aria-live="polite" className="min-w-none flex-1 text-center text-body font-bold tabular-nums">
          {title}
        </p>
        <IconButton
          labelKey="presence.nextDay"
          isDisabled={!canShift(1)}
          onPress={() => {
            shift(1)
          }}
        >
          <ChevronLeft aria-hidden size={16} />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        {day === null || day === today ? null : <Button onPress={goToToday}>{t('presence.today')}</Button>}
        {day === null ? null : <SpanControl key={day} until={until} setUntil={setUntil} />}
      </div>
      <p className="text-name text-text-muted">{t('presence.hint')}</p>
      {day !== null && days.length === 0 ? <p className="text-name">{t('presence.notReportable')}</p> : null}
      {report.status === 'failed' ? <FailureNotice error={report.error} /> : null}
      {confirmations.status === 'failed' ? <FailureNotice error={confirmations.error} /> : null}
      {refused === null ? null : <FailureNotice error={refused} />}
      {report.status === 'loading' && days.length > 0 ? <LoadingNotice /> : null}
      {report.status === 'ready' ? (
        <>
          {report.value.hasReasons ? (
            <SwitchField labelKey="presence.reasons" name="reasons" value={reasons.value} onChange={reasons.set} />
          ) : null}
          <Actions report={report.value} scope={scope} withReasons={reasons.value} />
          {report.value.days.map((row) => (
            <Day
              key={row.date}
              day={row}
              span={report.value.days.length > 1}
              withReasons={reasons.value && report.value.hasReasons}
              confirmations={confirmations.status === 'ready' ? confirmations.value.get(row.date) : undefined}
              confirm={confirm}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

/** The dialog, while the URL names the report and the actor may open the soldiers module (D-134). */
export function DayReportDialog() {
  const panel = usePanel()
  const access = useModuleAccess()
  if (panel.panel !== PANEL_IDS.presence || !access.soldiers) return null
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) panel.close()
      }}
      className="enter-scrim fixed inset-screen z-20 flex items-center justify-center bg-scrim p-sm md:p-lg"
    >
      <Modal className="glass-menu flex max-h-sheet-height w-full max-w-drawer flex-col overflow-hidden rounded-panel">
        <Dialog className="flex min-h-none flex-col outline-none">
          <header className="flex items-center gap-sm border-b border-line px-lg py-sm">
            <Heading slot="title" level={2} className="min-w-none flex-1 text-body font-bold">
              {t('presence.title')}
            </Heading>
            <IconButton labelKey="common.close" onPress={panel.close}>
              <X aria-hidden size={16} />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-lg py-md">
            <DayReportBody />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
