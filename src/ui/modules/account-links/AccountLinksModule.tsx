import { PANEL_IDS } from '@config'
import type { AccountLinkRequest, AppError, SoldierAccount, CalendarDate, CommandRank, SoldierId, Unit } from '@contracts'
import { t } from '@i18n'
import {
  candidateRows,
  fullName,
  newSoldierFromRequestIssues,
  reviewFormError,
  soldierRows,
  useCommandRanks,
  useLinkCandidates,
  useLinkPlacements,
  useLinkReviewCommands,
  useMemberships,
  usePanel,
  usePendingLinkRequests,
  usePlacementReading,
  useSoldiers,
  useRevokeLink,
  useRevokeLinkHints,
  useSoldierAccounts,
  useTimezone,
  useToday,
  useUnitsWithArchived,
  type CandidateRow,
  type LinkReview,
  type NewSoldierFromRequestValues,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatInstant } from '../../patterns/dates'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { unitStateLabel } from '../../patterns/units'
import { VirtualList } from '../../patterns/VirtualList'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { rankOptions } from '../soldiers/rankOptions'
import { unitOptions } from '../soldiers/unitOptions'

// The account-links module (D-150): the pending requests, and one request with its candidates and the three ways to
// answer it (D-149). What the actor reads is already filtered by the adapter.

const NO_SELECTION = 'none'
const CREATE_FIELDS: readonly string[] = ['command_rank_id', 'membership.unit_id', 'membership.valid_from']

function useRequestTime() {
  const timezone = useTimezone()
  return (request: AccountLinkRequest) => (timezone === null ? '' : formatInstant(request.created_at, timezone))
}

function RequestRow({ request, sentAt }: { readonly request: AccountLinkRequest; readonly sentAt: string }) {
  const panel = usePanel()
  return (
    <AriaButton
      onPress={() => {
        panel.open(PANEL_IDS.accountLinks, { entity: request.id })
      }}
      className="flex min-h-touch w-full min-w-none cursor-pointer flex-col items-start justify-center rounded-control border-b border-line bg-surface p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
    >
      <span className="max-w-full truncate text-name font-semibold">{fullName(request)}</span>
      <span className="flex max-w-full gap-sm truncate text-micro text-text-muted">
        <span dir="ltr">{request.email}</span>
        {sentAt === '' ? null : <span className="tabular-nums">{sentAt}</span>}
      </span>
    </AriaButton>
  )
}

function Field({ labelKey, children }: { readonly labelKey: 'accountLinks.personalId' | 'accountLinks.email' | 'accountLinks.sentAt'; readonly children: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <dt className="text-label font-semibold text-text-muted">{t(labelKey)}</dt>
      <dd className="text-control" dir="ltr">
        {children === '' ? t('accountLinks.notEntered') : children}
      </dd>
    </div>
  )
}

