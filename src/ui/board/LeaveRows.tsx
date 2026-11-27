import type { Leave } from '@contracts'
import { t } from '@i18n'
import { fullName, impactOf, useApprovalCheck, useLeaveActions, type BoardDay, type BoardEntry } from '@logic'
import { Check, ChevronDown, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Badge } from '../kit/Badge'
import { formatDate } from '../patterns/dates'
import { REQUEST_ATTRIBUTE, useRequestActions } from '../shell/today/requestActions'
import type { BoardFrame } from './BoardEngine'
import { useSwipe } from './gestures'
import { typeName } from './labels'

// The rows of a day on the board (the handoff's board spec, §1.15 and §3; D-480): a person's leave as their name and its
// type, "יוצא היום" or "חוזר היום" when that is so; the leave round's leaves of the day as one quiet row that opens to its
// names, or a plain row when it is one person. A pending request has an amber outline; a swipe reveals ✓ and ✗ for who
// may answer it, with the impact line when approving would break a rule. The row itself opens the leave card, which
// holds the same answers (D-458), and is how the keyboard reaches them. A leave of the round has no quick ✗: its card
// decides between the move and the original dates (OI-394).

const FOCUS = 'outline-focus -outline-offset-2 data-focus-visible:outline-2'
const STEP = `inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`
const STEP_ICON = 20
const WORD = ' '
const SEPARATOR = ' · '

/** Between the parts of a row's name, for readers: the eye has the layout. */
function Gap() {
  return <span className="sr-only">{SEPARATOR}</span>
}

function Line({ name, detail, pending, tag }: { readonly name: string; readonly detail: string; readonly pending: boolean; readonly tag: string | null }) {
  return (
    <>
      <span className="flex min-w-none flex-1 items-baseline gap-sm">
        <span className="truncate text-body font-semibold">{name}</span>
        {detail === '' ? null : (
          <>
            <Gap />
            <span className="truncate text-small text-text-muted">{detail}</span>
          </>
        )}
        {pending ? (
          <span className="sr-only">
            {SEPARATOR}
            {t('leaves.badgePending')}
          </span>
        ) : null}
      </span>
      {tag === null ? null : (
        <>
          <Gap />
          <span className="shrink-0 text-small text-text-muted">{tag}</span>
        </>
      )}
    </>
  )
}

/** What the actor may answer: each step by its own permission (D-063). */
interface May {
  readonly approve: boolean
  readonly reject: boolean
}

function Answers({
  leave,
  name,
  round,
  may,
  counted,
  frame,
}: {
  readonly leave: Leave
  readonly name: string
  readonly round: boolean
  readonly may: May
  readonly counted: readonly BoardDay[]
  readonly frame: BoardFrame
}) {
  const actions = useRequestActions()
  const check = useApprovalCheck(leave)
  const impact = check.status === 'ready' ? impactOf(check.value, counted, frame.model.approved, leave.soldier_id) : null
  return (
    <div className="flex flex-col items-end gap-2xs">
      <div className="flex items-center gap-sm">
        {round || !may.reject ? null : (
          <AriaButton
            aria-label={[t('leaves.reject'), name].join(WORD)}
            onPress={() => {
              actions.reject(leave)
            }}
            className={`${STEP} bg-status-rejected-bg text-status-rejected-text`}
          >
            <X aria-hidden size={STEP_ICON} />
          </AriaButton>
        )}
        {may.approve ? (
          <AriaButton
            {...{ [REQUEST_ATTRIBUTE]: leave.id }}
            aria-label={[t(round ? 'leaves.approveMove' : 'leaves.approve'), name].join(WORD)}
            onPress={() => {
              actions.approve(leave)
            }}
            className={`${STEP} bg-status-ok-bg text-status-ok-text`}
          >
            <Check aria-hidden size={STEP_ICON} />
          </AriaButton>
        ) : null}
      </div>
      {impact === null ? null : (
        <p role="status" className="text-small font-semibold text-status-pending-text tabular-nums">
          {[`${t('board.impactDay')} ${formatDate(impact.day, 'day')}`, `${String(impact.present)}/${String(impact.total)}`].join(SEPARATOR)}
        </p>
      )}
    </div>
  )
}

