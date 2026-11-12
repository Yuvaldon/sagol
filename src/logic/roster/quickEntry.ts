import {
  SOLDIER_CSV_COLUMNS,
  type AppError,
  type CalendarDate,
  type Issue,
  type SoldierCsvColumn,
  type UnitId,
} from '@contracts'
import { readPastedSoldiers, type PastedSoldiers } from '@domain'
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

/** Pasted text as rows of the grid, or why it cannot be read. */
export function quickEntryRowsFromPaste(
  text: string,
  labels: Readonly<Record<SoldierCsvColumn, string>>,
): { readonly ok: true; readonly rows: readonly QuickEntryRow[] } | Extract<PastedSoldiers, { ok: false }> {
  const read = readPastedSoldiers(text, labels)
  if (!read.ok) return read
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
}

function formValues(values: QuickEntryValues, placement: QuickEntryPlacement): NewSoldierValues {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    nickname: values.nickname.trim(),
    command_rank_id: null,
    membership: placement,
    private: { personal_id: values.personal_id.trim(), invite_email: values.invite_email.trim(), phone: values.phone.trim() },
  }
}

const DUPLICATE_PERSONAL_ID: Issue = { path: ['private', 'personal_id'], code: 'duplicate_item' }

/**
 * Each typed row's issues, by key: the form's, and a personal number another row of the grid repeats (both are
 * marked). Blank rows have no entry.
 */
export function quickEntryIssues(rows: readonly QuickEntryRow[], placement: QuickEntryPlacement): ReadonlyMap<string, readonly Issue[]> {
  const typed = rows.filter((row) => !isBlankQuickEntryRow(row))
  const counts = new Map<string, number>()
  for (const row of typed) {
    const personalId = row.values.personal_id.trim()
    if (personalId !== '') counts.set(personalId, (counts.get(personalId) ?? 0) + 1)
  }
  return new Map(
    typed.map((row) => {
      const issues = newSoldierIssues(formValues(row.values, placement))
      const repeated = (counts.get(row.values.personal_id.trim()) ?? 0) > 1
      return [row.key, repeated ? [...issues, DUPLICATE_PERSONAL_ID] : issues]
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
