import { PANEL_IDS } from '@config'
import type { AppError, CalendarDate, Issue, SoldierCsvColumn, Unit, UnitId } from '@contracts'
import { SOLDIER_CSV_COLUMNS } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  blankQuickEntryRow,
  isBlankQuickEntryRow,
  quickEntryIssues,
  quickEntryRowsFromPaste,
  readyQuickEntryRows,
  usePanel,
  useQuickEntrySave,
  type QuickEntryPlacement,
  type QuickEntryRow,
} from '@logic'
import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { failureKey } from '../../errors/messages'
import { formStateOf, issueError } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'
import { SelectField } from '../../primitives/SelectField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { unitOptions } from './unitOptions'

// The quick entry (D-282): new soldiers as rows with the CSV's columns, all placed in one unit from today. A pasted
// block of a spreadsheet fills rows; each row is saved on its own, one after another. A saved row leaves the grid, and a
// refused row stays with its reason.

/** Between the words of a line built from several strings. */
const WORD = ' '

const COLUMN_KEYS: Readonly<Record<SoldierCsvColumn, I18nKey>> = {
  first_name: 'soldiers.firstName',
  last_name: 'soldiers.lastName',
  nickname: 'soldiers.nickname',
  personal_id: 'soldiers.personalId',
  phone: 'soldiers.phone',
  invite_email: 'soldiers.inviteEmail',
}

/** Where a column's issue lands: the `create_soldier` form's field. */
const FIELD_OF: Readonly<Record<SoldierCsvColumn, string>> = {
  first_name: 'first_name',
  last_name: 'last_name',
  nickname: 'nickname',
  personal_id: 'private.personal_id',
  phone: 'private.phone',
  invite_email: 'private.invite_email',
}

const FIELDS: readonly string[] = Object.values(FIELD_OF)

const LTR_COLUMNS: ReadonlySet<SoldierCsvColumn> = new Set(['personal_id', 'phone', 'invite_email'])

const PASTE_KEYS = { unreadable: 'soldiers.quick.pasteUnreadable', row_length: 'soldiers.quick.pasteRowLength' } as const

/** One blank row stays at the end, so there is always a row to type into. */
function withTrailingBlank(rows: readonly QuickEntryRow[]): readonly QuickEntryRow[] {
  const last = rows.at(-1)
  return last === undefined || !isBlankQuickEntryRow(last) ? [...rows, blankQuickEntryRow()] : rows
}

