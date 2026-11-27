import type { CalendarDate, SoldierId, UnitId } from '@contracts'
import { t } from '@i18n'
import { useMemberships, useMovePermissions, useMoveSoldiers, useSoldiers, useToday, useUnits } from '@logic'
import { useState } from 'react'
import { unitOptions } from '../../modules/soldiers/unitOptions'
import { SmallDialog } from '../../patterns/Dialogs'
import { DateField } from '../../primitives/DateField'
import { SelectField } from '../../primitives/SelectField'
import { useNotices } from '../notices'

// "העברה" of the chosen soldiers (D-482): one unit and one day for all of them, each moved on its own. The toast says how
// many moved; a refusal is said for the first soldier it stopped, and the others still move.

const WORD = ' '
const NO_ROWS: readonly never[] = []

export function MoveDialog({ soldierIds, onClose }: { readonly soldierIds: readonly SoldierId[]; readonly onClose: (done: boolean) => void }) {
  const today = useToday()
  const units = useUnits()
  const soldiers = useSoldiers()
  const memberships = useMemberships()
  const liveUnits = units.status === 'ready' ? units.value : NO_ROWS
  const permissions = useMovePermissions(soldiers.status === 'ready' ? soldiers.value : NO_ROWS, liveUnits)
  const options = unitOptions(liveUnits, permissions.moveTo)
  const move = useMoveSoldiers()
  const notices = useNotices()
  const [unitId, setUnitId] = useState<UnitId | null>(options[0]?.value ?? null)
  const [date, setDate] = useState<CalendarDate | ''>(today ?? '')
  const missing = unitId === null || date === ''

  const submit = async () => {
    if (unitId === null || date === '' || memberships.status !== 'ready') return
    const result = await move.run({ soldierIds, memberships: memberships.value, values: { unit_id: unitId, effective_date: date } })
    onClose(true)
    if (!result.ok) {
      notices.fail(result.error)
      return
    }
    const answers = [...result.value.values()]
    const refusal = answers.find((answer) => !answer.ok)
    if (refusal !== undefined && !refusal.ok) notices.fail(refusal.error)
    else notices.say([String(answers.length), t('manage.move.done')].join(WORD))
  }

  return (
    <SmallDialog
      titleKey="manage.move.title"
      hintKey="manage.move.hint"
      confirmKey="manage.move.submit"
      isPending={move.isPending || missing}
      onCancel={() => {
        onClose(false)
      }}
      onConfirm={() => {
        void submit()
      }}
    >
      <SelectField labelKey="soldiers.unit" name="unit_id" value={unitId} options={options} onChange={setUnitId} error={null} />
      <DateField labelKey="soldiers.moveDate" name="effective_date" value={date} onChange={setDate} error={date === '' ? 'issues.required' : null} />
    </SmallDialog>
  )
}
