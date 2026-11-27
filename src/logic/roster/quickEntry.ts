import {
  SOLDIER_CSV_COLUMNS,
  type AppError,
  type CalendarDate,
  type Issue,
  type SoldierCsvColumn,
  type UnitId,
} from '@contracts'
import { normalizeEmail, normalizePersonalId, readPastedSoldiers, type PastedSoldiers } from '@domain'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { newSoldierIssues, toCreateSoldierInput, type NewSoldierValues } from './forms'

// The quick entry (D-282): a grid of new soldiers with the CSV's columns, all placed in one unit from today. Each row is
// checked on the `create_soldier` form and saved by its own command, one after another.

export type QuickEntryValues = Readonly<Record<SoldierCsvColumn, string>>

/** A row of the grid. The key is the grid's own, so a row keeps its place and its answer as others leave. */
export interface QuickEntryRow {
  readonly key: string
  readonly values: QuickEntryValues
}

const BLANK: QuickEntryValues = {
  first_name: '',
  last_name: '',
  nickname: '',
  personal_id: '',
  phone: '',
  invite_email: '',
}

export function blankQuickEntryRow(): QuickEntryRow {
  return { key: crypto.randomUUID(), values: BLANK }
}

/** A row with nothing typed in it: it is no soldier, and the save passes it by. */
export function isBlankQuickEntryRow(row: QuickEntryRow): boolean {
  return SOLDIER_CSV_COLUMNS.every((column) => row.values[column].trim() === '')
}

/** A list that holds a detail the actor may not add where the rows go (D-482): nothing pasted is dropped unseen. */
export interface ColumnNotOffered {
  readonly ok: false
  readonly problem: { readonly kind: 'column_not_offered'; readonly column: SoldierCsvColumn }
}

/**
 * Pasted text, or a file's, as rows of the grid, or why it cannot be read. With `offered`, a value in any other column
 * refuses the whole list, naming the column.
 */
export function quickEntryRowsFromPaste(
  text: string,
  labels: Readonly<Record<SoldierCsvColumn, string>>,
  offered: readonly SoldierCsvColumn[] = SOLDIER_CSV_COLUMNS,
): { readonly ok: true; readonly rows: readonly QuickEntryRow[] } | Extract<PastedSoldiers, { ok: false }> | ColumnNotOffered {
  const read = readPastedSoldiers(text, labels)
  if (!read.ok) return read
  const extra = SOLDIER_CSV_COLUMNS.find((column) => !offered.includes(column) && read.rows.some((row) => (row[column] ?? '') !== ''))
  if (extra !== undefined) return { ok: false, problem: { kind: 'column_not_offered', column: extra } }
  const rows = read.rows.map((row) => ({
    key: crypto.randomUUID(),
    values: {
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      nickname: row.nickname ?? '',
      personal_id: row.personal_id ?? '',
      phone: row.phone ?? '',
      invite_email: row.invite_email ?? '',
    },
  }))
  return { ok: true, rows }
}

/** Where every row goes: one unit, from the organization's today. */
export interface QuickEntryPlacement {
  readonly unit_id: UnitId
  readonly valid_from: CalendarDate
  /**
   * Whether the actor may set private details in that unit (D-096). Where they may not, no private value is sent:
   * what the actor may not set there, the save does not carry (D-482). Absent: they may.
   */
  readonly private_allowed?: boolean
}

function formValues(values: QuickEntryValues, placement: QuickEntryPlacement): NewSoldierValues {
  const allowed = placement.private_allowed !== false
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    nickname: values.nickname.trim(),
    command_rank_id: null,
    membership: { unit_id: placement.unit_id, valid_from: placement.valid_from },
    private: allowed
      ? { personal_id: values.personal_id.trim(), invite_email: values.invite_email.trim(), phone: values.phone.trim() }
      : { personal_id: '', invite_email: '', phone: '' },
  }
}

const DUPLICATE_PERSONAL_ID: Issue = { path: ['private', 'personal_id'], code: 'duplicate_item' }
const DUPLICATE_EMAIL: Issue = { path: ['private', 'invite_email'], code: 'duplicate_item' }

/** How many typed rows hold each value, by its normal form; an empty value counts nowhere. */
function countsOf(rows: readonly QuickEntryRow[], keyOf: (row: QuickEntryRow) => string | null): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

const idKey = (row: QuickEntryRow) => normalizePersonalId(row.values.personal_id)
const emailKey = (row: QuickEntryRow) => {
  const email = normalizeEmail(row.values.invite_email)
  return email === '' ? null : email
}

/**
 * Each typed row's issues, by key: the form's, and a personal number or an invite email another row of the grid
 * repeats, compared in their normal forms (D-066): both rows are marked, so a list pasted twice says so. Blank rows have
 * no entry. Where private details may not be set, they are not checked: they are not sent.
 */
export function quickEntryIssues(rows: readonly QuickEntryRow[], placement: QuickEntryPlacement): ReadonlyMap<string, readonly Issue[]> {
  const typed = rows.filter((row) => !isBlankQuickEntryRow(row))
  const checksPrivate = placement.private_allowed !== false
  const ids = countsOf(typed, idKey)
  const emails = countsOf(typed, emailKey)
  const repeated = (counts: ReadonlyMap<string, number>, key: string | null) => key !== null && (counts.get(key) ?? 0) > 1
  return new Map(
    typed.map((row) => {
      const issues = newSoldierIssues(formValues(row.values, placement))
      return [
        row.key,
        [
          ...issues,
          ...(checksPrivate && repeated(ids, idKey(row)) ? [DUPLICATE_PERSONAL_ID] : []),
          ...(checksPrivate && repeated(emails, emailKey(row)) ? [DUPLICATE_EMAIL] : []),
        ],
      ]
    }),
  )
}

/** The rows the save would send: typed, with no issue. */
export function readyQuickEntryRows(rows: readonly QuickEntryRow[], placement: QuickEntryPlacement): readonly QuickEntryRow[] {
  const issues = quickEntryIssues(rows, placement)
  return rows.filter((row) => issues.get(row.key)?.length === 0)
}

/** Each sent row's answer, by key: saved, or refused with the adapter's reason. */
export type QuickEntryAnswers = ReadonlyMap<string, { readonly ok: true } | { readonly ok: false; readonly error: AppError }>

/**
 * Saves the ready rows, one `create_soldier` each, in order. A refusal does not stop the rest: each row stands alone.
 * The answer is always a result, so the roster refreshes for the rows that were saved.
 */
export function useQuickEntrySave() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.soldiers, QUERY_KEYS.unitMemberships, QUERY_KEYS.soldierPrivate],
    async ({ rows, placement }: { rows: readonly QuickEntryRow[]; placement: QuickEntryPlacement }) => {
      const answers = new Map<string, { readonly ok: true } | { readonly ok: false; readonly error: AppError }>()
      for (const row of readyQuickEntryRows(rows, placement)) {
        const result = await data.commands.soldiers.create(toCreateSoldierInput(formValues(row.values, placement)))
        answers.set(row.key, result.ok ? { ok: true } : { ok: false, error: result.error })
      }
      const answer: { ok: true; value: QuickEntryAnswers } = { ok: true, value: answers }
      return answer
    },
  )
}

/** The columns a new soldier is added with where the actor may, or may not, set private details (D-482, D-096). */
export function offeredColumns(privateAllowed: boolean): readonly SoldierCsvColumn[] {
  return privateAllowed ? SOLDIER_CSV_COLUMNS : PUBLIC_COLUMNS
}

const PUBLIC_COLUMNS: readonly SoldierCsvColumn[] = ['first_name', 'last_name', 'nickname']