function RowFields({
  row,
  position,
  issues,
  refusal,
  onChange,
  onRemove,
}: {
  readonly row: QuickEntryRow
  readonly position: number
  readonly issues: readonly Issue[]
  readonly refusal: AppError | null
  readonly onChange: (row: QuickEntryRow) => void
  readonly onRemove: (() => void) | null
}) {
  const answered = refusal === null ? null : formStateOf(refusal, FIELDS)
  const rowLabel = [t('soldiers.quick.row'), String(position)].join(WORD)
  return (
    <fieldset className="flex flex-col gap-xs rounded-control border border-line p-sm">
      <legend className="px-2xs text-label font-semibold text-text-muted">{rowLabel}</legend>
      <div className="grid grid-cols-2 gap-sm md:grid-cols-3">
        {SOLDIER_CSV_COLUMNS.map((column) => (
          <TextField
            key={column}
            labelKey={COLUMN_KEYS[column]}
            name={`rows.${String(position)}.${column}`}
            value={row.values[column]}
            onChange={(value) => {
              onChange({ ...row, values: { ...row.values, [column]: value } })
            }}
            error={issueError(issues, answered?.answered ?? [], FIELD_OF[column])}
            {...(LTR_COLUMNS.has(column) ? { dir: 'ltr' as const } : {})}
            {...(column === 'invite_email' ? { type: 'email' as const } : {})}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-sm">
        {answered?.failure == null ? (
          <span />
        ) : (
          <p role="alert" className="text-label text-status-rejected">
            {t(failureKey(answered.failure))}
          </p>
        )}
        {onRemove === null ? null : (
          <AriaButton
            aria-label={[t('soldiers.quick.removeRow'), String(position)].join(WORD)}
            onPress={onRemove}
            className="flex size-touch cursor-pointer items-center justify-center rounded-control text-text-muted outline-focus md:size-control data-focus-visible:outline-2 data-hovered:bg-inner"
          >
            <Trash2 aria-hidden size={14} />
          </AriaButton>
        )}
      </div>
    </fieldset>
  )
}

/** The grid itself, over the units the actor may place a new soldier in with their private details. */
export function QuickEntry({
  units,
  today,
  allowedUnit,
}: {
  readonly units: readonly Unit[]
  readonly today: CalendarDate
  readonly allowedUnit: (id: UnitId) => boolean
}) {
  const panel = usePanel()
  const save = useQuickEntrySave()
  const placements = useMemo(() => unitOptions(units, allowedUnit), [units, allowedUnit])
  const [unitId, setUnitId] = useState<UnitId | null>(placements[0]?.value ?? null)
  const [rows, setRows] = useState<readonly QuickEntryRow[]>(() => withTrailingBlank([]))
  const [refusals, setRefusals] = useState<ReadonlyMap<string, AppError>>(new Map())
  const [saved, setSaved] = useState(0)
  const [paste, setPaste] = useState('')
  const [pasteProblem, setPasteProblem] = useState<I18nKey | null>(null)

  const placement = useMemo<QuickEntryPlacement | null>(
    () => (unitId === null ? null : { unit_id: unitId, valid_from: today }),
    [unitId, today],
  )
  const issues = useMemo(
    () => (placement === null ? new Map<string, readonly Issue[]>() : quickEntryIssues(rows, placement)),
    [rows, placement],
  )
  const ready = placement === null ? 0 : readyQuickEntryRows(rows, placement).length

  const change = (next: QuickEntryRow) => {
    setRows((current) => withTrailingBlank(current.map((row) => (row.key === next.key ? next : row))))
    setRefusals((current) => {
      const rest = new Map(current)
      rest.delete(next.key)
      return rest
    })
  }
  const remove = (key: string) => {
    setRows((current) => withTrailingBlank(current.filter((row) => row.key !== key)))
  }
  const addPasted = () => {
    const read = quickEntryRowsFromPaste(paste, {
      first_name: t(COLUMN_KEYS.first_name),
      last_name: t(COLUMN_KEYS.last_name),
      nickname: t(COLUMN_KEYS.nickname),
      personal_id: t(COLUMN_KEYS.personal_id),
      phone: t(COLUMN_KEYS.phone),
      invite_email: t(COLUMN_KEYS.invite_email),
    })
    if (!read.ok) {
      setPasteProblem(PASTE_KEYS[read.problem.kind])
      return
    }
    setPasteProblem(null)
    setPaste('')
    setRows((current) => withTrailingBlank([...current.filter((row) => !isBlankQuickEntryRow(row)), ...read.rows]))
  }
  const saveReady = async () => {
    if (placement === null) return
    const result = await save.run({ rows, placement })
    if (!result.ok) return
    const answers = result.value
    const done = new Set([...answers].flatMap(([key, answer]) => (answer.ok ? [key] : [])))
    setSaved((current) => current + done.size)
    setRows((current) => withTrailingBlank(current.filter((row) => !done.has(row.key))))
    setRefusals(new Map([...answers].flatMap(([key, answer]) => (answer.ok ? [] : [[key, answer.error] as const]))))
  }

  return (
    <section aria-label={t('soldiers.quick.title')} className="flex flex-col gap-md">
      <p className="text-micro text-text-muted">{t('soldiers.quick.hint')}</p>
      <SelectField
        labelKey="soldiers.quick.unit"
        name="unit_id"
        value={unitId}
        options={placements}
        onChange={setUnitId}
        error={null}
      />
      <div className="flex flex-col gap-xs">
        <TextAreaField
          labelKey="soldiers.quick.paste"
          name="paste"
          value={paste}
          onChange={(value) => {
            setPaste(value)
            setPasteProblem(null)
          }}
          error={pasteProblem}
        />
        <p className="text-micro text-text-muted">{t('soldiers.quick.pasteHint')}</p>
        <div>
          <Button isDisabled={paste.trim() === ''} onPress={addPasted}>
            {t('soldiers.quick.pasteAdd')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-sm">
        {rows.map((row, index) => {
          const blank = isBlankQuickEntryRow(row)
          return (
            <RowFields
              key={row.key}
              row={row}
              position={index + 1}
              issues={issues.get(row.key) ?? []}
              refusal={refusals.get(row.key) ?? null}
              onChange={change}
              onRemove={
                blank
                  ? null
                  : () => {
                      remove(row.key)
                    }
              }
            />
          )
        })}
      </div>
      {save.isPending ? (
        <p role="status" className="text-micro text-text-muted">
          {t('soldiers.quick.saving')}
        </p>
      ) : saved > 0 ? (
        <p role="status" className="text-micro text-text-muted">
          {[t('soldiers.quick.saved'), String(saved)].join(WORD)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          isDisabled={ready === 0 || save.isPending}
          onPress={() => {
            void saveReady()
          }}
        >
          {[t('soldiers.quick.save'), String(ready)].join(WORD)}
        </Button>
        <Button
          isDisabled={save.isPending}
          onPress={() => {
            panel.open(PANEL_IDS.soldiers)
          }}
        >
          {t('common.backToList')}
        </Button>
      </div>
    </section>
  )
}
