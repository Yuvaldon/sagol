import type { AccountLinkRequest, AppError, CalendarDate, Issue, LinkCandidate, Soldier, Unit, UnitId } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  useCurrentOrganization,
  useLinkCandidates,
  useLinkRequests,
  useReviewLink,
  useRosterPermissions,
  useSoldiers,
  useToday,
  useUnits,
  type LinkReviewChoice,
} from '@logic'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { fieldError, formStateOf } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { unitOptions } from '../soldiers/unitOptions'

// Account link requests, for whoever may review them (D-156, D-157). Each request offers the soldiers it may
// be linked to, a new soldier from its names, or a rejection. The list holds only what this reviewer may decide.

const NO_SELECTION = 'none'
const UNIT_FIELD = 'resolution.membership.unit_id'
const DATE_FIELD = 'resolution.membership.valid_from'
const CREATE_FIELDS: readonly string[] = [UNIT_FIELD, DATE_FIELD]

type Review = (request: AccountLinkRequest, choice: LinkReviewChoice) => Promise<AppError | null>

function CreateSoldierDialog({
  request,
  units,
  soldiers,
  today,
  review,
  isPending,
  onClose,
}: {
  readonly request: AccountLinkRequest
  readonly units: readonly Unit[]
  readonly soldiers: readonly Soldier[]
  readonly today: CalendarDate | null
  readonly review: Review
  readonly isPending: boolean
  readonly onClose: () => void
}) {
  const permissions = useRosterPermissions(soldiers, units)
  const options: SelectOption<UnitId | null>[] = [
    ...(permissions.createWithoutUnit ? [{ key: NO_SELECTION, label: { key: 'soldiers.noUnit' as const }, value: null }] : []),
    ...unitOptions(units, permissions.placeIn),
  ]
  const [unitId, setUnitId] = useState<UnitId | null>(options[0]?.value ?? null)
  const [date, setDate] = useState<CalendarDate | ''>(today ?? '')
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)

  async function submit() {
    setFailure(null)
    if (unitId !== null && date === '') {
      setAnswered([{ path: ['resolution', 'membership', 'valid_from'], code: 'required' }])
      return
    }
    const placement = unitId === null || date === '' ? null : { unit_id: unitId, valid_from: date }
    const error = await review(request, { kind: 'create_soldier', placement })
    if (error === null) {
      onClose()
      return
    }
    const state = formStateOf(error, CREATE_FIELDS)
    setAnswered(state.answered)
    setFailure(state.failure)
  }

  return (
    <SmallDialog
      titleKey="accounts.createTitle"
      hintKey="accounts.createHint"
      confirmKey="accounts.createSubmit"
      isPending={isPending}
      onCancel={onClose}
      onConfirm={() => {
        void submit()
      }}
    >
      <SelectField
        labelKey="soldiers.unit"
        name={UNIT_FIELD}
        value={unitId}
        options={options}
        onChange={setUnitId}
        error={fieldError([], UNIT_FIELD, answered)}
      />
      {unitId === null ? null : (
        <DateField labelKey="soldiers.placedFrom" name={DATE_FIELD} value={date} onChange={setDate} error={fieldError([], DATE_FIELD, answered)} />
      )}
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}

function CandidateRow({
  candidate,
  soldier,
  isPending,
  onLink,
}: {
  readonly candidate: LinkCandidate
  readonly soldier: Soldier | undefined
  readonly isPending: boolean
  readonly onLink: () => void
}) {
  if (soldier === undefined) return null
  return (
    <li className="flex items-center justify-between gap-sm border-b border-line py-xs">
      <span className="flex min-w-none flex-col">
        <span className="truncate text-name font-semibold">{fullName(soldier)}</span>
        <span className="text-micro text-text-muted">
          {t(candidate.match === 'personal_id' ? 'accounts.matchPersonalId' : 'accounts.matchName')}
        </span>
      </span>
      <Button isDisabled={isPending} onPress={onLink}>
        {t('accounts.link')}
      </Button>
    </li>
  )
}

