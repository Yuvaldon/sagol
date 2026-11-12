import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import {
  useLeaveCreation,
  useLeaveTypeGroups,
  useLeaveTypePermissions,
  useLeaveTypes,
  useModuleAccess,
  useMyPreferences,
  usePanel,
  useSoldiers,
  useToday,
} from '@logic'
import { Tags, User, Users } from 'lucide-react'
import { useState } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { LeaveBatchForm } from './LeaveBatchForm'
import { LeaveDetails } from './LeaveDetails'
import { LeaveSheetForm } from './LeaveSheetForm'

/** What the panel shows before the form: what is missing, and the way to it when the actor may take it. */
function NewLeave() {
  const panel = usePanel()
  const access = useModuleAccess()
  const typePermissions = useLeaveTypePermissions()
  const today = useToday()
  const soldiers = useSoldiers()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const preferences = useMyPreferences()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  const [collective, setCollective] = useState(false)

  for (const loaded of [soldiers, types, groups, preferences]) {
    if (loaded.status === 'failed') return <FailureNotice error={loaded.error} />
  }
  if (soldiers.status !== 'ready' || types.status !== 'ready' || groups.status !== 'ready' || preferences.status !== 'ready' || today === null) {
    return <LoadingNotice />
  }

  const liveTypes = types.value.filter((type) => type.archived_at === null)
  if (liveTypes.length === 0) {
    return (
      <EmptyNotice titleKey="leaves.noTypesTitle" bodyKey={typePermissions.create ? 'leaves.noTypesBody' : 'leaves.noTypesReadOnly'}>
        {typePermissions.create && access.leaveTypes ? (
          <Button
            variant="primary"
            onPress={() => {
              panel.open(PANEL_IDS.leaveTypes, { entity: NEW_ENTITY })
            }}
          >
            <Tags aria-hidden size={14} />
            {t('leaves.openTypes')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }
  if (!creation.any) return <EmptyNotice titleKey="leaves.noSoldiersTitle" bodyKey="leaves.noSoldiersBody" />
  // A draft counts only for a soldier the form offers, who the actor may ask for (a link may name anyone).
  const draft =
    panel.draft === null
      ? null
      : creation.soldiers.some((soldier) => soldier.id === panel.draft?.soldier_id)
        ? panel.draft
        : null

  const shared = {
    soldiers: creation.soldiers,
    canApprove: creation.canApprove,
    groups: groups.value,
    types: liveTypes,
    today,
    approveNow: preferences.value.create_leaves_as_approved,
  }
  // A collective leave needs more than one soldier to choose from (D-179).
  const switcher =
    creation.soldiers.length > 1 ? (
      <div>
        <Button
          onPress={() => {
            setCollective((current) => !current)
          }}
        >
          {collective ? <User aria-hidden size={14} /> : <Users aria-hidden size={14} />}
          {t(collective ? 'leaves.single' : 'leaves.collective')}
        </Button>
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-md">
      {switcher}
      {collective && creation.soldiers.length > 1 ? (
        <LeaveBatchForm {...shared} />
      ) : (
        <LeaveSheetForm
          // A new drag starts the form over from its own draft.
          key={draft === null ? 'blank' : `${draft.soldier_id}:${draft.start_date}:${draft.end_date}`}
          draft={draft}
          {...shared}
        />
      )}
    </div>
  )
}

const NO_SOLDIERS: readonly never[] = []

/** The `leaves` panel: the new-leave form, or the details of the leave `entity` names (D-115, D-119). */
export function LeavesModule() {
  const panel = usePanel()
  if (panel.entity !== null && panel.entity !== NEW_ENTITY) return <LeaveDetails key={panel.entity} id={panel.entity} />
  return <NewLeave />
}
