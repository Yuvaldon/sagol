import type { AppError, Result } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { SmallDialog } from './Dialogs'
import { restoreFailureKey } from './restoreFailure'

// Archiving a definition in a module (OI-297, D-461, D-491): asked first, by name, with what archiving hides, on a button
// that is not the primary color; then a line in the module says what was archived and offers "ביטול", which restores it
// where a restore exists (D-371). The line lives in the module, not in the workspace's toast, because the module's drawer
// stands over the toast on a phone. A refusal goes to the module's own failure notice.

const WORD = ' '

export interface ArchiveStepOptions<Row> {
  readonly nameOf: (row: Row) => string
  /** The question, and what archiving this kind of row hides. */
  readonly titleKey: I18nKey
  readonly bodyKey: I18nKey
  readonly archive: { readonly run: (row: Row) => Promise<Result<Row>>; readonly isPending: boolean }
  /** NULL where nothing archived of this kind comes back (OI-320): the line then has no "ביטול". */
  readonly restore: { readonly run: (row: Row) => Promise<Result<Row>> } | null
  /** Where a refusal shows: the module's failure notice. */
  readonly onFailure: (error: AppError) => void
}

export interface ArchiveStep<Row> {
  /** Asks to archive the row. */
  readonly ask: (row: Row) => void
  /** The question, while it is asked. */
  readonly dialog: ReactNode
  /** The line that says what was archived, with "ביטול"; NULL when there is none. */
  readonly notice: ReactNode
}

interface Done<Row> {
  readonly row: Row
  readonly name: string
  /** A restore was refused: its words replace the line's. */
  readonly refusal: I18nKey | null
}

export function useArchiveStep<Row>({ nameOf, titleKey, bodyKey, archive, restore, onFailure }: ArchiveStepOptions<Row>): ArchiveStep<Row> {
  const [asking, setAsking] = useState<Row | null>(null)
  const [done, setDone] = useState<Done<Row> | null>(null)
  const ask = (row: Row) => {
    setDone(null)
    setAsking(row)
  }
  const dialog =
    asking === null ? null : (
      <SmallDialog
        role="alertdialog"
        titleKey={titleKey}
        hintKey={bodyKey}
        confirmKey="manage.archive.confirm"
        tone="danger"
        isPending={archive.isPending}
        onCancel={() => {
          setAsking(null)
        }}
        onConfirm={() => {
          const name = nameOf(asking)
          void archive.run(asking).then((result) => {
            setAsking(null)
            if (!result.ok) {
              onFailure(result.error)
              return
            }
            setDone({ row: result.value, name, refusal: null })
          })
        }}
      >
        <p className="text-body font-semibold">{nameOf(asking)}</p>
      </SmallDialog>
    )
  const notice =
    done === null ? null : (
      <div role="status" className="flex min-h-touch items-center gap-sm rounded-control bg-inner ps-md pe-xs">
        <span className="min-w-none flex-1 truncate text-body">
          {done.refusal === null ? [done.name, t('manage.archive.done')].join(WORD) : t(done.refusal)}
        </span>
        {restore === null || done.refusal !== null ? null : (
          <AriaButton
            onPress={() => {
              void restore.run(done.row).then((restored) => {
                if (restored.ok) setDone(null)
                else setDone({ ...done, refusal: restoreFailureKey(restored.error) })
              })
            }}
            className="inline-flex min-h-touch shrink-0 cursor-pointer items-center rounded-full px-md text-body font-bold text-text outline-focus outline-offset-2 data-focus-visible:outline-2"
          >
            {t('common.cancel')}
          </AriaButton>
        )}
        <AriaButton
          aria-label={t('common.close')}
          onPress={() => {
            setDone(null)
          }}
          className="inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          <X aria-hidden size={16} />
        </AriaButton>
      </div>
    )
  return { ask, dialog, notice }
}
