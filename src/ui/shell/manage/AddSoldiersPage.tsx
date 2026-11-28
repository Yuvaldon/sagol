import { NEW_ENTITY, PANEL_IDS, TRANSFER_FILES } from '@config'
import { SOLDIER_CSV_COLUMNS, type AppError, type Issue, type SoldierCsvColumn, type UnitId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  blankQuickEntryRow,
  isBlankQuickEntryRow,
  offeredColumns,
  quickEntryIssues,
  quickEntryRowsFromPaste,
  readyQuickEntryRows,
  usePanel,
  useQuickEntrySave,
  useShellPlace,
  useRosterPermissions,
  useToday,
  useUnits,
  type QuickEntryPlacement,
  type QuickEntryRow,
} from '@logic'
import { ClipboardList, FileUp, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { failureKey } from '../../errors/messages'
import { CardDoor } from '../../kit/Card'
import { unitOptions } from '../../modules/soldiers/unitOptions'
import { formStateOf, issueError } from '../../patterns/forms'
import { LoadingNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'
import { SelectField } from '../../primitives/SelectField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { useNotices } from '../notices'
import { PageFrame } from '../PageFrame'
import { PageTop } from './PageTop'

// "הוספת חיילים" (the handoff's Add soldiers, D-482): one flow for one soldier or many, a temporary full screen with no
// tab bar. Every row goes to one unit from today. A row is a first and a last name, and, where the actor may set private
// details, a personal number and an email for the automatic link (D-447). Rows are typed, pasted from a spreadsheet or
// read from a CSV file; a new empty row opens by itself; each row is checked as it is typed. "הוספת N חיילים" saves
// the ready rows one by one (D-282): a saved row leaves, and a refused one stays with its reason. Rank, tags and phone
// are set later in the person card; the full form of one soldier is a door away.

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
/** Always on a row: the names, then the details of the automatic link where they may be set. */
const SHOWN: readonly SoldierCsvColumn[] = ['first_name', 'last_name', 'personal_id', 'invite_email']

const PASTE_KEYS = { unreadable: 'soldiers.quick.pasteUnreadable', row_length: 'soldiers.quick.pasteRowLength' } as const

/** One blank row stays at the end, so there is always a row to type into. */
function withTrailingBlank(rows: readonly QuickEntryRow[]): readonly QuickEntryRow[] {
  const last = rows.at(-1)
  return last === undefined || !isBlankQuickEntryRow(last) ? [...rows, blankQuickEntryRow()] : rows
}

function RowCard({
  row,
  position,
  columns,
  issues,
  refusal,
  onChange,
  onRemove,
}: {
  readonly row: QuickEntryRow
  readonly position: number
  readonly columns: readonly SoldierCsvColumn[]
  readonly issues: readonly Issue[]
  readonly refusal: AppError | null
  readonly onChange: (row: QuickEntryRow) => void
  readonly onRemove: (() => void) | null
}) {
  const answered = refusal === null ? null : formStateOf(refusal, FIELDS)
  // A nickname or a phone a list brought shows, so nothing saved is unseen; a detail the unit does not take is not shown, as it is not sent.
  const shown = SOLDIER_CSV_COLUMNS.filter((column) => columns.includes(column) && (SHOWN.includes(column) || row.values[column] !== ''))
  return (
    <fieldset className="flex flex-col gap-xs rounded-card bg-surface p-lg">
      <legend className="sr-only">{[t('soldiers.quick.row'), String(position)].join(WORD)}</legend>
      <div className="grid grid-cols-2 gap-sm">
        {shown.map((column) => (
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
      {answered?.failure == null && onRemove === null ? null : (
        <div className="flex items-center justify-between gap-sm">
          {answered?.failure == null ? (
            <span />
          ) : (
            <p role="alert" className="text-small text-status-error">
              {t(failureKey(answered.failure))}
            </p>
          )}
          {onRemove === null ? null : (
            <AriaButton
              aria-label={[t('soldiers.quick.removeRow'), String(position)].join(WORD)}
              onPress={onRemove}
              className="flex size-touch cursor-pointer items-center justify-center rounded-full text-text-muted outline-focus data-focus-visible:outline-2 data-hovered:bg-inner"
            >
              <Trash2 aria-hidden size={16} />
            </AriaButton>
          )}
        </div>
      )}
    </fieldset>
  )
}

export function AddSoldiersPage() {
  const panel = usePanel()
  const place = useShellPlace()
  const notices = useNotices()
  const today = useToday()
  const units = useUnits()
  const liveUnits = useMemo(() => (units.status === 'ready' ? units.value : []), [units])
  const permissions = useRosterPermissions(NO_SOLDIERS, liveUnits)
  const placements = useMemo(() => unitOptions(liveUnits, permissions.placeIn), [liveUnits, permissions])
  const save = useQuickEntrySave()
  const [chosenUnit, setUnitId] = useState<UnitId | null>(null)
  const unitId = chosenUnit ?? placements[0]?.value ?? null
  const [rows, setRows] = useState<readonly QuickEntryRow[]>(() => withTrailingBlank([]))
  const [refusals, setRefusals] = useState<ReadonlyMap<string, AppError>>(new Map())
  const [pasting, setPasting] = useState(false)
  const [paste, setPaste] = useState('')
  const [listProblem, setListProblem] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const privateAllowed = permissions.privateOnCreate(unitId)
  const columns = offeredColumns(privateAllowed)
  // Where the unit takes no private details, none is sent (D-096): the rows show only what is saved.
  const placement = useMemo<QuickEntryPlacement | null>(
    () => (unitId === null || today === null ? null : { unit_id: unitId, valid_from: today, private_allowed: privateAllowed }),
    [unitId, today, privateAllowed],
  )
  const issues = useMemo(() => (placement === null ? new Map<string, readonly Issue[]>() : quickEntryIssues(rows, placement)), [rows, placement])
  const ready = placement === null ? 0 : readyQuickEntryRows(rows, placement).length

  const change = (next: QuickEntryRow) => {
    setRows((current) => withTrailingBlank(current.map((row) => (row.key === next.key ? next : row))))
    setRefusals((current) => {
      const rest = new Map(current)
      rest.delete(next.key)
      return rest
    })
  }
  const addList = (text: string): boolean => {
    const labels = {
      first_name: t(COLUMN_KEYS.first_name),
      last_name: t(COLUMN_KEYS.last_name),
      nickname: t(COLUMN_KEYS.nickname),
      personal_id: t(COLUMN_KEYS.personal_id),
      phone: t(COLUMN_KEYS.phone),
      invite_email: t(COLUMN_KEYS.invite_email),
    }
    const read = quickEntryRowsFromPaste(text, labels, columns)
    if (!read.ok) {
      setListProblem(
        read.problem.kind === 'column_not_offered'
          ? [t('manage.add.columnNotOffered'), t(COLUMN_KEYS[read.problem.column])].join(WORD)
          : t(PASTE_KEYS[read.problem.kind]),
      )
      return false
    }
    setListProblem(null)
    setRows((current) => withTrailingBlank([...current.filter((row) => !isBlankQuickEntryRow(row)), ...read.rows]))
    return true
  }
  const saveReady = async () => {
    if (placement === null) return
    const result = await save.run({ rows, placement })
    if (!result.ok) return
    const answers = result.value
    const done = new Set([...answers].flatMap(([key, answer]) => (answer.ok ? [key] : [])))
    setRows((current) => withTrailingBlank(current.filter((row) => !done.has(row.key))))
    setRefusals(new Map([...answers].flatMap(([key, answer]) => (answer.ok ? [] : [[key, answer.error] as const]))))
    if (done.size > 0) notices.say([String(done.size), t('manage.add.added')].join(WORD))
  }

  const fullFormDoor = permissions.create ? (
    <CardDoor
      labelKey="manage.add.fullForm"
      onPress={() => {
        // The form takes the place of this screen: the list is under it, as the new soldier's card will be.
        place.closePage()
        panel.open(PANEL_IDS.soldiers, { entity: NEW_ENTITY })
      }}
    />
  ) : null
  const action =
    placement === null ? null : (
      <AriaButton
        isDisabled={ready === 0 || save.isPending}
        onPress={() => {
          void saveReady()
        }}
        className="pointer-events-auto inline-flex min-h-tab w-full max-w-drawer cursor-pointer items-center justify-center rounded-full bg-action-solid px-xl text-body font-bold text-on-action shadow-primary outline-focus outline-offset-2 data-disabled:cursor-default data-disabled:bg-toggle-off data-disabled:text-text-muted data-disabled:shadow-none data-focus-visible:outline-2"
      >
        {ready === 0 ? t('manage.add.submit') : [t('manage.add.submitCount'), String(ready), t('manage.add.submitSoldiers')].join(WORD)}
      </AriaButton>
    )

  return (
    <PageFrame tray={action}>
      <PageTop titleKey="manage.pages.addSoldiers" closes />
      {units.status !== 'ready' || today === null ? (
        <LoadingNotice />
      ) : placements.length === 0 ? (
        // Who may create a soldier with no unit has no unit to place rows in, but still the full form (D-482).
        <>
          <p className="text-body text-text-muted">{t('manage.add.noUnit')}</p>
          {fullFormDoor}
        </>
      ) : (
        <>
          <SelectField labelKey="manage.add.unit" name="unit_id" value={unitId} options={placements} onChange={setUnitId} error={null} />
          <div className="flex flex-wrap gap-sm">
            <Button
              onPress={() => {
                setPasting(!pasting)
              }}
            >
              <ClipboardList aria-hidden size={16} />
              {t('manage.add.paste')}
            </Button>
            <Button
              onPress={() => {
                file.current?.click()
              }}
            >
              <FileUp aria-hidden size={16} />
              {t('manage.add.import')}
            </Button>
            <input
              ref={file}
              type="file"
              accept={TRANSFER_FILES.accept.join(',')}
              aria-label={t('manage.add.import')}
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const picked = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (picked === undefined) return
                void picked.text().then(addList)
              }}
            />
          </div>
          {pasting ? (
            <div className="flex flex-col gap-xs">
              <TextAreaField
                labelKey="soldiers.quick.paste"
                name="paste"
                value={paste}
                onChange={(value) => {
                  setPaste(value)
                  setListProblem(null)
                }}
                error={null}
              />
              <p className="text-small text-text-muted">{t('soldiers.quick.pasteHint')}</p>
              <div>
                <Button
                  isDisabled={paste.trim() === ''}
                  onPress={() => {
                    if (addList(paste)) {
                      setPaste('')
                      setPasting(false)
                    }
                  }}
                >
                  {t('soldiers.quick.pasteAdd')}
                </Button>
              </div>
            </div>
          ) : null}
          {listProblem === null ? null : (
            <p role="alert" className="text-small text-status-error">
              {listProblem}
            </p>
          )}
          <div className="flex flex-col gap-sm">
            {rows.map((row, index) => (
              <RowCard
                key={row.key}
                row={row}
                position={index + 1}
                columns={columns}
                issues={issues.get(row.key) ?? []}
                refusal={refusals.get(row.key) ?? null}
                onChange={change}
                onRemove={
                  isBlankQuickEntryRow(row)
                    ? null
                    : () => {
                        setRows((current) => withTrailingBlank(current.filter((other) => other.key !== row.key)))
                      }
                }
              />
            ))}
          </div>
          {save.isPending ? (
            <p role="status" className="text-small text-text-muted">
              {t('soldiers.quick.saving')}
            </p>
          ) : null}
          {fullFormDoor}
        </>
      )}
    </PageFrame>
  )
}

const NO_SOLDIERS: readonly never[] = []