/** A row that answers with a swipe: for a pending request its actor may answer. */
function Answerable({
  leave,
  children,
  answers,
}: {
  readonly leave: Leave
  readonly children: (swiped: () => boolean) => ReactNode
  readonly answers: (may: May) => ReactNode
}) {
  const actions = useLeaveActions(leave)
  const [shown, setShown] = useState(false)
  const swipe = useSwipe((direction) => {
    if (direction === 'left' || direction === 'right') setShown(!shown)
  })
  // A round leave has no quick ✗ (D-481): what it offers by a swipe is the approval alone.
  const may: May = { approve: actions.approve, reject: actions.reject && leave.batch_id === null }
  if (!may.approve && !may.reject) return children(() => false)
  return (
    <div onPointerDownCapture={swipe.onPointerDown} onPointerUpCapture={swipe.onPointerUp} onPointerCancel={swipe.onPointerCancel} className="flex touch-pan-y items-center gap-sm">
      {children(swipe.consumed)}
      {shown ? answers(may) : null}
    </div>
  )
}

export function RequestRow({
  entry,
  tag,
  frame,
  counted,
  inRound = false,
}: {
  readonly entry: BoardEntry
  readonly tag: string | null
  /** A name inside the round's open row: its line says the person's rank, the row above already says the round. */
  readonly inRound?: boolean
  readonly frame: BoardFrame
  /** The board's days, counted: what the impact line reads. */
  readonly counted: readonly BoardDay[]
}) {
  const name = fullName(entry.soldier)
  const stored = frame.stored.get(entry.leave.id)
  const pending = entry.leave.status === 'pending'
  // A leave of the round is named by the round, never by its batch (§1.15).
  const detail = inRound
    ? (entry.rank?.short_title ?? entry.rank?.title ?? '')
    : entry.leave.layer === 'round'
      ? t('board.round')
      : typeName(entry.leave)
  const row = (swiped: () => boolean) => (
    <AriaButton
      onPress={() => {
        if (swiped()) return
        frame.openLeave(entry.leave.id)
      }}
      className={`flex min-h-touch min-w-none flex-1 cursor-pointer items-center gap-sm rounded-control text-start ${pending ? 'border border-status-pending-line bg-status-pending-cell px-sm' : ''} ${FOCUS}`}
    >
      <Line name={name} detail={detail} pending={pending} tag={tag} />
    </AriaButton>
  )
  return (
    <li className="border-b border-divider-strong py-xs last:border-b-0">
      {pending && stored !== undefined ? (
        <Answerable leave={stored} answers={(may) => <Answers leave={stored} name={name} round={entry.leave.layer === 'round'} may={may} counted={counted} frame={frame} />}>
          {row}
        </Answerable>
      ) : (
        row(() => false)
      )}
    </li>
  )
}

/** The leave round's leaves of one day and one direction: one row that opens to its names; one person is a plain row. */
export function RoundRow({
  entries,
  tag,
  groupTag,
  frame,
  counted,
}: {
  readonly entries: readonly BoardEntry[]
  /** What each name says: "יוצא היום", "חוזר היום", or nothing. */
  readonly tag: string | null
  /** What the closed row says at its end, for several: "יוצאים היום", "בבית", "חוזרים היום". */
  readonly groupTag: string | null
  readonly frame: BoardFrame
  readonly counted: readonly BoardDay[]
}) {
  const [open, setOpen] = useState(false)
  const list = useId()
  const [only] = entries
  const waiting = entries.some((entry) => entry.leave.status === 'pending')
  if (only === undefined) return null
  if (entries.length === 1) return <RequestRow entry={only} tag={tag} frame={frame} counted={counted} />
  return (
    <li className="border-b border-divider-strong py-xs last:border-b-0">
      <AriaButton
        aria-expanded={open}
        aria-controls={list}
        onPress={() => {
          setOpen(!open)
        }}
        className={`flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control text-start ${FOCUS}`}
      >
        <span className="text-body font-bold">{t('board.round')}</span>
        <span className="text-small text-text-muted tabular-nums">{entries.length}</span>
        <ChevronDown aria-hidden size={18} className={`shrink-0 text-text-muted transition-transform duration-ui ease-standard ${open ? 'rotate-180' : ''}`} />
        <span className="flex-1" />
        {/* A leave of it that waits, as a move does, shows while the row is closed (D-481). */}
        {waiting ? <Badge tone="pending">{t('leaves.badgePending')}</Badge> : null}
        {groupTag === null ? null : <span className="shrink-0 text-small text-text-muted">{groupTag}</span>}
      </AriaButton>
      {open ? (
        <ul id={list} className="flex flex-col">
          {entries.map((entry) => (
            <RequestRow key={entry.leave.id} entry={entry} tag={tag} frame={frame} counted={counted} inRound />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