function CandidateItem({ row, onLink }: { readonly row: CandidateRow; readonly onLink: () => void }) {
  const soldier = row.row
  const detail =
    soldier === null
      ? []
      : [soldier.rank?.title, unitStateLabel(soldier.unitState)].filter((part): part is string => part !== undefined && part !== '')
  return (
    <li className="flex items-center gap-sm border-b border-line py-xs">
      <div className="flex min-w-none flex-1 flex-col">
        <span className="truncate text-name font-semibold">{soldier === null ? t('accountLinks.unknownSoldier') : fullName(soldier.soldier)}</span>
        <span className="flex max-w-full gap-sm truncate text-micro text-text-muted">
          <span>{t(row.candidate.match === 'personal_id' ? 'accountLinks.matchPersonalId' : 'accountLinks.matchName')}</span>
          {detail.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </span>
      </div>
      <Button onPress={onLink}>{t('accountLinks.link')}</Button>
    </li>
  )
}

function NewSoldierForm({
  request,
  ranks,
  units,
  today,
  onBack,
  onDone,
}: {
  readonly request: AccountLinkRequest
  readonly ranks: readonly CommandRank[]
  readonly units: readonly Unit[]
  readonly today: CalendarDate | null
  readonly onBack: () => void
  readonly onDone: () => void
}) {
  const commands = useLinkReviewCommands()
  const placements = useLinkPlacements(units)
  const [state, setState] = useState(CLEAN_FORM)
  const options: SelectOption<Unit['id'] | null>[] = [
    ...(placements.withoutUnit ? [{ key: NO_SELECTION, label: { key: 'soldiers.noUnit' as const }, value: null }] : []),
    ...unitOptions(units, placements.placeIn),
  ]
  const initial: NewSoldierFromRequestValues = {
    command_rank_id: null,
    membership: { unit_id: options[0]?.value ?? null, valid_from: today ?? '' },
  }
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: ({ value }) => validatorResult(newSoldierFromRequestIssues(request, value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result = await commands.run({ request, review: { kind: 'create_soldier', values: value } })
      if (result.ok) onDone()
      else setState(formStateOf(reviewFormError(result.error), CREATE_FIELDS))
    },
  })

  if (!placements.any) {
    return (
      <div className="flex flex-col items-start gap-md">
        <p className="text-name text-text-muted">{t('accountLinks.createUnavailable')}</p>
        <Button onPress={onBack}>{t('common.backToList')}</Button>
      </div>
    )
  }

  return (
    <EntityForm
      titleKey="accountLinks.createTitle"
      submitKey="accountLinks.createSubmit"
      isPending={commands.isPending}
      failure={state.failure}
      onCancel={onBack}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <p className="text-name text-text-muted">{t('accountLinks.createHint')}</p>
      <p className="text-name font-semibold">{fullName(request)}</p>
      <form.Field name="command_rank_id">
        {(field) => (
          <SelectField
            labelKey="soldiers.rank"
            name={field.name}
            value={field.state.value}
            options={rankOptions(ranks, null)}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="membership.unit_id">
        {(field) => (
          <SelectField
            labelKey="soldiers.unit"
            name={field.name}
            value={field.state.value}
            options={options}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(current) => current.values.membership.unit_id}>
        {(unitId) =>
          unitId === null ? null : (
            <form.Field name="membership.valid_from">
              {(field) => (
                <DateField
                  labelKey="soldiers.placedFrom"
                  name={field.name}
                  value={field.state.value}
                  onChange={field.handleChange}
                  error={fieldError(field.state.meta.errors, field.name, state.answered)}
                />
              )}
            </form.Field>
          )
        }
      </form.Subscribe>
    </EntityForm>
  )
}

type Confirming = { readonly kind: 'link'; readonly soldierId: SoldierId; readonly name: string } | { readonly kind: 'reject' }

function RequestPage({ request }: { readonly request: AccountLinkRequest }) {
  const panel = usePanel()
  const sentAt = useRequestTime()(request)
  const candidates = useLinkCandidates(request.id)
  const soldiers = useSoldiers()
  const ranks = useCommandRanks()
  const units = useUnitsWithArchived()
  const memberships = useMemberships()
  const today = useToday()
  const reads = usePlacementReading(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  const commands = useLinkReviewCommands()
  const [creating, setCreating] = useState(false)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const liveUnits = useMemo(() => (units.status === 'ready' ? units.value.filter((unit) => unit.archived_at === null) : NO_UNITS), [units])
  const rows = useMemo(
    () =>
      soldiers.status === 'ready' && ranks.status === 'ready' && units.status === 'ready' && memberships.status === 'ready'
        ? soldierRows(soldiers.value, ranks.value, units.value, memberships.value, today, reads)
        : [],
    [soldiers, ranks, units, memberships, today, reads],
  )

  const back = () => {
    panel.open(PANEL_IDS.accountLinks)
  }
  const answer = async (review: LinkReview) => {
    setFailure(null)
    const result = await commands.run({ request, review })
    setConfirming(null)
    if (result.ok) back()
    else setFailure(result.error)
  }

  const failed = [candidates, soldiers, ranks, units, memberships].find((read) => read.status === 'failed')
  if (failed?.status === 'failed') return <FailureNotice error={failed.error} />
  if (candidates.status !== 'ready' || ranks.status !== 'ready' || units.status !== 'ready') return <LoadingNotice />

  if (creating) {
    return (
      <NewSoldierForm
        request={request}
        ranks={ranks.value}
        units={liveUnits}
        today={today}
        onBack={() => {
          setCreating(false)
        }}
        onDone={back}
      />
    )
  }

  const shown = candidateRows(candidates.value, rows)
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-md">
        <Button onPress={back}>{t('common.backToList')}</Button>
        <h3 className="text-body font-bold">{fullName(request)}</h3>
        <dl className="flex flex-col gap-md">
          <Field labelKey="accountLinks.personalId">{request.claimed_personal_id ?? ''}</Field>
          <Field labelKey="accountLinks.email">{request.email}</Field>
          <Field labelKey="accountLinks.sentAt">{sentAt}</Field>
        </dl>
      </div>
      <section className="flex flex-col gap-sm">
        <h3 className="text-body font-bold">{t('accountLinks.candidates')}</h3>
        {shown.length === 0 ? (
          <p className="text-name text-text-muted">{t('accountLinks.noCandidates')}</p>
        ) : (
          <ul aria-label={t('accountLinks.candidatesLabel')} className="flex flex-col">
            {shown.map((row) => (
              <CandidateItem
                key={row.candidate.soldier_id}
                row={row}
                onLink={() => {
                  setFailure(null)
                  setConfirming({
                    kind: 'link',
                    soldierId: row.candidate.soldier_id,
                    name: row.row === null ? t('accountLinks.unknownSoldier') : fullName(row.row.soldier),
                  })
                }}
              />
            ))}
          </ul>
        )}
      </section>
      {failure === null ? null : <FailureNotice error={failure} />}
      <div className="flex flex-wrap gap-sm">
        <Button
          onPress={() => {
            setFailure(null)
            setCreating(true)
          }}
        >
          {t('accountLinks.createSoldier')}
        </Button>
        <Button
          onPress={() => {
            setFailure(null)
            setConfirming({ kind: 'reject' })
          }}
        >
          {t('accountLinks.reject')}
        </Button>
      </div>
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
            void answer({ kind: 'link', soldierId: confirming.soldierId })
          }}
        >
          <dl className="flex flex-col gap-xs text-name">
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
            void answer({ kind: 'reject' })
          }}
        />
      ) : null}
    </div>
  )
}