function RequestCard({
  request,
  soldiers,
  units,
  today,
  timezone,
}: {
  readonly request: AccountLinkRequest
  readonly soldiers: readonly Soldier[]
  readonly units: readonly Unit[]
  readonly today: CalendarDate | null
  readonly timezone: string | null
}) {
  const candidates = useLinkCandidates(request.id)
  const permissions = useRosterPermissions(soldiers, units)
  const reviewLink = useReviewLink()
  const [dialog, setDialog] = useState<'create' | 'reject' | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const review: Review = async (target, choice) => {
    setFailure(null)
    const result = await reviewLink.run({ request: target, choice })
    return result.ok ? null : result.error
  }
  const decide = (choice: LinkReviewChoice) => {
    void review(request, choice).then(setFailure)
  }
  const byId = new Map(soldiers.map((soldier) => [soldier.id, soldier]))

  return (
    <article className="flex flex-col gap-sm rounded-panel border border-line p-md">
      <header className="flex flex-col gap-2xs">
        <h3 className="text-name font-bold">{fullName(request)}</h3>
        <span className="text-micro text-text-muted" dir="ltr">
          {request.email ?? ''}
        </span>
        <span className="flex flex-wrap gap-sm text-micro text-text-muted">
          {request.claimed_personal_id === null ? null : (
            <span className="flex gap-2xs">
              <span>{t('soldiers.personalId')}</span>
              <span dir="ltr">{request.claimed_personal_id}</span>
            </span>
          )}
          {timezone === null ? null : <span className="tabular-nums">{formatInstant(request.created_at, timezone)}</span>}
        </span>
      </header>
      {candidates.status === 'failed' ? <FailureNotice error={candidates.error} /> : null}
      {candidates.status === 'loading' ? <LoadingNotice /> : null}
      {candidates.status === 'ready' ? (
        candidates.value.length === 0 ? (
          <p className="text-name text-text-muted">{t('accounts.noCandidates')}</p>
        ) : (
          <ul aria-label={t('accounts.candidates')} className="flex flex-col">
            {candidates.value.map((candidate) => (
              <CandidateRow
                key={candidate.soldier_id}
                candidate={candidate}
                soldier={byId.get(candidate.soldier_id)}
                isPending={reviewLink.isPending}
                onLink={() => {
                  decide({ kind: 'link', soldier_id: candidate.soldier_id })
                }}
              />
            ))}
          </ul>
        )
      ) : null}
      {failure === null ? null : <FailureNotice error={failure} />}
      <div className="flex flex-wrap justify-end gap-sm">
        <Button
          onPress={() => {
            setFailure(null)
            setDialog('reject')
          }}
        >
          {t('accounts.reject')}
        </Button>
        {permissions.create ? (
          <Button
            onPress={() => {
              setFailure(null)
              setDialog('create')
            }}
          >
            {t('accounts.createSoldier')}
          </Button>
        ) : null}
      </div>
      {dialog === 'create' ? (
        <CreateSoldierDialog
          request={request}
          units={units}
          soldiers={soldiers}
          today={today}
          review={review}
          isPending={reviewLink.isPending}
          onClose={() => {
            setDialog(null)
          }}
        />
      ) : null}
      {dialog === 'reject' ? (
        <SmallDialog
          role="alertdialog"
          titleKey="accounts.rejectTitle"
          hintKey="accounts.rejectBody"
          confirmKey="accounts.reject"
          isPending={reviewLink.isPending}
          onCancel={() => {
            setDialog(null)
          }}
          onConfirm={() => {
            void review(request, { kind: 'reject' }).then((error) => {
              setDialog(null)
              setFailure(error)
            })
          }}
        />
      ) : null}
    </article>
  )
}

export function AccountRequestsModule() {
  const requests = useLinkRequests()
  const soldiers = useSoldiers()
  const units = useUnits()
  const organization = useCurrentOrganization()
  const today = useToday()
  const reads = [requests, soldiers, units]
  const failed = reads.find((read) => read.status === 'failed')
  if (failed?.status === 'failed') return <FailureNotice error={failed.error} />
  if (requests.status !== 'ready' || soldiers.status !== 'ready' || units.status !== 'ready') return <LoadingNotice />
  if (requests.value.length === 0) return <EmptyNotice titleKey="accounts.emptyTitle" bodyKey="accounts.emptyBody" />
  const timezone = organization.status === 'ready' && organization.value !== null ? organization.value.timezone : null
  return (
    <div className="flex flex-col gap-md">
      {requests.value.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          soldiers={soldiers.value}
          units={units.value}
          today={today}
          timezone={timezone}
        />
      ))}
    </div>
  )
}
