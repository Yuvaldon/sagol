import { PANEL_IDS } from '@config'
import type { AccountLinkRequest, AppError, LinkAssessment, SoldierId, UnitId } from '@contracts'
import { t } from '@i18n'
import {
  candidateRows,
  fullName,
  matchesName,
  soldierRows,
  useCommandRanks,
  useLinkAssessments,
  useLinkPlacements,
  useLinkReviewCommands,
  useMemberships,
  usePanel,
  usePendingLinkRequests,
  usePlacementReading,
  useSoldierPrivate,
  useSoldiers,
  useTimezone,
  useToday,
  useUnits,
  useUnitsWithArchived,
  type CandidateRow,
  type LinkReview,
} from '@logic'
import { useMemo, useState } from 'react'
import { Button as AriaButton, Radio, RadioGroup } from 'react-aria-components'
import { StopDrawer } from '../../kit/StopDrawer'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { unitStateLabel } from '../../patterns/units'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'
import { SelectField } from '../../primitives/SelectField'
import { unitOptions } from '../../modules/soldiers/unitOptions'
import { useNotices } from '../notices'
import { REASON_CHIPS } from './joinWords'

// "זה הוא?" (the handoff's join-request drawer, D-482, OI-382): the requester, when they asked, and the answer the
// assessment proposes (D-447). One candidate: "זה הוא?" with their row and, when a detail differs, an amber block with
// both values; "כן, לקשר" and "לא". Several: "מי מהם?" and "לקשר" or "אף אחד". None: "ליחידה" and "יצירה וקישור", with
// "עוד". "לא", "אף אחד" and "עוד" open "חייל אחר" (search) and "דחיית הבקשה", which asks first: the requester is told,
// and it cannot be taken back. A personal-number conflict never overwrites the card (D-451).

const SEPARATOR = ' · '
const WORD = ' '
const MAX_FOUND = 8
const NO_ROWS: readonly never[] = []

const BUTTON = 'inline-flex min-h-tab cursor-pointer items-center justify-center rounded-full px-xl text-body font-bold outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'
const PRIMARY = `${BUTTON} flex-1 bg-action-solid text-on-action shadow-primary`
const SECONDARY = `${BUTTON} bg-surface text-text`

function CandidateLine({ row }: { readonly row: CandidateRow }) {
  const soldier = row.row
  const detail = soldier === null ? [] : [soldier.rank?.title, unitStateLabel(soldier.unitState)].filter((part): part is string => part !== undefined && part !== '')
  return (
    <span className="flex min-w-none flex-1 items-baseline gap-sm">
      <span className="shrink-0 truncate text-body font-semibold">{soldier === null ? t('accountLinks.unknownSoldier') : fullName(soldier.soldier)}</span>
      {detail.length === 0 ? null : <span className="min-w-none truncate text-small text-text-muted">{detail.join(SEPARATOR)}</span>}
    </span>
  )
}

/** "{field} שונה מהכרטיס", with the request's value over the card's (the handoff's conflict block). */
function Conflict({ request, assessment, candidate }: { readonly request: AccountLinkRequest; readonly assessment: LinkAssessment; readonly candidate: CandidateRow }) {
  const card = useSoldierPrivate(candidate.candidate.soldier_id, assessment.readiness === 'needs_review')
  if (assessment.readiness !== 'needs_review') return null
  const stored = card.status === 'ready' ? card.value : null
  const pairs: { readonly key: string; readonly label: string; readonly asked: string; readonly held: string | null }[] = []
  const { reason } = assessment
  if (reason === 'personal_id_differs' || reason === 'email_and_id_differ') {
    pairs.push({ key: 'id', label: t('manage.joins.personalIdDiffers'), asked: request.claimed_personal_id ?? '', held: stored?.personal_id ?? null })
  }
  if (reason === 'invite_email_differs' || reason === 'email_and_id_differ') {
    pairs.push({ key: 'email', label: t('manage.joins.emailDiffers'), asked: request.email, held: stored?.invite_email ?? null })
  }
  if (reason === 'name_differs') {
    pairs.push({ key: 'name', label: t('manage.joins.nameDiffers'), asked: fullName(request), held: candidate.row === null ? null : fullName(candidate.row.soldier) })
  }
  return (
    <section className="flex flex-col gap-sm rounded-card bg-status-pending p-lg text-status-pending-text">
      {pairs.length === 0 ? <p className="text-body font-bold">{t(REASON_CHIPS[reason])}</p> : null}
      {pairs.map((pair) => (
        <div key={pair.key} className="flex flex-col gap-2xs">
          <p className="text-body font-bold">{pair.label}</p>
          <dl className="grid grid-cols-2 gap-x-md gap-y-2xs text-body">
            <dt>{t('manage.joins.inRequest')}</dt>
            <dd dir="ltr" className="text-start font-bold tabular-nums">
              {pair.asked === '' ? t('accountLinks.notEntered') : pair.asked}
            </dd>
            {pair.held === null ? null : (
              <>
                <dt>{t('manage.joins.onCard')}</dt>
                <dd dir="ltr" className="text-start font-bold tabular-nums">
                  {pair.held}
                </dd>
              </>
            )}
          </dl>
        </div>
      ))}
    </section>
  )
}

