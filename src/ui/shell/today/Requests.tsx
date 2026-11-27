import { PANEL_IDS } from '@config'
import type { AppError, Leave } from '@contracts'
import { t } from '@i18n'
import { useLeaveTransition, useLeaveTypes, usePanel, useSoldiersWithArchived } from '@logic'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { PersonRow } from '../../kit/PersonRow'
import { LeaveStepDialog } from '../../modules/leaves/LeaveStepDialog'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from '../../modules/leaves/leaveText'
import { FailureNotice } from '../../patterns/Notices'
import { RuleGateDialog } from '../../patterns/rules/RuleGate'
import { useRuleGate } from '../../patterns/rules/ruleAnswer'
import { useReportRequestDone } from './requestDoneContext'

// Requests that wait for the actor (D-459, D-120): each a row with ✓ and ✗, approved in place. The row itself opens
// the request. After a step the screen's toast says what happened (`RequestDoneScope`).

const SEPARATOR = ' · '
const WORD = ' '
const NO_ROWS: readonly never[] = []
const STEP = 'inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'

export function RequestRows({ leaves }: { readonly leaves: readonly Leave[] }) {
  const panel = usePanel()
  const soldiers = useSoldiersWithArchived()
  const types = useLeaveTypes()
  const transition = useLeaveTransition()
  const gate = useRuleGate()
  const [rejecting, setRejecting] = useState<Leave | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  const reportDone = useReportRequestDone()

  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : NO_ROWS)
  const typeList = types.status === 'ready' ? types.value : NO_ROWS
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null

  async function approve(leave: Leave) {
    setFailure(null)
    await gate.run(
      (acknowledged) => transition.run(leave, 'approve', '', acknowledged),
      (result) => {
        if (result.ok) reportDone({ leave: result.value, step: 'approve' })
        else setFailure(result.error)
      },
    )
  }

  return (
    <div className="flex flex-col gap-sm">
      {failure === null ? null : <FailureNotice error={failure} />}
      <ul className="flex flex-col">
        {leaves.map((leave) => {
          const name = nameOf(leave.soldier_id)
          return (
            <li key={leave.id}>
              <PersonRow
                name={name}
                detail={[typeNameOf(typeOf(leave)), leaveDatesText(leave), leaveDaysText(leave)].join(SEPARATOR)}
                onPress={() => {
                  panel.open(PANEL_IDS.leaves, { entity: leave.id })
                }}
                trailing={
                  <>
                    <AriaButton
                      aria-label={[t('leaves.reject'), name].join(WORD)}
                      onPress={() => {
                        setFailure(null)
                        setRejecting(leave)
                      }}
                      className={`${STEP} bg-status-rejected-bg text-status-rejected-text`}
                    >
                      <X aria-hidden size={20} />
                    </AriaButton>
                    <AriaButton
                      aria-label={[t('leaves.approve'), name].join(WORD)}
                      isDisabled={transition.isPending}
                      onPress={() => {
                        void approve(leave)
                      }}
                      className={`${STEP} bg-status-ok-bg text-status-ok-text`}
                    >
                      <Check aria-hidden size={20} />
                    </AriaButton>
                  </>
                }
              />
            </li>
          )
        })}
      </ul>
      <RuleGateDialog gate={gate} isPending={transition.isPending} />
      {rejecting === null ? null : (
        <LeaveStepDialog
          leave={rejecting}
          step="reject"
          onDone={(leave) => {
            reportDone({ leave, step: 'reject' })
          }}
          onClose={() => {
            setRejecting(null)
          }}
        />
      )}
    </div>
  )
}
