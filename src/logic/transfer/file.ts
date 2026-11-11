import { TRANSFER_FILES } from '@config'
import { ImportOperation, type ImportReport, type OrganizationExport, type SoldierId } from '@contracts'
import { issuesFromSchema, readSoldierCsv, soldierCsvInput, type SoldierCsvProblem } from '@domain'
import { z } from 'zod'

// An import file as the import reads it (D-171): a CSV of soldiers, or JSON `{ "operations": [...] }`. Each operation is
// checked on its form before anything runs, the way a form checks its fields before the command.

export type ImportFileProblem = SoldierCsvProblem | { readonly kind: 'not_json' } | { readonly kind: 'no_operations' }

export type ImportFile =
  | { readonly status: 'ready'; readonly operations: readonly ImportOperation[] }
  /** Some operations are malformed: nothing runs, and each one is reported on its form. */
  | { readonly status: 'malformed'; readonly report: ImportReport }
  | { readonly status: 'unusable'; readonly problem: ImportFileProblem }

const OperationList = z.object({ operations: z.array(z.unknown()).min(1) })

function isCsv(name: string): boolean {
  return name.toLowerCase().endsWith(TRANSFER_FILES.csvExtension)
}

function parsedJson(text: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

function checked(operations: readonly unknown[]): ImportFile {
  const parsed = operations.map((operation) => ImportOperation.safeParse(operation))
  const ready: ImportOperation[] = []
  for (const result of parsed) if (result.success) ready.push(result.data)
  if (ready.length === operations.length) return { status: 'ready', operations: ready }
  return {
    status: 'malformed',
    report: {
      committed: false,
      results: parsed.map((result, index) => ({
        index,
        error: result.success
          ? null
          : { code: 'validation_failed', issues: issuesFromSchema(result.error.issues, operations[index]) },
      })),
    },
  }
}

/** `newSoldierId` names each soldier a CSV row creates (D-044). */
export function readImportFile(name: string, text: string, newSoldierId: () => SoldierId): ImportFile {
  if (isCsv(name)) {
    const read = readSoldierCsv(text)
    if (!read.ok) return { status: 'unusable', problem: read.problem }
    return checked(read.rows.map((row) => ({ command: 'create_soldier', input: soldierCsvInput(row, newSoldierId()) })))
  }
  const json = parsedJson(text)
  if (!json.ok) return { status: 'unusable', problem: { kind: 'not_json' } }
  const list = OperationList.safeParse(json.value)
  if (!list.success) return { status: 'unusable', problem: { kind: 'no_operations' } }
  return checked(list.data.operations)
}

/** The export as a file to save: its name carries the day it was taken. */
export function exportFileOf(exported: OrganizationExport): { readonly name: string; readonly blob: Blob } {
  const day = exported.exported_at.slice(0, 10)
  return {
    name: `${TRANSFER_FILES.exportName}-${day}${TRANSFER_FILES.exportExtension}`,
    blob: new Blob([JSON.stringify(exported, null, 2)], { type: TRANSFER_FILES.exportMediaType }),
  }
}
