import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import { usePanel, useSession, useShellPlace, type DaySelection } from '@logic'
import { useState } from 'react'
import { Tray } from '../../kit/Tray'
import { leaveDaysText } from '../../modules/leaves/leaveText'
import { EmptyNotice } from '../../patterns/Notices'
import { useNoBoard } from '../boardShown'
import { PageFrame } from '../PageFrame'
import { ApprovalsCard, JoinsCard, MyRequestCard, MyStatusCard, RoutineCard } from './cards'
import { RequestDoneScope } from './RequestDoneScope'
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
}

/** A soldier who may not view the organization and reads no soldier at all has nothing here yet (D-151, D-160). */
function NoAccess({ name }: { readonly name: string }) {
  return (
    <PageFrame>
      <h1 className="sr-only">{name}</h1>
      <EmptyNotice titleKey="timeline.noDayTitle" bodyKey="timeline.noDayBody" headingLevel={2} />
    </PageFrame>
  )
}

function Today({ name, commands, requests }: TodayPageProps) {
  const panel = usePanel()
  const session = useSession()
  const own = session.status === 'ready' && session.value.status === 'linked' ? session.value.soldier_id : null
  const [selection, setSelection] = useState<DaySelection | null>(null)
  const hasStatus = useStanding() !== null
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
      <h1 className="sr-only">{name}</h1>
      {commands ? <UnitBlock name={name} /> : <SoldierBlock selection={selection} onSelect={select} />}
      <RoutineCard />
      <ApprovalsCard />
      <JoinsCard />
      <MyRequestCard />
      {commands && hasStatus ? <MyStatusCard /> : null}
    </PageFrame>
  )
}

export function TodayPage(props: TodayPageProps) {
  const place = useShellPlace()
  const noAccess = useNoBoard()
  if (noAccess) return <NoAccess name={props.name} />
  return <RequestDoneScope>{place.page === 'requests' ? <RequestsPage /> : <Today {...props} />}</RequestDoneScope>
}
