import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import { usePanel, usePresentWithMe, useSession, useShellPlace, type DaySelection } from '@logic'
import { useEffect, useState } from 'react'
import { Tray } from '../../kit/Tray'
import { leaveDaysText } from '../../modules/leaves/leaveText'
import { EmptyNotice } from '../../patterns/Notices'
import { useNoBoard } from '../boardShown'
import { useOpenerFallback } from '../chrome'
import { PageFrame, PageHeading } from '../PageFrame'
import { ApprovalsCard, JoinsCard, MyRequestCard, MyStatusCard, ReportCard, RoutineCard, WithMeCard } from './cards'
import { REQUESTS_OPENER } from './requestActions'
import { RequestsScope } from './RequestsScope'
import { RequestsPage } from './RequestsPage'
import { SoldierBlock } from './SoldierBlock'
import { useStanding } from './standing'
import { UnitBlock } from './UnitBlock'

// "היום" (D-454, D-459): one open block by what the actor may read, then the cards in their fixed order. Who reads the
// leaves of others opens on their unit; anyone else opens on their own status. No role's name is read (D-455).

const SEPARATOR = ' · '

export interface TodayPageProps {
  /** The organization's name, for a block that names no single unit. */
  readonly name: string
  /** Whether the actor has "לוח": the open block is the unit's. */
  readonly commands: boolean
  /** Whether the actor may request a leave for themself now. */
  readonly requests: boolean
  /** Whether requests wait for the actor's approval here: the card, and the page behind it (D-467). */
  readonly approvals: boolean
}

/** A soldier who may not view the organization and reads no soldier at all has nothing here yet (D-151, D-160). */
function NoAccess({ name }: { readonly name: string }) {
  return (
    <PageFrame>
      <PageHeading className="sr-only">{name}</PageHeading>
      <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
    </PageFrame>
  )
}

function Today({ name, commands, requests, approvals }: TodayPageProps) {
  const panel = usePanel()
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const [selection, setSelection] = useState<DaySelection | null>(null)
  const hasStatus = useStanding() !== null
  useOpenerFallback(REQUESTS_OPENER)
  const tray =
    selection === null || own === null ? null : (
      <Tray
        labelKey="today.selection"
        action={[t('today.requestDays'), leaveDaysText({ start_date: selection.start, end_date: selection.end })].join(SEPARATOR)}
        onAction={() => {
          panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY, draft: { soldier_id: own, start_date: selection.start, end_date: selection.end } })
          setSelection(null)
        }}
        clearKey="today.clearSelection"
        onClear={() => {
          setSelection(null)
        }}
      />
    )
  const select = requests && own !== null ? setSelection : null
  return (
    <PageFrame updates tray={tray}>
      {/* The page's heading, for readers, is the organization's name, as on the board (D-175). */}
      <PageHeading className="sr-only">{name}</PageHeading>
      {commands ? <UnitBlock name={name} /> : <SoldierBlock selection={selection} onSelect={select} />}
      <RoutineCard />
      {approvals ? <ApprovalsCard /> : null}
      <JoinsCard />
      <MyRequestCard />
      {commands ? null : <ReportCard />}
      <WithMeCard board={commands} />
      {commands && hasStatus ? <MyStatusCard /> : null}
    </PageFrame>
  )
}

export function TodayPage(props: TodayPageProps) {
  const place = useShellPlace()
  const noBoard = useNoBoard()
  const present = usePresentWithMe()
  // Who reads nothing else but is told who is on base with them has a page (D-479).
  const noAccess = noBoard && !(present.status === 'ready' && present.value !== null)
  // The page of requests is for who the card is for; an address that names it for anyone else is put right (D-076).
  const stray = place.page === 'requests' && !props.approvals
  const { closePage } = place
  useEffect(() => {
    if (stray) closePage()
  }, [stray, closePage])
  if (noAccess) return <NoAccess name={props.name} />
  return <RequestsScope>{place.page === 'requests' && props.approvals ? <RequestsPage /> : <Today {...props} />}</RequestsScope>
}
