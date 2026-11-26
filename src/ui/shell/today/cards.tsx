import { NEW_ENTITY, PANEL_IDS, TODAY } from '@config'
import { t } from '@i18n'
import {
  useLeaveTypes,
  useLinkReviewAccess,
  useMyLeaves,
  useMyLeavesAccess,
  usePanel,
  usePendingRequests,
  useQuickAction,
  useRotationScope,
  useShellPlace,
} from '@logic'
import { Badge } from '../../kit/Badge'
import { Card, CardDoor } from '../../kit/Card'
import { PersonRow } from '../../kit/PersonRow'
import { LeaveBadge } from '../../modules/leaves/LeaveMarks'
import { leaveDatesText, typeNameOf } from '../../modules/leaves/leaveText'
import { Button } from '../../primitives/Button'
import { useInboxAccess } from '../inboxAccess'
import { RequestRows } from './Requests'
import { Status } from './SoldierBlock'

// The cards of "היום" (D-459), in their fixed order. A card with nothing to show is absent; a card shows at most
// three rows and a door to the rest.

const NO_ROWS: readonly never[] = []

/**
 * Routine (D-257, D-296): with no rotation in scope, requests and Report 1 do not exist, and the page says so first.
 * Who may open a rotation does it from here.
 */
export function RoutineCard() {
  const scope = useRotationScope()
  const action = useQuickAction()
  const panel = usePanel()
  if (!scope.ready || !scope.none) return null
  return (
    <Card titleKey="workspace.routineTitle">
      <p className="text-small text-text-muted">{t(action === 'open_rotation' ? 'workspace.routineOpenBody' : 'workspace.noRotationBody')}</p>
      {action === 'open_rotation' ? (
        <div>
          <Button
            variant="primary"
            onPress={() => {
              panel.open(PANEL_IDS.deployments, { entity: NEW_ENTITY })
            }}
          >
            {t('workspace.openRotation')}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

/** "בקשות לאישור": what waits for the actor's approval, approved in place. Its title opens the page of all of them. */
export function ApprovalsCard() {
  const place = useShellPlace()
  const approves = useInboxAccess()
  const { requests } = useRotationScope()
  const pending = usePendingRequests()
  // A request surface exists only while a rotation a request can be about does (D-218).
  if (!approves || !requests || pending.status !== 'ready' || pending.value.length === 0) return null
  const open = () => {
    place.openPage('requests')
  }
  return (
    <Card
      titleKey="today.approvals"
      onOpen={open}
      aside={
        <Badge tone="pending">
          {pending.value.length}
          <span className="sr-only"> {t('inbox.pendingCount')}</span>
        </Badge>
      }
    >
      <RequestRows leaves={pending.value.slice(0, TODAY.cardRows)} />
      {pending.value.length > TODAY.cardRows ? <CardDoor labelKey="today.allRequests" onPress={open} /> : null}
    </Card>
  )
}

/** "בקשות הצטרפות": the identities that asked to link to a soldier, for who reviews them (D-150). */
export function JoinsCard() {
  const panel = usePanel()
  const { allowed, pending } = useLinkReviewAccess()
  if (!allowed || pending === 0) return null
  const open = () => {
    panel.open(PANEL_IDS.accountLinks)
  }
  return (
    <Card titleKey="accountLinks.title" onOpen={open} aside={<Badge tone="pending">{pending}</Badge>}>
      <p className="text-small text-text-muted">{t('today.joinsWaiting')}</p>
    </Card>
  )
}

/** "הבקשה שלי": the soldier's own open requests, each with its status. */
export function MyRequestCard() {
  const panel = usePanel()
  const mine = useMyLeavesAccess()
  const { requests } = useRotationScope()
  const leaves = useMyLeaves()
  const types = useLeaveTypes()
  if (!requests || mine?.view !== true || leaves.status !== 'ready' || leaves.value.open.length === 0) return null
  const typeList = types.status === 'ready' ? types.value : NO_ROWS
  const { open } = leaves.value
  return (
    <Card titleKey="today.myRequest">
      <ul className="flex flex-col">
        {open.slice(0, TODAY.cardRows).map((leave) => (
          <li key={leave.id}>
            <PersonRow
              name={typeNameOf(typeList.find((type) => type.id === leave.leave_type_id) ?? null)}
              detail={leaveDatesText(leave)}
              trailing={<LeaveBadge status={leave.status} />}
              onPress={() => {
                panel.open(PANEL_IDS.leaves, { entity: leave.id })
              }}
            />
          </li>
        ))}
      </ul>
      {open.length > TODAY.cardRows ? (
        <CardDoor
          labelKey="today.allMine"
          onPress={() => {
            panel.open(PANEL_IDS.myLeaves)
          }}
        />
      ) : null}
    </Card>
  )
}

/** "הסטטוס שלי": where the actor is and their days, for who has no open block of their own status (D-459). */
export function MyStatusCard() {
  return (
    <Card titleKey="today.myStatus">
      <Status selection={null} onSelect={null} size="title" />
    </Card>
  )
}