const NO_SOLDIERS: readonly never[] = []
const NO_UNITS: readonly never[] = []

export function AccountLinksModule() {
  const requests = usePendingLinkRequests()
  const panel = usePanel()
  const sentAt = useRequestTime()
  if (requests.status === 'failed') return <FailureNotice error={requests.error} />
  if (requests.status === 'loading') return <LoadingNotice />

  if (panel.entity !== null) {
    const request = requests.value.find((candidate) => candidate.id === panel.entity)
    if (request === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('accountLinks.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.accountLinks)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <RequestPage key={request.id} request={request} />
  }

  return (
    <div className="flex flex-col gap-lg">
      <section className="flex flex-col gap-xs">
        <h3 className="text-control font-semibold">{t('accountLinks.requestsTitle')}</h3>
        {requests.value.length === 0 ? (
          <EmptyNotice titleKey="accountLinks.emptyTitle" bodyKey="accountLinks.emptyBody" />
        ) : (
          <VirtualList
            labelKey="accountLinks.listLabel"
            items={requests.value}
            keyOf={(request) => request.id}
            renderRow={(request) => <RequestRow request={request} sentAt={sentAt(request)} />}
          />
        )}
      </section>
      <LinkedAccounts />
    </div>
  )
}

/** The live links the actor reads, each with "unlink" for who may review its soldier (D-163, OI-103). */
function LinkedAccounts() {
  const accounts = useSoldierAccounts()
  const soldiers = useSoldiers()
  const timezone = useTimezone()
  const live = useMemo(
    () => (accounts.status === 'ready' ? accounts.value.filter((account) => account.revoked_at === null) : []),
    [accounts],
  )
  const canRevoke = useRevokeLinkHints(live)
  const revoke = useRevokeLink()
  const [revoking, setRevoking] = useState<SoldierAccount | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  if (accounts.status === 'failed') return <FailureNotice error={accounts.error} />
  if (accounts.status === 'loading') return <LoadingNotice />
  const nameOf = (account: SoldierAccount) => {
    const soldier = soldiers.status === 'ready' ? soldiers.value.find((candidate) => candidate.id === account.soldier_id) : undefined
    return soldier === undefined ? t('accountLinks.unknownSoldier') : fullName(soldier)
  }

  return (
    <section className="flex flex-col gap-xs">
      <h3 className="text-control font-semibold">{t('accountLinks.linkedTitle')}</h3>
      {failure === null ? null : <FailureNotice error={failure} />}
      {live.length === 0 ? (
        <p className="text-name text-text-muted">{t('accountLinks.linkedEmpty')}</p>
      ) : (
        <ul aria-label={t('accountLinks.linkedLabel')} className="flex flex-col">
          {live.map((account) => (
            <li key={account.id} className="flex items-center gap-sm border-b border-line bg-surface p-xs">
              <span className="flex min-w-none flex-1 flex-col">
                <span className="truncate text-name font-semibold">{nameOf(account)}</span>
                <span dir="ltr" className="truncate text-start text-micro text-text-muted">
                  {account.email}
                </span>
                {timezone === null ? null : (
                  <span className="truncate text-micro text-text-muted">
                    {t('accountLinks.linkedAt')} {formatInstant(account.linked_at, timezone)}
                  </span>
                )}
              </span>
              {canRevoke(account) ? (
                <Button
                  onPress={() => {
                    setFailure(null)
                    setRevoking(account)
                  }}
                >
                  {t('accountLinks.unlink')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {revoking === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="accountLinks.unlinkTitle"
          hintKey="accountLinks.unlinkHint"
          confirmKey="accountLinks.unlinkConfirm"
          isPending={revoke.isPending}
          onCancel={() => {
            setRevoking(null)
          }}
          onConfirm={() => {
            void revoke.run(revoking).then((result) => {
              setRevoking(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        >
          <p className="text-name font-semibold">{nameOf(revoking)}</p>
        </SmallDialog>
      )}
    </section>
  )
}
