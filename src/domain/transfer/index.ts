import { SOLDIER_CSV_COLUMNS, type CreateSoldierInput, type SoldierCsvColumn, type SoldierId } from '@contracts'
import { optionalText } from '../text'

// The import's spreadsheet form (D-171): a CSV of soldiers, one `create_soldier` per row. The file is read here; the
// commands validate each row as they would a form.

const QUOTE = '"'
const SEPARATOR = ','
const BYTE_ORDER_MARK = '\uFEFF'
/** What a decoder writes for bytes that are not UTF-8: a file saved in another encoding (Windows-1255, for one). */
const REPLACEMENT_CHARACTER = '\uFFFD'
const REQUIRED_COLUMNS: readonly SoldierCsvColumn[] = ['first_name', 'last_name']

/** RFC 4180 cells: commas, quoted cells with doubled quotes, CRLF or LF. NULL: a quote is left open, or text follows one. */
export function parseCsv(text: string): string[][] | null {
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  // A quoted cell has ended: only a separator or a line break may follow.
  let closed = false
  let index = 0
  while (index < source.length) {
    const char = source.charAt(index)
    if (quoted) {
      if (char === QUOTE && source.charAt(index + 1) === QUOTE) {
        cell += QUOTE
        index += 2
        continue
      }
      if (char === QUOTE) {
        quoted = false
        closed = true
      } else cell += char
      index += 1
      continue
    }
    const breaksCell = char === SEPARATOR || char === '\n' || char === '\r'
    if (closed && !breaksCell) return null
    closed = false
    if (char === QUOTE && cell === '') quoted = true
    else if (char === SEPARATOR) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (char === '\r' && source.charAt(index + 1) === '\n') index += 1
    } else cell += char
    index += 1
  }
  if (quoted) return null
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  // Blank lines carry no soldier.
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

export type SoldierCsvRow = Readonly<Record<SoldierCsvColumn, string | null>>

export type SoldierCsvProblem =
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'not_utf8' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unknown_column'; readonly column: string }
  | { readonly kind: 'missing_column'; readonly column: SoldierCsvColumn }
  | { readonly kind: 'repeated_column'; readonly column: SoldierCsvColumn }
  | { readonly kind: 'row_length'; readonly row: number }

export type SoldierCsvRead =
  | { readonly ok: true; readonly rows: readonly SoldierCsvRow[] }
  | { readonly ok: false; readonly problem: SoldierCsvProblem }

function isColumn(name: string): name is SoldierCsvColumn {
  return SOLDIER_CSV_COLUMNS.some((column) => column === name)
}

/**
 * The soldiers of a CSV file. The header row names the columns of `SOLDIER_CSV_COLUMNS`, in any order; the names are
 * required, the rest may be left out. Names are read without case, and empty cells at the end of the header (a
 * spreadsheet's habit) are no column. `row` in a problem counts data rows from 1, blank lines left out, as the
 * preview counts items.
 */
export function readSoldierCsv(text: string): SoldierCsvRead {
  if (text.includes(REPLACEMENT_CHARACTER)) return { ok: false, problem: { kind: 'not_utf8' } }
  const cells = parseCsv(text)
  if (cells === null) return { ok: false, problem: { kind: 'unreadable' } }
  const [header, ...data] = cells
  if (header === undefined || data.length === 0) return { ok: false, problem: { kind: 'empty' } }
  const names = header.map((value) => value.trim().toLowerCase())
  while (names.length > 0 && names.at(-1) === '') names.pop()
  const columns: SoldierCsvColumn[] = []
  for (const name of names) {
    if (!isColumn(name)) return { ok: false, problem: { kind: 'unknown_column', column: name } }
    if (columns.includes(name)) return { ok: false, problem: { kind: 'repeated_column', column: name } }
    columns.push(name)
  }
  const missing = REQUIRED_COLUMNS.find((column) => !columns.includes(column))
  if (missing !== undefined) return { ok: false, problem: { kind: 'missing_column', column: missing } }
  const rows: SoldierCsvRow[] = []
  for (const [index, values] of data.entries()) {
    // A row is as wide as the header; the cells past the named columns are empty.
    const extra = values.slice(columns.length)
    if (values.length !== header.length || extra.some((value) => value.trim() !== '')) {
      return { ok: false, problem: { kind: 'row_length', row: index + 1 } }
    }
    const valueOf = (column: SoldierCsvColumn) => {
      const position = columns.indexOf(column)
      return position === -1 ? null : optionalText(values[position] ?? null)
    }
    rows.push({
      first_name: valueOf('first_name'),
      last_name: valueOf('last_name'),
      nickname: valueOf('nickname'),
      personal_id: valueOf('personal_id'),
      phone: valueOf('phone'),
      invite_email: valueOf('invite_email'),
    })
  }
  return { ok: true, rows }
}

/** A row as the command's input: a new active soldier, unplaced, with no rank (D-171). Names stay as typed. */
export function soldierCsvInput(row: SoldierCsvRow, id: SoldierId): CreateSoldierInput {
  const hasPrivate = row.personal_id !== null || row.phone !== null || row.invite_email !== null
  return {
    id,
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    nickname: row.nickname,
    command_rank_id: null,
    status: 'active',
    properties: {},
    private: hasPrivate ? { personal_id: row.personal_id, invite_email: row.invite_email, phone: row.phone } : null,
    membership: null,
  }
}
