import { LINKED_ENTITY, PANEL_IDS } from '@config'
import type { AccountLinkRequest, UnitId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  fullName,
  joinGroups,
  useJoinApproval,
  useLinkAssessments,
  useLinkPlacements,
  useLinkReviewCommands,
  usePanel,
  usePendingLinkRequests,
  useSoldierAccounts,
  useToday,
  useUnits,
  type JoinEntry,
  type LinkReview,
} from '@logic'
import { Check, ChevronDown, Link2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton, Menu, MenuItem, MenuTrigger } from 'react-aria-components'
import { useSwipe } from '../../board/gestures'
import { Badge } from '../../kit/Badge'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Popover } from '../../primitives/overlays'
import { useNotices } from '../notices'
import { PageFrame } from '../PageFrame'
import { joinOutcome } from './joinOutcome'
import { REASON_CHIPS } from './joinWords'
import { CapsuleButton } from './CapsuleButton'
import { PageTop } from './PageTop'

// "הצטרפות" (the handoff's Manage → Join requests, D-482, OI-382): a queue of what waits, by readiness (D-447). Ready
// requests have one candidate and no conflict; a request to review says why on an amber chip; a request with no
// candidate becomes a new soldier once a unit is chosen on its "מחלקה" chip. "אישור N" in the capsule approves every
// ready one and creates every placed one. A row opens "זה הוא?", where each request is answered on its own. A swipe on a
// ready row reveals ✓ and ✗, on a row to review ✗ alone, and a rejection asks first (OI-402); the drawer is the tap path
// to the same answers (D-458).

const SEPARATOR = ' · '
const WORD = ' '

const FOCUS = 'outline-focus outline-offset-2 data-focus-visible:outline-2'
const STEP = `inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`
const STEP_ICON = 20

/** What a swipe on a row reveals (OI-402): ✓ links a ready request to its one candidate; ✗ asks, then rejects. */
interface SwipeAnswers {
  readonly link: (() => void) | null
  readonly reject: () => void
}

