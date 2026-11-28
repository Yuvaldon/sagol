import { ARCHIVE_ENTITY, NEW_ENTITY, PANEL_IDS, TODAY } from '@config'
import { SoldierId, type AppError, type Soldier, type SoldierAccount } from '@contracts'
import { t } from '@i18n'
import {
  fullName,
  isBeforeDay,
  selectDay,
  selectionCovers,
  useLeaveCreation,
  usePanel,
  usePerson,
  useRevokeLink,
  useRevokeLinkHints,
  useRosterPermissions,
  useSoldierAccounts,
  useSoldierCommands,
  useSoldierDays,
  useLeaveTypes,
  useUnits,
  type DaySelection,
  type Person,
} from '@logic'
import { Archive, Unlink } from 'lucide-react'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CardDoor } from '../kit/Card'
import { DayStrip } from '../kit/DayStrip'
import { useFullStop } from '../kit/drawerStop'
import { StopDrawer } from '../kit/StopDrawer'
import { leaveDaysText } from '../modules/leaves/leaveText'
import { ActionMenu, type RowAction } from '../patterns/ActionMenu'
import { SmallDialog } from '../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../patterns/Notices'
import { UNIT_STATE_KEYS } from '../patterns/units'
import { restoreFailureKey } from '../patterns/restoreFailure'
import { useNotices } from './notices'
import { standingOf } from './today/standing'
import { SoldierArchiveDrawer } from './manage/ArchiveDrawers'
import { EditControls, ProfileBody } from './person/Profile'
import { useProfileEdit, type ProfileEdit } from './person/useProfileEdit'

// The person card (the handoff's Person card, D-482): one component, two heights. At half height, where the soldier is
// placed, their tags, their personal number and phone with copy, where they are now and their next 14 days, whose days
// are chosen for a new leave. "כרטיס מלא" grows it to the full card: details, tags, placement, seniority, access and
// history, each section by its own permission (D-096). The rare actions are behind "⋯": unlinking the account and,
// last, archiving (D-461). Opened from any name, `panel=soldiers&entity=<id>`.

const SoldierPage = lazy(() => import('../modules/soldiers/SoldierPage').then((module) => ({ default: module.FullCard })))

const SEPARATOR = ' · '
const WORD = ' '
const NO_ROWS: readonly never[] = []

/** Where the soldier is and their next 14 days, for who reads their leaves; days chosen there become a new leave. */
function Days({ soldier }: { readonly soldier: Soldier }) {
  const panel = usePanel()
  const days = useSoldierDays(soldier.id, TODAY.stripDays)
  const types = useLeaveTypes()
  const creation = useLeaveCreation([soldier])
  const [selection, setSelection] = useState<DaySelection | null>(null)
  if (days === null) return null
  if (days.status !== 'ready') return <LoadingNotice />
  const { today } = days.value
  const standing = standingOf(today, days.value.days, types.status === 'ready' ? types.value : NO_ROWS)
  if (standing === null) return null
  const creates = creation.soldiers.some((candidate) => candidate.id === soldier.id)
  return (
    <section className="flex flex-col gap-md rounded-card bg-surface p-lg">
      <p className="text-body font-semibold tabular-nums">{[standing.place, standing.next].join(SEPARATOR)}</p>
      <DayStrip
        days={standing.days}
        today={today}
        labelKey="myLeaves.nextDaysTitle"
        select={
          creates
            ? {
                covers: (day) => selectionCovers(selection, day),
                allows: (day) => !isBeforeDay(day, today),
                onDay: (day) => {
                  setSelection(selectDay(selection, day))
                },
              }
            : null
        }
      />
      {selection === null ? null : (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY, draft: { soldier_id: soldier.id, start_date: selection.start, end_date: selection.end } })
          }}
          className="inline-flex min-h-tab w-full cursor-pointer items-center justify-center rounded-full bg-action-solid px-xl text-body font-bold text-on-action shadow-primary outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <span className="truncate tabular-nums">
            {[[t('manage.person.leaveFor'), soldier.first_name].join(WORD), leaveDaysText({ start_date: selection.start, end_date: selection.end })].join(SEPARATOR)}
          </span>
        </AriaButton>
      )}
    </section>
  )
}

/** The full card's sections, once it is asked for. */
function Full({ soldier }: { readonly soldier: Soldier }) {
  return (
    <Suspense fallback={<LoadingNotice />}>
      <SoldierPage soldier={soldier} />
    </Suspense>
  )
}

function Card({ person, edit }: { readonly person: Person; readonly edit: ProfileEdit }) {
  const grow = useFullStop()
  const [full, setFull] = useState(false)
  const { soldier } = person
  // The edit asks for the full stop: its fields are more than half a screen (D-477).
  const { editing } = edit
  useEffect(() => {
    if (editing) grow()
  }, [editing, grow])
  return (
    <div className="flex flex-col gap-lg">
      <ProfileBody edit={edit} tags={person.tags} expanded={false} />
      {editing ? null : <Days soldier={soldier} />}
      {editing ? null : full ? (
        <Full soldier={soldier} />
      ) : (
        <CardDoor
          labelKey="manage.person.full"
          onPress={() => {
            setFull(true)
            grow()
          }}
        />
      )}
    </div>
  )
}

type Asking = { readonly kind: 'archive' } | { readonly kind: 'unlink'; readonly account: SoldierAccount }

