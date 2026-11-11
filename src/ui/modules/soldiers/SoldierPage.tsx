import { PANEL_IDS } from '@config'
import type { AppError, CalendarDate, CommandRank, Issue, Soldier, Unit, UnitId, UnitMembership } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  fullName,
  moveFormIssues,
  openMembershipOf,
  soldierHistory,
  usePanel,
  useSoldierCommands,
  useSoldierPagePermissions,
  useSoldierPrivate,
  type HistoryUnit,
} from '@logic'
import { ArrowRight, CornerDownLeft } from 'lucide-react'
import { useState } from 'react'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { fieldError, formStateOf } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { DateField } from '../../primitives/DateField'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { SoldierAccountSection } from './SoldierAccount'
import { SoldierPrivateForm, SoldierProfileForm } from './SoldierForms'
import { SoldierTagsSection } from './SoldierTags'
import { unitOptions } from './unitOptions'

// One soldier: the profile, the tags, the private fields, the login account and the placement. Each section has its own permission
// (D-094, D-096, D-130), so each appears on its own.

const NO_SELECTION = 'none'
const MOVE_FIELDS: readonly string[] = ['new_membership.unit_id', 'new_membership', 'effective_date']

function ReadOnlyField({ labelKey, value }: { readonly labelKey: I18nKey; readonly value: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <dt className="text-label font-semibold text-text-muted">{t(labelKey)}</dt>
      <dd className="text-control">{value === '' ? t('soldiers.emptyValue') : value}</dd>
    </div>
  )
}

function ReadOnlyProfile({ soldier, rank }: { readonly soldier: Soldier; readonly rank: CommandRank | null }) {
  return (
    <section className="flex flex-col gap-md">
      <h3 className="text-body font-bold">{t('soldiers.profileTitle')}</h3>
      <dl className="flex flex-col gap-md">
        <ReadOnlyField labelKey="soldiers.firstName" value={soldier.first_name} />
        <ReadOnlyField labelKey="soldiers.lastName" value={soldier.last_name} />
        <ReadOnlyField labelKey="soldiers.nickname" value={soldier.nickname ?? ''} />
        <ReadOnlyField labelKey="soldiers.rank" value={rank?.title ?? ''} />
        <ReadOnlyField
          labelKey="soldiers.status"
          value={t(soldier.status === 'active' ? 'soldiers.statusActive' : 'soldiers.statusInactive')}
        />
      </dl>
    </section>
  )
}

function PrivateSection({ soldier, canUpdate }: { readonly soldier: Soldier; readonly canUpdate: boolean }) {
  const row = useSoldierPrivate(soldier.id, true)
  if (row.status === 'failed') return <FailureNotice error={row.error} />
  if (row.status === 'loading') return <LoadingNotice />
  if (canUpdate) return <SoldierPrivateForm soldier={soldier} row={row.value} />
  return (
    <section className="flex flex-col gap-md">
      <h3 className="text-body font-bold">{t('soldiers.privateTitle')}</h3>
      <dl className="flex flex-col gap-md">
        <ReadOnlyField labelKey="soldiers.personalId" value={row.value?.personal_id ?? ''} />
        <ReadOnlyField labelKey="soldiers.inviteEmail" value={row.value?.invite_email ?? ''} />
        <ReadOnlyField labelKey="soldiers.phone" value={row.value?.phone ?? ''} />
      </dl>
    </section>
  )
}

