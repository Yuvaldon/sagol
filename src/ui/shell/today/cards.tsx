import { NEW_ENTITY, PANEL_IDS, ROUND_ENTITY, TODAY } from '@config'
import { t } from '@i18n'
import {
  fullName,
  joinGroups,
  useJoinApproval,
  useLeaveTypes,
  useLinkAssessments,
  useLinkReviewAccess,
  useModuleAccess,
  useMyLeaves,
  useMyLeavesAccess,
  usePanel,
  usePendingLinkRequests,
  usePendingRequests,
  usePresenceDay,
  usePresentWithMe,
  useQuickAction,
  useRotationScope,
  useRoundPlanning,
  useShellPlace,
  useToday,
} from '@logic'
import { Badge } from '../../kit/Badge'
import { Card, CardDoor } from '../../kit/Card'
import { PersonRow } from '../../kit/PersonRow'
import { LeaveBadge } from '../../modules/leaves/LeaveMarks'
import { leaveDatesText, typeNameOf } from '../../modules/leaves/leaveText'
import { formatDate } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { useOpener } from '../chrome'
import { joinOutcome } from '../manage/joinOutcome'
import { useNotices } from '../notices'
import { REQUESTS_OPENER } from './requestActions'
import { ReportButton } from './ReportButton'
import { RequestRows } from './Requests'
import { Status } from './SoldierBlock'

// The cards of "היום" (D-459), in their fixed order. A card with nothing to show is absent; a card shows at most
// three rows and a door to the rest.

const SEPARATOR = ' · '
const WORD = ' '
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
  const pending = usePendingRequests()
  const opener = useOpener(REQUESTS_OPENER)
  if (pending.status !== 'ready' || pending.value.length === 0) return null
  const open = () => {
    opener.remember()
    place.openPage('requests')
  }
  return (
    <Card
      titleKey="today.approvals"
      onOpen={open}
      openRef={opener.ref}
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

/**
 * "בקשות הצטרפות" (the handoff's card bank, D-482): how many are ready and how many wait for review, up to three of them,
 * and "אישור N" for the ready ones. The title opens the page; a row opens its "זה הוא?".
 */
export function JoinsCard() {
  const place = useShellPlace()
  const panel = usePanel()
  const notices = useNotices()
  const { allowed, pending } = useLinkReviewAccess()
  const requests = usePendingLinkRequests()
  const shown = requests.status === 'ready' ? requests.value : NO_ROWS
  const assessments = useLinkAssessments(shown)
  const approval = useJoinApproval()
  const today = useToday()
  if (!allowed || pending === 0) return null
  const groups = assessments.status === 'ready' ? joinGroups(shown, assessments.value) : null
  const ready = groups?.ready ?? []
  const review = (groups?.review.length ?? 0) + (groups?.newSoldiers.length ?? 0)
  return (
    <Card
      titleKey="accountLinks.title"
      onOpen={() => {
        place.openPage('joins')
      }}
      aside={
        <Badge tone="pending">
          {pending}
          <span className="sr-only"> {t('accountLinks.pendingCount')}</span>
        </Badge>
      }
    >
      {groups === null ? null : (
        <p className="text-small text-text-muted tabular-nums">
          {[[String(ready.length), t('today.joinsReady')].join(WORD), [String(review), t('today.joinsReview')].join(WORD)].join(SEPARATOR)}
        </p>
      )}
      <ul className="flex flex-col">
        {shown.slice(0, TODAY.cardRows).map((request) => (
          <li key={request.id}>
            <PersonRow
              name={fullName(request)}
              detail={request.claimed_personal_id ?? undefined}
              onPress={() => {
                panel.open(PANEL_IDS.accountLinks, { entity: request.id })
              }}
            />
          </li>
        ))}
      </ul>
      {ready.length === 0 || today === null ? null : (
        <div>
          <Button
            variant="primary"
            isDisabled={approval.isPending}
            onPress={() => {
              void approval.run({ ready: ready.map((entry) => entry.request), placed: [], today }).then((result) => {
                if (!result.ok) {
                  notices.fail(result.error)
                  return
                }
                const { done, refusal } = joinOutcome(result.value)
                notices.report(done, refusal)
              })
            }}
          >
            {[t('manage.joins.approve'), String(ready.length)].join(WORD)}
          </Button>
        </div>
      )}
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

/**
 * "דוח 1" (D-459, D-472): today's report, for who reads the unit's soldiers while a rotation runs (D-222) and has no
 * unit block of their own to open it from.
 */
export function ReportCard() {
  const { rotation } = useRotationScope()
  const access = useModuleAccess()
  const { today } = usePresenceDay()
  if (rotation === null || !access.soldiers) return null
  return (
    <Card titleKey="presence.title">
      <div className="flex items-center justify-between gap-md">
        <p className="min-w-none text-small text-text-muted tabular-nums">{today === null ? rotation.name : [rotation.name, formatDate(today, 'dayMonth')].join(SEPARATOR)}</p>
        <ReportButton labelKey="today.openReport" />
      </div>
    </Card>
  )
}

/**
 * "איתך היום" (D-478, D-479): who of the actor's own unit is on base today, by name only, for who has no board. The
 * server answers the names; the card opens nothing, as its holder reads no leave (rule 6). Absent when nobody is.
 */
export function WithMeCard({ board }: { readonly board: boolean }) {
  const present = usePresentWithMe()
  // Who has "לוח" sees the same in the unit's block (D-466); a failed read shows nothing, as an empty one does.
  if (board || present.status !== 'ready' || present.value === null || present.value.length === 0) return null
  return (
    <Card
      titleKey="today.withMe"
      aside={
        <span className="text-title font-bold tabular-nums">
          {present.value.length}
          <span className="sr-only"> {t('today.withMeCount')}</span>
        </span>
      }
    >
      <ul className="flex flex-wrap gap-sm">
        {present.value.map((soldier) => (
          <li key={soldier.id} className="rounded-full bg-inner px-cozy py-xs text-small">
            {fullName(soldier)}
          </li>
        ))}
      </ul>
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

/**
 * "סבב יציאות · תכנון" (D-459, OI-389, D-482): for who plans the leave round, while soldiers of the rotation have no
 * round yet, how many; it opens the planner. Absent once every one has, as an empty card is (D-459).
 */
export function RoundCard() {
  const panel = usePanel()
  const planning = useRoundPlanning()
  if (planning === null || planning.unplanned === null || planning.unplanned === 0) return null
  return (
    <Card
      titleKey="manage.round.card"
      onOpen={() => {
        panel.open(PANEL_IDS.leaves, { entity: ROUND_ENTITY })
      }}
      aside={
        <span className="text-title font-bold tabular-nums">
          {planning.unplanned}
          <span className="sr-only"> {t('manage.round.unplanned')}</span>
        </span>
      }
    >
      <p className="text-small text-text-muted">{[planning.rotation.name, t('manage.round.cardBody')].join(SEPARATOR)}</p>
    </Card>
  )
}