/** "⋯" of the card: unlinking the account, and archiving last (D-461). Each asks first, by name. */
function useCardActions(soldier: Soldier, onArchived: () => void) {
  const notices = useNotices()
  const units = useUnits()
  const roster = useRosterPermissions([soldier], units.status === 'ready' ? units.value : NO_ROWS)
  const commands = useSoldierCommands()
  const accounts = useSoldierAccounts()
  const live = useMemo(
    () => (accounts.status === 'ready' ? accounts.value.filter((account) => account.soldier_id === soldier.id && account.revoked_at === null) : NO_ROWS),
    [accounts, soldier.id],
  )
  const canRevoke = useRevokeLinkHints(live)
  const revoke = useRevokeLink()
  const [asking, setAsking] = useState<Asking | null>(null)
  // A refusal shows in the card: the drawer stands over the toast.
  const [failure, setFailure] = useState<AppError | null>(null)
  const [account] = live.filter(canRevoke)
  const actions: RowAction[] = [
    ...(account === undefined
      ? []
      : [
          {
            id: 'unlink',
            labelKey: 'accountLinks.unlink' as const,
            icon: <Unlink aria-hidden size={14} />,
            onAction: () => {
              setAsking({ kind: 'unlink', account })
            },
          },
        ]),
    ...(roster.archive(soldier)
      ? [
          {
            id: 'archive',
            labelKey: 'manage.archive.move' as const,
            icon: <Archive aria-hidden size={14} />,
            tone: 'danger' as const,
            onAction: () => {
              setAsking({ kind: 'archive' })
            },
          },
        ]
      : []),
  ]
  const name = fullName(soldier)
  const dialog =
    asking === null ? null : asking.kind === 'archive' ? (
      <SmallDialog
        role="alertdialog"
        titleKey="manage.archive.soldierTitle"
        hintKey="soldiers.archiveBody"
        confirmKey="manage.archive.confirm"
        tone="danger"
        isPending={commands.archive.isPending}
        onCancel={() => {
          setAsking(null)
        }}
        onConfirm={() => {
          void commands.archive.run(soldier).then((result) => {
            setAsking(null)
            if (!result.ok) {
              setFailure(result.error)
              return
            }
            onArchived()
            notices.say([name, t('manage.archive.done')].join(WORD), {
              labelKey: 'common.cancel',
              run: () => {
                void commands.restore.run(result.value).then((restored) => {
                  if (!restored.ok) notices.fail(restored.error, restoreFailureKey(restored.error))
                })
              },
            })
          })
        }}
      >
        <p className="text-body font-semibold">{name}</p>
      </SmallDialog>
    ) : (
      <SmallDialog
        role="alertdialog"
        titleKey="accountLinks.unlinkTitle"
        hintKey="accountLinks.unlinkHint"
        confirmKey="accountLinks.unlinkConfirm"
        tone="danger"
        isPending={revoke.isPending}
        onCancel={() => {
          setAsking(null)
        }}
        onConfirm={() => {
          void revoke.run(asking.account).then((result) => {
            setAsking(null)
            if (!result.ok) setFailure(result.error)
          })
        }}
      >
        <p className="text-body font-semibold">{name}</p>
      </SmallDialog>
    )
  return {
    actions,
    dialog: (
      <>
        {dialog}
        {failure === null ? null : <FailureNotice error={failure} />}
      </>
    ),
  }
}

function PersonCard({ person, onClose }: { readonly person: Person; readonly onClose: () => void }) {
  const { actions, dialog } = useCardActions(person.soldier, onClose)
  const edit = useProfileEdit(person.soldier)
  const unit = person.unit.kind === 'unit' ? person.unit.unit.name : t(UNIT_STATE_KEYS[person.unit.kind])
  const detail = [...(person.rank === null ? [] : [person.rank.title]), unit].join(SEPARATOR)
  // The pencil sits beside "⋯"; while editing, ✕ and ✓ take both places (the handoff's edit mode, OI-401).
  const tools = edit.editing ? <EditControls edit={edit} /> : <EditControls edit={edit} after={<ActionMenu labelKey="common.actions" actions={actions} variant="circle" />} />
  return (
    <StopDrawer inUrl title={fullName(person.soldier)} detail={detail} onClose={onClose} tools={tools}>
      <Card person={person} edit={edit} />
      {dialog}
    </StopDrawer>
  )
}

function PersonOf({ id, onClose }: { readonly id: SoldierId; readonly onClose: () => void }) {
  const person = usePerson(id)
  if (person.status === 'ready' && person.value !== null) return <PersonCard person={person.value} onClose={onClose} />
  return <NotFound loading={person.status !== 'ready'} onClose={onClose} />
}

function NotFound({ loading, onClose }: { readonly loading: boolean; readonly onClose: () => void }) {
  return (
    <StopDrawer inUrl title={t('manage.person.title')} onClose={onClose}>
      {loading ? <LoadingNotice /> : <p className="text-body text-text-muted">{t('soldiers.notFound')}</p>}
    </StopDrawer>
  )
}

/** The soldiers' drawers of the new interface: the person card, and the soldiers' archive (D-482). */
export function PersonDrawer() {
  const panel = usePanel()
  if (panel.panel !== PANEL_IDS.soldiers || panel.entity === null || panel.entity === NEW_ENTITY) return null
  if (panel.entity === ARCHIVE_ENTITY) return <SoldierArchiveDrawer onClose={panel.close} />
  // Any other entity the address may hold (a round plan's) names no soldier (D-076).
  const id = SoldierId.safeParse(panel.entity)
  if (!id.success) return <NotFound loading={false} onClose={panel.close} />
  return <PersonOf key={id.data} id={id.data} onClose={panel.close} />
}
