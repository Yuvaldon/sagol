import { TRANSFER_FILES } from '@config'
import type { AppError, ImportOperation, ImportReport, Result } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { readPickedFile, useExport, useImport, useTransferAccess, type ImportFile, type ImportFileProblem } from '@logic'
import { Download, Upload } from 'lucide-react'
import { useState } from 'react'
import { FileTrigger } from 'react-aria-components'
import { failureKey } from '../../errors/messages'
import { FailureNotice } from '../../patterns/Notices'
import { Button } from '../../primitives/Button'

// Import and export (D-171). A file is read and checked on its form, then run as a dry run: the preview lists each
// refused item, and "import" runs the same operations for real. The export saves the organization's rows as JSON.

const PROBLEM_KEYS: Record<ImportFileProblem['kind'], I18nKey> = {
  unreadable: 'transfer.problemUnreadable',
  empty: 'transfer.problemEmpty',
  unknown_column: 'transfer.problemUnknownColumn',
  missing_column: 'transfer.problemMissingColumn',
  repeated_column: 'transfer.problemRepeatedColumn',
  row_length: 'transfer.problemRowLength',
  not_json: 'transfer.problemNotJson',
  no_operations: 'transfer.problemNoOperations',
}

const SEPARATOR = ' · '
const SPACE = ' '

/** A label followed by its number. */
function counted(key: I18nKey, count: number): string {
  return [t(key), String(count)].join(SPACE)
}

function problemText(problem: ImportFileProblem): string {
  const message = t(PROBLEM_KEYS[problem.kind])
  if ('column' in problem) return [message, problem.column].join(SEPARATOR)
  if ('row' in problem) return [message, counted('transfer.item', problem.row)].join(SEPARATOR)
  return message
}

/** The field a refusal points at, as the file names it. */
function fieldOf(error: AppError): string | null {
  if (error.code !== 'validation_failed') return null
  const [issue] = error.issues
  const named = issue?.path.filter((segment) => typeof segment === 'string' && segment !== 'input') ?? []
  return named.length === 0 ? null : named.join('.')
}

function refusals(report: ImportReport) {
  return report.results.flatMap((result) => (result.error === null ? [] : [{ index: result.index, error: result.error }]))
}

function ReportList({ report }: { readonly report: ImportReport }) {
  return (
    <ul aria-label={t('transfer.refusedLabel')} className="flex flex-col gap-xs">
      {refusals(report).map(({ index, error }) => {
        const field = fieldOf(error)
        return (
          <li key={index} className="flex flex-wrap items-baseline gap-xs rounded-control border border-status-rejected p-sm text-name">
            <span className="font-semibold tabular-nums">{counted('transfer.item', index + 1)}</span>
            <span className="text-status-rejected">{t(failureKey(error))}</span>
            {field === null ? null : (
              <span dir="ltr" className="text-micro text-text-muted">
                {field}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'checking' }
  | { readonly kind: 'unusable'; readonly problem: ImportFileProblem }
  | { readonly kind: 'refused'; readonly report: ImportReport }
  | { readonly kind: 'failed'; readonly error: AppError }
  | { readonly kind: 'ready'; readonly operations: readonly ImportOperation[] }
  | { readonly kind: 'imported'; readonly count: number }

function previewStage(operations: readonly ImportOperation[], preview: Result<ImportReport>): Stage {
  if (!preview.ok) return { kind: 'failed', error: preview.error }
  return refusals(preview.value).length === 0 ? { kind: 'ready', operations } : { kind: 'refused', report: preview.value }
}

function ImportSection() {
  const importer = useImport()
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [fileName, setFileName] = useState<string | null>(null)

  async function check(file: File) {
    setFileName(file.name)
    setStage({ kind: 'checking' })
    const read: ImportFile = await readPickedFile(file)
    if (read.status === 'unusable') return setStage({ kind: 'unusable', problem: read.problem })
    if (read.status === 'malformed') return setStage({ kind: 'refused', report: read.report })
    const preview = await importer.run({ operations: read.operations, dryRun: true })
    setStage(previewStage(read.operations, preview))
  }

  async function commit(operations: readonly ImportOperation[]) {
    const result = await importer.run({ operations, dryRun: false })
    if (!result.ok) return setStage({ kind: 'failed', error: result.error })
    setStage(result.value.committed ? { kind: 'imported', count: operations.length } : { kind: 'refused', report: result.value })
  }

  return (
    <section aria-labelledby="transfer-import" className="flex flex-col gap-sm">
      <h3 id="transfer-import" className="text-label font-semibold text-text-muted">
        {t('transfer.importTitle')}
      </h3>
      <p className="text-name text-text-muted">{t('transfer.importHint')}</p>
      <div className="flex flex-wrap items-center gap-sm">
        <FileTrigger
          acceptedFileTypes={[...TRANSFER_FILES.accept]}
          onSelect={(files) => {
            const file = files?.[0]
            if (file !== undefined) void check(file)
          }}
        >
          <Button isPending={stage.kind === 'checking'}>
            <Upload aria-hidden size={14} />
            {t('transfer.pick')}
          </Button>
        </FileTrigger>
        {fileName === null ? null : (
          <span dir="auto" className="truncate text-name">
            {fileName}
          </span>
        )}
      </div>
      {stage.kind === 'unusable' ? (
        <p role="alert" className="rounded-control border border-status-rejected p-md text-name text-status-rejected">
          {problemText(stage.problem)}
        </p>
      ) : null}
      {stage.kind === 'failed' ? <FailureNotice error={stage.error} /> : null}
      {stage.kind === 'refused' ? (
        <div role="alert" className="flex flex-col gap-sm">
          <p className="text-name font-semibold text-status-rejected">{t('transfer.refused')}</p>
          <ReportList report={stage.report} />
        </div>
      ) : null}
      {stage.kind === 'ready' ? (
        <div role="status" className="flex flex-col items-start gap-sm rounded-control border border-line p-md">
          <p className="text-name">{counted('transfer.readyCount', stage.operations.length)}</p>
          <Button
            variant="primary"
            isPending={importer.isPending}
            onPress={() => {
              void commit(stage.operations)
            }}
          >
            {t('transfer.import')}
          </Button>
        </div>
      ) : null}
      {stage.kind === 'imported' ? (
        <p role="status" className="rounded-control border border-status-approved p-md text-name">
          {counted('transfer.importedCount', stage.count)}
        </p>
      ) : null}
    </section>
  )
}

function save(file: { readonly name: string; readonly blob: Blob }) {
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

function ExportSection() {
  const exporter = useExport()
  const [error, setError] = useState<AppError | null>(null)
  return (
    <section aria-labelledby="transfer-export" className="flex flex-col items-start gap-sm">
      <h3 id="transfer-export" className="text-label font-semibold text-text-muted">
        {t('transfer.exportTitle')}
      </h3>
      <p className="text-name text-text-muted">{t('transfer.exportHint')}</p>
      <Button
        isPending={exporter.isPending}
        onPress={() => {
          void exporter.run().then((result) => {
            setError(result.ok ? null : result.error)
            if (result.ok) save(result.value)
          })
        }}
      >
        <Download aria-hidden size={14} />
        {t('transfer.export')}
      </Button>
      {error === null ? null : <FailureNotice error={error} />}
    </section>
  )
}

export function TransferModule() {
  const access = useTransferAccess()
  return (
    <div className="flex flex-col gap-lg">
      {access.import ? <ImportSection /> : null}
      {access.export ? <ExportSection /> : null}
    </div>
  )
}
