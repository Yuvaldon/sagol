import type { AppError, Result } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { ArchiveRestore, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from 'react-aria-components'
import { failureKey } from '../errors/messages'
import { IconButton } from '../primitives/Button'
import { SmallDialog } from './Dialogs'

// The archived rows of a list, closed under the list (D-371): quiet, dimmed, each with one way back. Only rows the
// actor may restore are offered; with none, nothing shows (D-076). The command decides again.

interface Restorable {
  readonly id: string
  readonly archived_at: string | null
}

export interface ArchivedSectionProps<Row extends Restorable> {
  /** The archived rows the actor may restore, in the list's order. */
  readonly rows: readonly Row[]
  readonly nameOf: (row: Row) => string
  readonly restore: { readonly run: (row: Row) => Promise<Result<unknown>>; readonly isPending: boolean }
  /** What coming back means for this kind of row. */
  readonly bodyKey?: I18nKey
  /** 3 inside a drawer, 2 in the viewport. */
  readonly headingLevel?: 2 | 3
}

/** Why a restore was refused, in the words of a restore: what it depends on, or what took its place. */
function restoreFailureKey(error: AppError): I18nKey {
  const [issue] = error.code === 'validation_failed' ? error.issues : []
  switch (issue?.code) {
    case 'reference_archived':
      return 'archived.blockedArchived'
    case 'reference_not_found':
      return 'archived.blockedMissing'
    case 'already_exists':
      return 'archived.blockedTaken'
    // A unit with no parent while another live root exists (D-251).
    case 'required':
      return issue.path[0] === 'parent_id' ? 'archived.blockedRoot' : failureKey(error)
    default:
      return failureKey(error)
  }
}

export function ArchivedSection<Row extends Restorable>({
  rows,
  nameOf,
  restore,
  bodyKey = 'archived.restoreBody',
  headingLevel = 3,
}: ArchivedSectionProps<Row>) {
  const [restoring, setRestoring] = useState<Row | null>(null)
  const [failure, setFailure] = useState<AppError | null>(null)
  if (rows.length === 0) return null

  return (
    <Disclosure className="group">
      <Heading level={headingLevel}>
        <AriaButton
          slot="trigger"
          className="flex min-h-touch cursor-pointer items-center gap-xs rounded-control px-xs text-label font-semibold text-text-muted outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          <ChevronDown aria-hidden size={14} className="shrink-0 group-data-expanded:rotate-180" />
          {t('archived.section')}
          <span className="rounded-pill bg-inner px-sm text-micro tabular-nums">{rows.length}</span>
        </AriaButton>
      </Heading>
      <DisclosurePanel className="flex flex-col gap-sm">
        {failure === null ? null : (
          <p role="alert" className="px-xs text-name text-status-rejected">
            {t(restoreFailureKey(failure))}
          </p>
        )}
        <ul aria-label={t('archived.listLabel')} className="flex flex-col">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2xs border-b border-line">
              <span className="flex min-h-touch min-w-none flex-1 items-center truncate px-xs text-name text-text-muted md:min-h-control">
                {nameOf(row)}
              </span>
              <IconButton
                labelKey="common.restore"
                onPress={() => {
                  setFailure(null)
                  setRestoring(row)
                }}
              >
                <ArchiveRestore aria-hidden size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      </DisclosurePanel>
      {restoring === null ? null : (
        <SmallDialog
          titleKey="archived.restoreTitle"
          hintKey={bodyKey}
          confirmKey="common.restore"
          isPending={restore.isPending}
          onCancel={() => {
            setRestoring(null)
          }}
          onConfirm={() => {
            void restore.run(restoring).then((result) => {
              setRestoring(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        >
          <p className="text-name font-semibold">{nameOf(restoring)}</p>
        </SmallDialog>
      )}
    </Disclosure>
  )
}