/** "חייל אחר": any soldier the actor sees, found by name. */
function OtherSoldier({ onLink }: { readonly onLink: (soldierId: SoldierId, name: string) => void }) {
  const soldiers = useSoldiers()
  const [query, setQuery] = useState('')
  const found = useMemo(
    () => (soldiers.status === 'ready' && query.trim() !== '' ? soldiers.value.filter((soldier) => matchesName(soldier, query)).slice(0, MAX_FOUND) : []),
    [soldiers, query],
  )
  return (
    <section className="flex flex-col gap-sm">
      <TextField labelKey="manage.joins.otherSoldier" name="other" value={query} onChange={setQuery} error={null} />
      {found.length === 0 ? null : (
        <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
          {found.map((soldier) => (
            <li key={soldier.id} className="border-b border-divider-strong last:border-b-0">
              <AriaButton
                onPress={() => {
                  onLink(soldier.id, fullName(soldier))
                }}
                className="flex min-h-touch w-full cursor-pointer items-center px-lg text-start text-body font-semibold outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
              >
                {fullName(soldier)}
              </AriaButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Confirming = { readonly kind: 'link'; readonly soldierId: SoldierId; readonly name: string } | { readonly kind: 'reject' }

function Answer({ request, assessment, onClose }: { readonly request: AccountLinkRequest; readonly assessment: LinkAssessment; readonly onClose: () => void }) {
  const panel = usePanel()
  const notices = useNotices()
  const today = useToday()
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnitsWithArchived()
  const liveUnits = useUnits()
  const memberships = useMemberships()
  const reads = usePlacementReading(soldiers.status === 'ready' ? soldiers.value : NO_ROWS)
  const placements = useLinkPlacements(liveUnits.status === 'ready' ? liveUnits.value : NO_ROWS)
  const commands = useLinkReviewCommands()
  const [more, setMore] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<UnitId | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  // A refusal shows in the drawer, which stands over the toast.
  const [failure, setFailure] = useState<AppError | null>(null)
  const rows = useMemo(
    () =>
      soldiers.status === 'ready' && ranks.status === 'ready' && units.status === 'ready' && memberships.status === 'ready'
        ? soldierRows(soldiers.value, ranks.value, units.value, memberships.value, today, reads)
        : [],
    [soldiers, ranks, units, memberships, today, reads],
  )
  const candidates = candidateRows(assessment.candidates, rows)
  const options = unitOptions(liveUnits.status === 'ready' ? liveUnits.value : NO_ROWS, placements.placeIn)
  const chosenUnit = unitId ?? options[0]?.value ?? null

  const answer = (review: LinkReview, done: (request: AccountLinkRequest) => void) => {
    void commands.run({ request, review }).then((result) => {
      setConfirming(null)
      if (!result.ok) {
        setFailure(result.error)
        return
      }
      onClose()
      done(result.value)
    })
  }
  const linked = (answered: AccountLinkRequest) => {
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
  }
  const link = (soldierId: SoldierId) => {
    answer({ kind: 'link', soldierId }, linked)
  }
  const [only] = candidates
  const several = candidates.length > 1

  const rest = (
    <div className="flex flex-col gap-md">
      <OtherSoldier
        onLink={(soldierId, name) => {
          setConfirming({ kind: 'link', soldierId, name })
        }}
      />
      <Button
        onPress={() => {
          setConfirming({ kind: 'reject' })
        }}
      >
        {t('accountLinks.reject')}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-lg">
      {candidates.length === 0 ? (
        <>
          {options.length === 0 ? (
            <p className="text-body text-text-muted">{t('accountLinks.createUnavailable')}</p>
          ) : (
            <SelectField labelKey="manage.add.unit" name="unit_id" value={chosenUnit} options={options} onChange={setUnitId} error={null} />
          )}
          <div className="flex gap-sm">
            {options.length === 0 ? null : (
              <AriaButton
                isDisabled={chosenUnit === null || commands.isPending || today === null}
                onPress={() => {
                  if (chosenUnit === null || today === null) return
                  answer({ kind: 'create_soldier', values: { command_rank_id: null, membership: { unit_id: chosenUnit, valid_from: today } } }, linked)
                }}
                className={PRIMARY}
              >
                {t('manage.joins.createAndLink')}
              </AriaButton>
            )}
            <AriaButton
              aria-expanded={more}
              onPress={() => {
                setMore(!more)
              }}
              className={SECONDARY}
            >
              {t('manage.joins.more')}
            </AriaButton>
          </div>
        </>
      ) : several ? (
        <>
          <RadioGroup aria-label={t('manage.joins.whichOne')} value={picked} onChange={setPicked} className="flex flex-col gap-xs">
            <p className="text-heading font-bold">{t('manage.joins.whichOne')}</p>
            <div className="flex flex-col overflow-hidden rounded-card bg-surface">
              {candidates.map((row) => (
                <Radio
                  key={row.candidate.soldier_id}
                  value={row.candidate.soldier_id}
                  className="flex min-h-touch cursor-pointer items-center gap-sm border-b border-divider-strong px-lg outline-focus -outline-offset-2 last:border-b-0 data-focus-visible:outline-2 data-selected:bg-action-soft"
                >
                  <CandidateLine row={row} />
                </Radio>
              ))}
            </div>
          </RadioGroup>
          <div className="flex gap-sm">
            <AriaButton
              isDisabled={picked === null || commands.isPending}
              onPress={() => {
                const chosen = candidates.find((row) => row.candidate.soldier_id === picked)
                if (chosen !== undefined) link(chosen.candidate.soldier_id)
              }}
              className={PRIMARY}
            >
              {t('manage.joins.link')}
            </AriaButton>
            <AriaButton
              aria-expanded={more}
              onPress={() => {
                setMore(!more)
              }}
              className={SECONDARY}
            >
              {t('manage.joins.none')}
            </AriaButton>
          </div>
        </>
      ) : only === undefined ? null : (
        <>
          <section className="flex flex-col gap-xs">
            <p className="text-heading font-bold">{t('manage.joins.isThisHim')}</p>
            <div className="flex min-h-touch items-center rounded-card bg-surface px-lg">
              <CandidateLine row={only} />
            </div>
          </section>
          <Conflict request={request} assessment={assessment} candidate={only} />
          <div className="flex gap-sm">
            <AriaButton
              isDisabled={commands.isPending}
              onPress={() => {
                link(only.candidate.soldier_id)
              }}
              className={PRIMARY}
            >
              {t('manage.joins.yesLink')}
            </AriaButton>
            <AriaButton
              aria-expanded={more}
              onPress={() => {
                setMore(!more)
              }}
              className={SECONDARY}
            >
              {t('manage.joins.no')}
            </AriaButton>
          </div>
        </>
      )}
      {failure === null ? null : <FailureNotice error={failure} />}
      {more ? rest : null}
      {confirming?.kind === 'link' ? (
        <SmallDialog
          titleKey="accountLinks.linkTitle"
          hintKey="accountLinks.linkHint"
          confirmKey="accountLinks.linkConfirm"
          isPending={commands.isPending}
          onCancel={() => {
            setConfirming(null)
          }}
          onConfirm={() => {
            link(confirming.soldierId)
          }}
        >
          <dl className="flex flex-col gap-xs text-body">
            <div className="flex gap-sm">
              <dt className="text-text-muted">{t('accountLinks.linkFrom')}</dt>
              <dd className="font-semibold">{fullName(request)}</dd>
            </div>
            <div className="flex gap-sm">
              <dt className="text-text-muted">{t('accountLinks.linkTo')}</dt>
              <dd className="font-semibold">{confirming.name}</dd>
            </div>
          </dl>
        </SmallDialog>
      ) : null}
      {confirming?.kind === 'reject' ? (
        <SmallDialog
          role="alertdialog"
          titleKey="accountLinks.rejectTitle"
          hintKey="accountLinks.rejectHint"
          confirmKey="accountLinks.rejectConfirm"
          isPending={commands.isPending}
          onCancel={() => {
            setConfirming(null)
          }}
          onConfirm={() => {
            answer({ kind: 'reject' }, () => {
              notices.say([t('manage.joins.rejected'), fullName(request)].join(WORD))
            })
          }}
        />
      ) : null}
    </div>
  )
}

function Request({ request, onClose }: { readonly request: AccountLinkRequest; readonly onClose: () => void }) {
  const timezone = useTimezone()
  const assessments = useLinkAssessments([request])
  const asked = timezone === null ? t('manage.joins.asked') : [t('manage.joins.asked'), formatInstant(request.created_at, timezone)].join(SEPARATOR)
  const assessment = assessments.status === 'ready' ? assessments.value[request.id] : undefined
  return (
    <StopDrawer inUrl title={fullName(request)} detail={asked} onClose={onClose}>
      {assessments.status === 'failed' ? (
        <FailureNotice error={assessments.error} />
      ) : assessment === undefined ? (
        <LoadingNotice />
      ) : (
        <Answer request={request} assessment={assessment} onClose={onClose} />
      )}
    </StopDrawer>
  )
}

/** The drawer of one join request, `panel=account_links&entity=<id>`; the list is the page "הצטרפות". */
export function JoinDrawer() {
  const panel = usePanel()
  const requests = usePendingLinkRequests()
  if (panel.panel !== PANEL_IDS.accountLinks || panel.entity === null) return null
  const request = requests.status === 'ready' ? requests.value.find((candidate) => candidate.id === panel.entity) : undefined
  if (request !== undefined) return <Request key={request.id} request={request} onClose={panel.close} />
  return (
    <StopDrawer inUrl title={t('manage.pages.joins')} onClose={panel.close}>
      {requests.status === 'failed' ? (
        <FailureNotice error={requests.error} />
      ) : requests.status === 'loading' ? (
        <LoadingNotice />
      ) : (
        <p className="text-body text-text-muted">{t('accountLinks.notFound')}</p>
      )}
    </StopDrawer>
  )
}
