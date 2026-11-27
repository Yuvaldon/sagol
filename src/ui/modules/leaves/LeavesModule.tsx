import { NEW_ENTITY, ROUND_ENTITY } from '@config'
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
import { User, Users, type LucideIcon } from 'lucide-react'
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
  // A draft counts only for a soldier the form offers, who the actor may ask for (a link may name anyone); days picked
  // on the calendar name no soldier, and the form asks for one (D-480).
  const draft =
    panel.draft === null
      ? null
      : panel.draft.soldier_id === undefined || creation.soldiers.some((soldier) => soldier.id === panel.draft?.soldier_id)
        ? panel.draft
        : null

  // Soldiers chosen together on "חיילים" open one collective leave for them (D-482).
  const together =
    panel.draft?.soldier_ids !== undefined && panel.draft.soldier_ids.every((id) => creation.soldiers.some((soldier) => soldier.id === id))
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
  // The plan has its own entry, a row of "ניהול" and a card of "היום" (OI-389, D-482).
  const many = creation.soldiers.length > 1
  const planIn = many && rounds.context !== null && rounds.preferred !== null ? { context: rounds.context, preferred: rounds.preferred } : null
  if (panel.entity === ROUND_ENTITY) {
    return planIn === null ? <EmptyNotice titleKey="leaves.noRoundTitle" bodyKey="leaves.noRoundBody" /> : <LeaveRoundPlanner {...shared} {...planIn} />
  }
  const offered = LEAVE_MODES.filter((candidate) => candidate === 'single' || many)
  const current = together !== null && many ? 'collective' : offered.includes(mode) ? mode : 'single'
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
        <LeaveBatchForm {...shared} chosen={together?.soldier_ids ?? []} />
      ) : (
        <LeaveSheetForm
          // A new drag starts the form over from its own draft.
          key={draft === null ? 'blank' : `${draft.soldier_id ?? ''}:${draft.start_date}:${draft.end_date}`}
          draft={draft}
          {...shared}
        />
      )}
    </div>
  )
}

const NO_SOLDIERS: readonly never[] = []

/** The ways to ask for leave: one soldier, or several on the same days. Groups taking turns are planned apart (D-482). */
const LEAVE_MODES = ['single', 'collective'] as const
type LeaveMode = (typeof LEAVE_MODES)[number]

const MODE_BUTTONS: Record<LeaveMode, { readonly icon: LucideIcon; readonly labelKey: I18nKey }> = {
  single: { icon: User, labelKey: 'leaves.single' },
  collective: { icon: Users, labelKey: 'leaves.collective' },
}

/** The `leaves` panel: the new-leave form, the leave-round planner, or the details of the leave `entity` names (D-115, D-119). */
export function LeavesModule() {
  const panel = usePanel()
  if (panel.entity !== null && panel.entity !== NEW_ENTITY && panel.entity !== ROUND_ENTITY) return <LeaveDetails key={panel.entity} id={panel.entity} />
  return <NewLeave />
}
