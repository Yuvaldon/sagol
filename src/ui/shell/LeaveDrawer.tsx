import { NEW_ENTITY, PANEL_IDS, ROUND_ENTITY } from '@config'
import { t } from '@i18n'
import { useLeave, useLeaveTypes, usePanel } from '@logic'
import { Suspense, lazy } from 'react'
import { StopDrawer } from '../kit/StopDrawer'
import { typeNameOf } from '../modules/leaves/leaveText'
import { LoadingNotice } from '../patterns/Notices'

// The `leaves` panel in the drawer of the new interface (D-454): "יציאה חדשה", and the leave card, which the drawer
// names by the leave's type. Both live in the URL, as every module panel does (D-092).

const LeavesModule = lazy(() => import('../modules/leaves/LeavesModule').then((module) => ({ default: module.LeavesModule })))

function Body() {
  return (
    <Suspense fallback={<LoadingNotice />}>
      <LeavesModule />
    </Suspense>
  )
}

/** The leave card: it opens at half height, with what the leave is and what can be done with it, and grows for its history. */
function LeaveCard({ id, onClose }: { readonly id: string; readonly onClose: () => void }) {
  const leave = useLeave(id)
  const types = useLeaveTypes()
  const type = leave.status === 'ready' && types.status === 'ready' ? (types.value.find((one) => one.id === leave.value.leave_type_id) ?? null) : null
  // Until the leave is read, and for one whose type the actor may not read, the drawer is "כרטיס יציאה".
  const title = leave.status === 'ready' && type !== null ? typeNameOf(type) : t('leaves.cardTitle')
  return (
    <StopDrawer inUrl title={title} onClose={onClose}>
      <Body />
    </StopDrawer>
  )
}

export function LeaveDrawer() {
  const panel = usePanel()
  if (panel.panel !== PANEL_IDS.leaves) return null
  if (panel.entity === ROUND_ENTITY) {
    return (
      <StopDrawer inUrl title={t('manage.round.title')} opensAt="full" onClose={panel.close}>
        <Body />
      </StopDrawer>
    )
  }
  if (panel.entity !== null && panel.entity !== NEW_ENTITY) return <LeaveCard key={panel.entity} id={panel.entity} onClose={panel.close} />
  return (
    <StopDrawer inUrl title={t('leaves.newTitle')} opensAt="full" onClose={panel.close}>
      <Body />
    </StopDrawer>
  )
}