function RequestRow({ request, trailing, answers = null }: { readonly request: AccountLinkRequest; readonly trailing?: ReactNode; readonly answers?: SwipeAnswers | null }) {
  const panel = usePanel()
  const [shown, setShown] = useState(false)
  const swipe = useSwipe((direction) => {
    if (answers !== null && (direction === 'left' || direction === 'right')) setShown(!shown)
  })
  const name = fullName(request)
  return (
    <li
      onPointerDownCapture={swipe.onPointerDown}
      onPointerUpCapture={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
      className="flex min-h-touch touch-pan-y items-center gap-sm border-b border-divider-strong pe-lg last:border-b-0"
    >
      <AriaButton
        onPress={() => {
          if (swipe.consumed()) return
          panel.open(PANEL_IDS.accountLinks, { entity: request.id })
        }}
        className="flex min-h-touch min-w-none flex-1 cursor-pointer items-baseline gap-sm py-xs ps-lg text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
      >
        <span className="shrink-0 truncate text-body font-semibold">{name}</span>
        {request.claimed_personal_id === null ? null : (
          <span dir="ltr" className="min-w-none truncate text-small text-text-muted tabular-nums">
            {request.claimed_personal_id}
          </span>
        )}
      </AriaButton>
      {shown && answers !== null ? (
        <span className="flex shrink-0 items-center gap-sm">
          <AriaButton
            aria-label={[t('accountLinks.reject'), name].join(WORD)}
            onPress={() => {
              setShown(false)
              answers.reject()
            }}
            className={`${STEP} bg-status-rejected-bg text-status-rejected-text`}
          >
            <X aria-hidden size={STEP_ICON} />
          </AriaButton>
          {answers.link === null ? null : (
            <AriaButton
              aria-label={[t('manage.joins.linkOne'), name].join(WORD)}
              onPress={answers.link}
              className={`${STEP} bg-status-ok-bg text-status-ok-text`}
            >
              <Check aria-hidden size={STEP_ICON} />
            </AriaButton>
          )}
        </span>
      ) : (
        trailing
      )}
    </li>
  )
}

function Group({ titleKey, entries, children }: { readonly titleKey: I18nKey; readonly entries: readonly JoinEntry[]; readonly children: ReactNode }) {
  if (entries.length === 0) return null
  return (
    <section className="flex flex-col gap-xs">
      <h2 className="flex items-center justify-between gap-sm px-xs text-body font-bold">
        {t(titleKey)}
        <span className="text-small font-normal text-text-muted tabular-nums">{entries.length}</span>
      </h2>
      <ul className="flex flex-col overflow-hidden rounded-card bg-surface">{children}</ul>
    </section>
  )
}

/** A choice of the "מחלקה" chip: a unit, or no unit (NULL) for who may create a soldier with none. */
interface UnitChoice {
  readonly key: string
  readonly unitId: UnitId | null
  readonly name: string
}

/**
 * The "מחלקה" chip of a request with no candidate: a short menu of where its new soldier may go. The chip is drawn small,
 * as the handoff draws it, inside a 44 px target.
 */
function UnitChip({
  options,
  chosen,
  onChoose,
}: {
  readonly options: readonly UnitChoice[]
  /** Undefined until a choice is made. */
  readonly chosen: UnitId | null | undefined
  readonly onChoose: (unitId: UnitId | null) => void
}) {
  const name = chosen === undefined ? null : (options.find((option) => option.unitId === chosen)?.name ?? null)
  return (
    <MenuTrigger>
      <AriaButton
        aria-label={name === null ? t('manage.joins.unitChip') : [t('manage.joins.unitChip'), name].join(SEPARATOR)}
        className="group inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center outline-none"
      >
        <span
          className={`inline-flex min-h-badge items-center gap-2xs rounded-full px-md text-small font-semibold outline-focus outline-offset-2 group-data-focus-visible:outline-2 ${
            name === null ? 'border border-dashed border-line-dashed text-text-muted' : 'bg-action-soft text-on-action-soft'
          }`}
        >
          {name ?? t('manage.joins.unitChip')}
          <ChevronDown aria-hidden size={14} />
        </span>
      </AriaButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu
          onAction={(key) => {
            const option = options.find((candidate) => candidate.key === key)
            if (option !== undefined) onChoose(option.unitId)
          }}
          className="flex max-h-sheet-height max-w-menu flex-col gap-2xs overflow-y-auto outline-none"
        >
          {options.map((option) => (
            <MenuItem
              key={option.key}
              id={option.key}
              textValue={option.name}
              className="flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-body outline-none data-focused:bg-inner"
            >
              {option.name}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

const NO_UNIT = 'none'

const NO_REQUESTS: readonly AccountLinkRequest[] = []

/** The answers a swipe gives (OI-402): a link with its toast and "פתח כרטיס", and a rejection asked first. */
function useSwipeAnswers() {
  const panel = usePanel()
  const notices = useNotices()
  const commands = useLinkReviewCommands()
  const [rejecting, setRejecting] = useState<AccountLinkRequest | null>(null)
  const answer = (request: AccountLinkRequest, review: LinkReview, done: (answered: AccountLinkRequest) => void) => {
    void commands.run({ request, review }).then((result) => {
      setRejecting(null)
      if (!result.ok) {
        notices.fail(result.error)
        return
      }
      done(result.value)
    })
  }
  const answersOf = (entry: JoinEntry): SwipeAnswers => {
    const { request, assessment } = entry
    const [only] = assessment.candidates
    return {
      link:
        assessment.readiness === 'ready' && only !== undefined && assessment.candidates.length === 1
          ? () => {
              answer(request, { kind: 'link', soldierId: only.soldier_id }, (answered) => {
                const soldierId = answered.resolved_soldier_id
                notices.say(
                  [fullName(request), t('manage.joins.linked')].join(WORD),
                  soldierId === null
                    ? undefined
                    : {
                        labelKey: 'manage.joins.openCard',
                        run: () => {
                          panel.open(PANEL_IDS.soldiers, { entity: soldierId })
                        },
                      },
                )
              })
            }
          : null,
      reject: () => {
        setRejecting(request)
      },
    }
  }
  const dialog =
    rejecting === null ? null : (
      <SmallDialog
        role="alertdialog"
        titleKey="accountLinks.rejectTitle"
        hintKey="accountLinks.rejectHint"
        confirmKey="accountLinks.rejectConfirm"
        tone="danger"
        isPending={commands.isPending}
        onCancel={() => {
          setRejecting(null)
        }}
        onConfirm={() => {
          answer(rejecting, { kind: 'reject' }, () => {
            notices.say([t('manage.joins.rejected'), fullName(rejecting)].join(WORD))
          })
        }}
      >
        <p className="text-body font-semibold">{fullName(rejecting)}</p>
      </SmallDialog>
    )
  return { answersOf, dialog }
}

export function JoinsPage({ name }: { readonly name: string }) {
  const notices = useNotices()
  const panel = usePanel()
  const swipe = useSwipeAnswers()
  // The linked accounts' door (OI-404): for who reads any live link.
  const accounts = useSoldierAccounts()
  const linked = accounts.status === 'ready' ? accounts.value.filter((account) => account.revoked_at === null).length : 0
  const today = useToday()
  const requests = usePendingLinkRequests()
  const pending = requests.status === 'ready' ? requests.value : NO_REQUESTS
  const assessments = useLinkAssessments(pending)
  const units = useUnits()
  const placements = useLinkPlacements(units.status === 'ready' ? units.value : [])
  const approval = useJoinApproval()
  const [placed, setPlaced] = useState<ReadonlyMap<string, UnitId | null>>(new Map())
  const groups = useMemo(() => (assessments.status === 'ready' ? joinGroups(pending, assessments.value) : null), [assessments, pending])
  const unitChoices = useMemo(
    (): UnitChoice[] => [
      ...(units.status === 'ready' ? units.value.filter((unit) => placements.placeIn(unit.id)).map((unit) => ({ key: unit.id, unitId: unit.id, name: unit.name })) : []),
      ...(placements.withoutUnit ? [{ key: NO_UNIT, unitId: null, name: t('soldiers.noUnit') }] : []),
    ],
    [units, placements],
  )
  const ready = groups?.ready ?? []
  const placedNow = (groups?.newSoldiers ?? []).flatMap((entry) => {
    if (!placed.has(entry.request.id)) return []
    return [{ request: entry.request, unitId: placed.get(entry.request.id) ?? null }]
  })
  const count = ready.length + placedNow.length
  const approveAll = () => {
    if (today === null || approval.isPending) return
    void approval.run({ ready: ready.map((entry) => entry.request), placed: placedNow, today }).then((result) => {
      if (!result.ok) {
        notices.fail(result.error)
        return
      }
      const { done, refusal } = joinOutcome(result.value)
      notices.report(done, refusal)
    })
  }

  return (
    <PageFrame>
      <PageTop
        titleKey="manage.pages.joins"
        detail={[name, [String(pending.length), t('manage.joins.waiting')].join(WORD)].join(SEPARATOR)}
        tools={
          count === 0 && linked === 0 ? null : (
            <>
              {linked === 0 ? null : (
                <CapsuleButton
                  labelKey="accountLinks.linkedTitle"
                  onPress={() => {
                    panel.open(PANEL_IDS.accountLinks, { entity: LINKED_ENTITY })
                  }}
                >
                  <Link2 aria-hidden size={20} />
                </CapsuleButton>
              )}
              {count === 0 ? null : (
                <AriaButton
                  isDisabled={approval.isPending}
                  onPress={approveAll}
                  className="inline-flex min-h-touch cursor-pointer items-center gap-xs rounded-full px-md text-body font-bold outline-focus outline-offset-2 data-focus-visible:outline-2"
                >
                  <Check aria-hidden size={18} />
                  {[t('manage.joins.approve'), String(count)].join(WORD)}
                </AriaButton>
              )}
            </>
          )
        }
      />
      {requests.status === 'failed' ? (
        <FailureNotice error={requests.error} />
      ) : assessments.status === 'failed' ? (
        <FailureNotice error={assessments.error} />
      ) : groups === null || requests.status === 'loading' ? (
        <LoadingNotice />
      ) : pending.length === 0 ? (
        <EmptyNotice titleKey="accountLinks.emptyTitle" bodyKey="accountLinks.emptyBody" headingLevel={2} />
      ) : (
        <>
          <Group titleKey="manage.joins.ready" entries={groups.ready}>
            {groups.ready.map((entry) => (
              <RequestRow key={entry.request.id} request={entry.request} answers={swipe.answersOf(entry)} />
            ))}
          </Group>
          <Group titleKey="manage.joins.review" entries={groups.review}>
            {groups.review.map((entry) => (
              <RequestRow
                key={entry.request.id}
                request={entry.request}
                answers={{ link: null, reject: swipe.answersOf(entry).reject }}
                trailing={entry.assessment.readiness === 'needs_review' ? <Badge tone="pending">{t(REASON_CHIPS[entry.assessment.reason])}</Badge> : null}
              />
            ))}
          </Group>
          <Group titleKey="manage.joins.newSoldiers" entries={groups.newSoldiers}>
            {groups.newSoldiers.map((entry) => (
              <RequestRow
                key={entry.request.id}
                request={entry.request}
                trailing={
                  unitChoices.length === 0 ? null : (
                    <UnitChip
                      options={unitChoices}
                      chosen={placed.has(entry.request.id) ? (placed.get(entry.request.id) ?? null) : undefined}
                      onChoose={(unitId) => {
                        setPlaced((current) => new Map(current).set(entry.request.id, unitId))
                      }}
                    />
                  )
                }
              />
            ))}
          </Group>
        </>
      )}
      {swipe.dialog}
    </PageFrame>
  )
}
