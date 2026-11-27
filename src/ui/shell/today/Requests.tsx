import { PANEL_IDS } from '@config'
import type { Leave } from '@contracts'
import { t } from '@i18n'
import { useLeaveTypes, usePanel, useSoldiersWithArchived } from '@logic'
import { Check, X } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { PersonRow } from '../../kit/PersonRow'
import { leaveDatesText, leaveDaysText, personNames, typeNameOf } from '../../modules/leaves/leaveText'
import { LoadingNotice } from '../../patterns/Notices'
import { REQUEST_ATTRIBUTE, useRequestActions } from './requestActions'

// Requests that wait for the actor (D-459, D-120): each a row with ✗ and ✓, answered in place. The row itself opens
// the request. A leave of the round has no ✗ here: its card decides between the move and the original dates (OI-394).
// The answer and everything it brings belong to the screen (`RequestsScope`).

const SEPARATOR = ' · '
const WORD = ' '
const NO_ROWS: readonly never[] = []
const STEP = 'inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:opacity-60 data-focus-visible:outline-2'
const STEP_ICON = 20

export function RequestRows({ leaves }: { readonly leaves: readonly Leave[] }) {
  const panel = usePanel()
  const soldiers = useSoldiersWithArchived()
  const types = useLeaveTypes()
  const actions = useRequestActions()

  // A name or a type that is still on its way is not written as an unknown one in the meantime.
  if (soldiers.status === 'loading' || types.status === 'loading') return <LoadingNotice />
  const nameOf = personNames(soldiers.status === 'ready' ? soldiers.value : NO_ROWS)
  const typeList = types.status === 'ready' ? types.value : NO_ROWS
  const typeOf = (leave: Leave) => typeList.find((type) => type.id === leave.leave_type_id) ?? null

  return (
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
                  {leave.batch_id !== null ? null : (
                  <AriaButton
                    aria-label={[t('leaves.reject'), name].join(WORD)}
                    onPress={() => {
                      actions.reject(leave)
                    }}
                    className={`${STEP} bg-status-rejected-bg text-status-rejected-text`}
                  >
                    <X aria-hidden size={STEP_ICON} />
                  </AriaButton>
                  )}
                  <AriaButton
                    {...{ [REQUEST_ATTRIBUTE]: leave.id }}
                    aria-label={[t('leaves.approve'), name].join(WORD)}
                    onPress={() => {
                      actions.approve(leave)
                    }}
                    className={`${STEP} bg-status-ok-bg text-status-ok-text`}
                  >
                    <Check aria-hidden size={STEP_ICON} />
                  </AriaButton>
                </>
              }
            />
          </li>
        )
      })}
    </ul>
  )
}
