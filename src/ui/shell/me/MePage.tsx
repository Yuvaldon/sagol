import { PANEL_IDS, TODAY } from '@config'
import type { AuthIdentity, Leave, SoldierId } from '@contracts'
import { t } from '@i18n'
import { fullName, useLeaveTypes, useMyLeaves, useMyLeavesAccess, usePanel, useMyDays, usePerson, useSession, useShellPlace, useToday, type Person } from '@logic'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Card, CardDoor } from '../../kit/Card'
import { DayStrip } from '../../kit/DayStrip'
import { PersonRow } from '../../kit/PersonRow'
import { LeaveBadge } from '../../modules/leaves/LeaveMarks'
import { leaveDatesText, typeNameOf } from '../../modules/leaves/leaveText'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { UNIT_STATE_KEYS } from '../../patterns/units'
import { IconButton } from '../../primitives/Button'
import { PageFrame, PageHead, PageHeading } from '../PageFrame'
import { EditControls, ProfileBody } from '../person/Profile'
import { useProfileEdit } from '../person/useProfileEdit'
import { standingOf } from '../today/standing'
import { MyRequestsPage } from './MyRequestsPage'
import { PreferencesPage } from './PreferencesPage'
import { RotationPage } from './RotationPage'

// "אני" (the handoff's Me, D-488): personal things over time, one screen for everyone. Its open block is the profile,
// the soldier's own person card (D-489); then two fixed cards, "הסבב שלי" and "הבקשות שלי", in that order, and the
// row "העדפות", where the account is. Nothing here asks for action now: "היום" does.

const SEPARATOR = ' · '
const NO_TYPES: readonly never[] = []
const NO_LEAVES: readonly Leave[] = []