function MoveDialog({
  soldier,
  open,
  options,
  today,
  onClose,
}: {
  readonly soldier: Soldier
  readonly open: UnitMembership | null
  readonly options: readonly SelectOption<UnitId | null>[]
  readonly today: CalendarDate | null
  readonly onClose: () => void
}) {
  const { move } = useSoldierCommands()
  const [unitId, setUnitId] = useState<UnitId | null>(options[0]?.value ?? null)
  const [date, setDate] = useState<CalendarDate | ''>(today ?? '')
  const [answered, setAnswered] = useState<readonly Issue[]>([])
  const [failure, setFailure] = useState<AppError | null>(null)

  async function submit() {
    setFailure(null)
    const values = { unit_id: unitId, effective_date: date }
    const issues = moveFormIssues(soldier.id, open, values)
    setAnswered(issues)
    if (issues.length > 0) return
    const result = await move.run({ soldierId: soldier.id, open, values })
    if (result.ok) {
      onClose()
      return
    }
    const state = formStateOf(result.error, MOVE_FIELDS)
    setAnswered(state.answered)
    setFailure(state.failure)
  }

  return (
    <SmallDialog
      titleKey="soldiers.moveTitle"
      hintKey="soldiers.moveHint"
      confirmKey="soldiers.moveSubmit"
      isPending={move.isPending}
      onCancel={onClose}
      onConfirm={() => {
        void submit()
      }}
    >
      <SelectField
        labelKey="soldiers.unit"
        name="new_membership.unit_id"
        value={unitId}
        options={options}
        onChange={setUnitId}
        error={fieldError([], 'new_membership.unit_id', answered) ?? fieldError([], 'new_membership', answered)}
      />
      <DateField
        labelKey="soldiers.moveDate"
        name="effective_date"
        value={date}
        onChange={setDate}
        error={fieldError([], 'effective_date', answered)}
      />
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}

function historyName(unit: HistoryUnit): string {
  return unit.kind === 'hidden' ? t('soldiers.hiddenUnit') : unit.name
}

function PlacementSection({
  soldier,
  units,
  memberships,
  today,
  canMove,
  allowedUnit,
}: {
  readonly soldier: Soldier
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly today: CalendarDate | null
  readonly canMove: boolean
  readonly allowedUnit: (id: UnitId) => boolean
}) {
  const [moving, setMoving] = useState(false)
  const history = soldierHistory(memberships, units, soldier.id)
  const open = openMembershipOf(memberships, soldier.id)
  const live = units.filter((unit) => unit.archived_at === null)
  const options: SelectOption<UnitId | null>[] = [
    ...unitOptions(live, allowedUnit).filter((option) => option.value !== open?.unit_id),
    // Leaving with no new unit empties a unit before it is archived (D-097).
    ...(open === null ? [] : [{ key: NO_SELECTION, label: { key: 'soldiers.noUnit' as const }, value: null }]),
  ]

  return (
    <section className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-sm">
        <h3 className="text-body font-bold">{t('soldiers.placementTitle')}</h3>
        {canMove && options.length > 0 ? (
          <Button
            onPress={() => {
              setMoving(true)
            }}
          >
            <CornerDownLeft aria-hidden size={14} />
            {t('soldiers.moveOpen')}
          </Button>
        ) : null}
      </div>
      {history.length === 0 ? (
        <p className="text-name text-text-muted">{t('soldiers.noHistory')}</p>
      ) : (
        <ul aria-label={t('soldiers.historyLabel')} className="flex flex-col">
          {history.map(({ membership, unit }) => (
            <li key={membership.id} className="flex flex-col gap-2xs border-b border-line py-sm">
              <span className="flex items-center gap-sm text-name font-semibold">
                {historyName(unit)}
                {unit.kind === 'archived' ? (
                  <span className="text-micro font-normal text-text-muted">{t('soldiers.unitArchived')}</span>
                ) : null}
              </span>
              <span className="flex gap-xs text-micro text-text-muted">
                <span>{t('soldiers.historyFrom')}</span>
                <span className="tabular-nums">{formatDate(membership.valid_from)}</span>
                {membership.valid_to === null ? null : (
                  <>
                    <span>{t('soldiers.historyTo')}</span>
                    <span className="tabular-nums">{formatDate(membership.valid_to)}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {moving ? (
        <MoveDialog
          soldier={soldier}
          open={open}
          options={options}
          today={today}
          onClose={() => {
            setMoving(false)
          }}
        />
      ) : null}
    </section>
  )
}

export function SoldierPage({
  soldier,
  ranks,
  units,
  memberships,
  today,
}: {
  readonly soldier: Soldier
  readonly ranks: readonly CommandRank[]
  /** Archived ones too, for the history (D-099). */
  readonly units: readonly Unit[]
  readonly memberships: readonly UnitMembership[]
  readonly today: CalendarDate | null
}) {
  const panel = usePanel()
  const liveUnits = units.filter((unit) => unit.archived_at === null)
  const permissions = useSoldierPagePermissions(soldier, liveUnits)
  const rank = ranks.find((candidate) => candidate.id === soldier.command_rank_id) ?? null
  // Saving tags moves the soldier's version (D-130), so the profile form opens again on the new one once it arrives:
  // the change came from this page, not from another tab.
  const [profileGeneration, setProfileGeneration] = useState(0)
  const [reopenAfter, setReopenAfter] = useState<number | null>(null)
  if (reopenAfter !== null && soldier.version > reopenAfter) {
    setReopenAfter(null)
    setProfileGeneration((current) => current + 1)
  }

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex items-center gap-sm">
        <Button
          onPress={() => {
            panel.open(PANEL_IDS.soldiers)
          }}
        >
          <ArrowRight aria-hidden size={14} />
          {t('common.backToList')}
        </Button>
        <h2 className="truncate text-body font-bold">{fullName(soldier)}</h2>
      </div>
      {permissions.update ? (
        <SoldierProfileForm key={profileGeneration} soldier={soldier} ranks={ranks} />
      ) : (
        <ReadOnlyProfile soldier={soldier} rank={rank} />
      )}
      <SoldierTagsSection
        soldier={soldier}
        onSaved={setReopenAfter}
      />
      {permissions.viewPrivate ? <PrivateSection soldier={soldier} canUpdate={permissions.updatePrivate} /> : null}
      <SoldierAccountSection soldier={soldier} />
      {permissions.viewMemberships ? (
        <PlacementSection
          soldier={soldier}
          units={units}
          memberships={memberships}
          today={today}
          canMove={permissions.move}
          allowedUnit={permissions.moveTo}
        />
      ) : null}
    </div>
  )
}
