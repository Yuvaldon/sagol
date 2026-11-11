import type { ImportOperation, PermissionCheck, Result } from '@contracts'
import { SoldierId } from '@contracts'
import { useMutation } from '@tanstack/react-query'
import { useCan } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import { usePorts } from '../runtime/context'
import { exportFileOf, readImportFile, type ImportFile } from './file'

// Import with its dry-run preview, and the organization's export (D-171). The hints only decide what is shown: the
// adapter checks `data_transfer` again, and each operation on its own command.

const TRANSFER_CHECKS = {
  import: { permission: { resource: 'data_transfer', action: 'import' }, target: { kind: 'organization' } },
  export: { permission: { resource: 'data_transfer', action: 'export' }, target: { kind: 'organization' } },
} as const satisfies Record<string, PermissionCheck>

const TRANSFER_CHECK_LIST: readonly PermissionCheck[] = Object.values(TRANSFER_CHECKS)

export function useTransferAccess() {
  const can = useCan(TRANSFER_CHECK_LIST)
  const access = { import: can(TRANSFER_CHECKS.import), export: can(TRANSFER_CHECKS.export) }
  return { ...access, any: access.import || access.export }
}

/** Reads a picked file. A CSV row's soldier gets a new id each time the file is read. */
export async function readPickedFile(file: File): Promise<ImportFile> {
  return readImportFile(file.name, await file.text(), () => SoldierId.parse(crypto.randomUUID()))
}

/**
 * Runs the operations: `preview` is the dry run, which writes nothing and so refreshes nothing; `commit` is the real
 * run, which refreshes every table.
 */
export function useImport() {
  const { data } = usePorts()
  const preview = useMutation({
    mutationFn: (operations: readonly ImportOperation[]) => data.transfer.importBatch({ dry_run: true, operations: [...operations] }),
  })
  const commit = useCommand([QUERY_KEYS.tables], (operations: readonly ImportOperation[]) =>
    data.transfer.importBatch({ dry_run: false, operations: [...operations] }),
  )
  return { preview: preview.mutateAsync, commit: commit.run, isPending: preview.isPending || commit.isPending }
}

/** Takes the export and hands it over as a file to save. */
export function useExport() {
  const { data } = usePorts()
  const mutation = useMutation({
    mutationFn: async (): Promise<Result<ReturnType<typeof exportFileOf>>> => {
      const exported = await data.transfer.exportOrganization()
      return exported.ok ? { ok: true, value: exportFileOf(exported.value) } : exported
    },
  })
  return { run: mutation.mutateAsync, isPending: mutation.isPending }
}