/** The profile: the name at 28, the command rank and the unit, the pencil and the chevron, then the card's body. */
function Profile({ person }: { readonly person: Person }) {
  const edit = useProfileEdit(person.soldier)
  const [expanded, setExpanded] = useState(false)
  const unit = person.unit.kind === 'unit' ? person.unit.unit.name : t(UNIT_STATE_KEYS[person.unit.kind])
  const line = [...(person.rank === null ? [] : [person.rank.title]), unit].join(SEPARATOR)
  return (
    <section aria-labelledby="me-name" className="flex flex-col gap-md">
      <PageHead>
        <PageHeading className="truncate text-title font-bold tracking-tight">
          <span id="me-name">{fullName(person.soldier)}</span>
        </PageHeading>
      </PageHead>
      <div className="flex items-center justify-between gap-sm">
        <p className="min-w-none truncate text-body text-text-muted">{line}</p>
        <EditControls
          edit={edit}
          after={
            <IconButton
              labelKey={expanded ? 'profile.collapse' : 'profile.expand'}
              onPress={() => {
                setExpanded(!expanded)
              }}
            >
              <ChevronDown aria-hidden size={20} className={`transition-transform duration-ui ease-standard motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
            </IconButton>
          }
        />
      </div>
      <ProfileBody edit={edit} tags={person.tags} expanded={expanded} />
    </section>
  )
}

/** "הסבב שלי": where the soldier is, what comes next, and the 14 days; it opens the page (D-488). */
function RotationCard() {
  const place = useShellPlace()
  const mine = useMyLeavesAccess()
  const today = useToday()
  const days = useMyDays(today, TODAY.stripDays)
  const types = useLeaveTypes()
  // A card for who has days of their own; a read that fails or waits says so, and the title stays the door (D-490).
  if (days === null || mine?.view !== true) return null
  const standing = today !== null && days.status === 'ready' ? standingOf(today, days.value, types.status === 'ready' ? types.value : NO_TYPES) : null
  return (
    <Card
      titleKey="me.myRotation"
      onOpen={() => {
        place.openPage('rotation')
      }}
    >
      {days.status === 'failed' ? (
        <FailureNotice error={days.error} />
      ) : standing === null ? (
        <LoadingNotice />
      ) : (
        <>
          <p className="text-body font-semibold tabular-nums">{[standing.place, standing.next].join(SEPARATOR)}</p>
          <DayStrip days={standing.days} today={standing.today} labelKey="myLeaves.nextDaysTitle" />
        </>
      )}
    </Card>
  )
}

/** "הבקשות שלי": the open and coming requests, three of them, and the door to all (D-488, OI-391). */
function RequestsCard() {
  const place = useShellPlace()
  const panel = usePanel()
  const mine = useMyLeavesAccess()
  const leaves = useMyLeaves()
  const types = useLeaveTypes()
  if (mine?.view !== true) return null
  const typeList = types.status === 'ready' ? types.value : NO_TYPES
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null
  const open = leaves.status === 'ready' ? leaves.value.open : NO_LEAVES
  // A read that fails or waits says so; the door to all stays (D-490).
  return (
    <Card titleKey="me.myRequests">
      {leaves.status === 'failed' ? (
        <FailureNotice error={leaves.error} />
      ) : leaves.status === 'loading' ? (
        <LoadingNotice />
      ) : open.length === 0 ? (
        <p className="text-body text-text-muted">{t('me.noOpenRequests')}</p>
      ) : (
        <ul className="flex flex-col">
          {open.slice(0, TODAY.cardRows).map((leave) => (
            <li key={leave.id}>
              <PersonRow
                name={typeNameOf(typeOf(leave))}
                detail={leaveDatesText(leave)}
                trailing={<LeaveBadge status={leave.status} />}
                onPress={() => {
                  panel.open(PANEL_IDS.leaves, { entity: leave.id })
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <CardDoor
        labelKey="me.allRequests"
        onPress={() => {
          place.openPage('my_requests')
        }}
      />
    </Card>
  )
}

/** A thin row to a page: "העדפות", and the personal capabilities to come under it (`02`, Me). */
function PageRow({ onPress }: { readonly onPress: () => void }) {
  return (
    <AriaButton
      onPress={onPress}
      className="flex min-h-touch w-full cursor-pointer items-center justify-between gap-sm border-y border-divider-strong px-xs py-md text-start text-body font-bold outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner"
    >
      {t('me.preferences')}
      <ChevronLeft aria-hidden size={18} className="shrink-0 text-text-muted" />
    </AriaButton>
  )
}

/** The name the account carries, for a soldier whose own record is not read. */
function AccountHead({ identity }: { readonly identity: AuthIdentity }) {
  const named = identity.display_name !== null && identity.display_name !== ''
  return (
    <PageHead>
      <PageHeading className="truncate text-title font-bold tracking-tight">{named ? identity.display_name : t('shell.tabMe')}</PageHeading>
    </PageHead>
  )
}

function OwnProfile({ soldierId, identity }: { readonly soldierId: SoldierId; readonly identity: AuthIdentity }) {
  const person = usePerson(soldierId)
  // A soldier who may not read their own record still has their account here (D-076).
  if (person.status !== 'ready' || person.value === null) return <AccountHead identity={identity} />
  return <Profile person={person.value} />
}

function Index({ identity }: { readonly identity: AuthIdentity }) {
  const place = useShellPlace()
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  return (
    <PageFrame updates>
      {own === null ? <AccountHead identity={identity} /> : <OwnProfile soldierId={own} identity={identity} />}
      <RotationCard />
      <RequestsCard />
      <PageRow
        onPress={() => {
          place.openPage('preferences')
        }}
      />
    </PageFrame>
  )
}

export interface MePageProps {
  readonly identity: AuthIdentity
  /** Whether the soldier may request a leave for themself now: days chosen on "הסבב שלי" become one. */
  readonly requests: boolean
}

export function MePage({ identity, requests }: MePageProps) {
  const place = useShellPlace()
  const mine = useMyLeavesAccess()
  const { page, closePage } = place
  // "הסבב שלי" and "כל הבקשות" are for who has days and requests of their own; an address that names one for anyone
  // else is put right, as the other pages are (D-076).
  // Only once the answer is in: a reload on a page never closes it while its access is still asked (D-487).
  const stray = (page === 'rotation' || page === 'my_requests') && mine !== null && mine.known && !mine.view
  useEffect(() => {
    if (stray) closePage()
  }, [stray, closePage])
  if (page === 'preferences') return <PreferencesPage identity={identity} />
  if (page === 'my_requests' && !stray) return <MyRequestsPage />
  if (page === 'rotation' && !stray) return <RotationPage requests={requests} />
  return <Index identity={identity} />
}
