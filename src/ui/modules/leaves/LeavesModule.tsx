import { NEW_ENTITY } from '@config'
import { t } from '@i18n'
import {
  useLeaveCreation,
  useLeaveRoundSetup,
  useLeaveTypeGroups,
  useLeaveTypes,
  useMyPreferences,
  usePanel,
  useSoldiers,
  useToday,
} from '@logic'
import { CalendarSync, User, Users, type LucideIcon } from 'lucide-react'
import type { I18nKey } from '@i18n'
import { useState } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { LeaveBatchForm } from './LeaveBatchForm'
import { LeaveDetails } from './LeaveDetails'
import { LeaveRoundPlanner } from './LeaveRoundPlanner'
import { LeaveSheetForm } from './LeaveSheetForm'

/** What the panel shows before the form: what is missing, and the way to it when the actor may take it. */
function NewLeave() {
  const panel = usePanel()
  const today = useToday()
  const soldiers = useSoldiers()
  const types = useLeaveTypes()
  const groups = useLeaveTypeGroups()
  const preferences = useMyPreferences()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  const rounds = useLeaveRoundSetup()
  const [mode, setMode] = useState<LeaveMode>('single')

  for (const loaded of [soldiers, types, groups, preferences]) {
    if (loaded.status === 'failed') return <FailureNotice error={loaded.error} />
  }
  if (soldiers.status !== 'ready' || types.status !== 'ready' || groups.status !== 'ready' || preferences.status !== 'ready' || today === null) {
    return <LoadingNotice />
  }

  const liveTypes = types.value.filter((type) => type.archived_at === null)
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
  // A collective leave needs more than one soldier to choose from (D-179), and a round plan an open rotation too (D-316).
  const many = creation.soldiers.length > 1
  const planIn = many && rounds.context !== null && rounds.preferred !== null ? { context: rounds.context, preferred: rounds.preferred } : null
  const offered = LEAVE_MODES.filter((candidate) => candidate === 'single' || (candidate === 'collective' ? many : planIn !== null))
  const current = offered.includes(mode) ? mode : 'single'
  const switcher =
    offered.length > 1 ? (
      <div className="flex flex-wrap gap-sm">
        {offered
          .filter((candidate) => candidate !== current)
          .map((candidate) => {
            const { icon: Icon, labelKey } = MODE_BUTTONS[candidate]
            return (
              <Button
                key={candidate}
                onPress={() => {
                  setMode(candidate)
                }}
              >
                <Icon aria-hidden size={14} />
                {t(labelKey)}
              </Button>
            )
          })}
      </div>
    ) : null

  return (
    <div className="flex flex-col gap-md">
      {switcher}
      {current === 'collective' ? (
        <LeaveBatchForm {...shared} />
      ) : current === 'rounds' && planIn !== null ? (
        <LeaveRoundPlanner {...shared} {...planIn} />
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

/** The ways to ask for leave: one soldier, several on the same days, or groups taking turns in a rotation. */
const LEAVE_MODES = ['single', 'collective', 'rounds'] as const
type LeaveMode = (typeof LEAVE_MODES)[number]

const MODE_BUTTONS: Record<LeaveMode, { readonly icon: LucideIcon; readonly labelKey: I18nKey }> = {
  single: { icon: User, labelKey: 'leaves.single' },
  collective: { icon: Users, labelKey: 'leaves.collective' },
  rounds: { icon: CalendarSync, labelKey: 'leaves.rounds' },
}

/** The `leaves` panel: the new-leave form, or the details of the leave `entity` names (D-115, D-119). */
export function LeavesModule() {
  const panel = usePanel()
  if (panel.entity !== null && panel.entity !== NEW_ENTITY) return <LeaveDetails key={panel.entity} id={panel.entity} />
  return <NewLeave />
}
