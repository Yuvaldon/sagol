import type { AppError, CommentVisibility, Leave, LeaveComment, LeaveEvent, LeaveType, SoldierId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import {
  useCurrentOrganization,
  useIsOwnComment,
  useLeaveActions,
  useLeaveCommentCommands,
  useLeaveThread,
  type ThreadEntry,
} from '@logic'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ActionMenu } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate, formatInstant } from '../../patterns/dates'
import { Button } from '../../primitives/Button'
import { SwitchField } from '../../primitives/SwitchField'
import { TextAreaField } from '../../primitives/TextAreaField'
import { typeNameOf } from './leaveText'

// The one thread of a leave (D-119): what happened to it and what was written about it, oldest first, with the
// comment box under it. An internal comment carries a label, and only its author has its menu (D-118).

const ARROW = ' ← '
const LABEL_SEPARATOR = ': '

/** What each event says. A leave created as approved, and an edit that cost the approval, say so. */
function eventTitle(event: LeaveEvent): string {
  const keys: Record<LeaveEvent['event_type'], I18nKey> = {
    created: event.to_status === 'approved' ? 'leaves.eventCreatedApproved' : 'leaves.eventCreated',
    approved: 'leaves.eventApproved',
    rejected: 'leaves.eventRejected',
    cancelled: 'leaves.eventCancelled',
    reopened: 'leaves.eventReopened',
    updated: 'leaves.eventUpdated',
    rescheduled: 'leaves.eventRescheduled',
  }
  return t(keys[event.event_type])
}

/** The columns an edit can change on screen, in the order they are read, each with how its value is written. */
function changeLines(event: LeaveEvent, types: readonly LeaveType[]): string[] {
  const typeName = (value: unknown) => typeNameOf(types.find((type) => type.id === value) ?? null)
  const day = (value: unknown) => (typeof value === 'string' ? formatDate(value, 'dayMonth') : t('leaves.emptyValue'))
  const text = (value: unknown) => (typeof value === 'string' ? value : t('leaves.emptyValue'))
  const columns: readonly (readonly [string, I18nKey, (value: unknown) => string])[] = [
    ['start_date', 'leaves.from', day],
    ['end_date', 'leaves.to', day],
    ['leave_type_id', 'leaves.type', typeName],
    ['reason', 'leaves.reason', text],
  ]
  return columns.flatMap(([column, labelKey, write]) => {
    const change = event.changes[column]
    return change === undefined ? [] : [`${t(labelKey)}${LABEL_SEPARATOR}${write(change.before)}${ARROW}${write(change.after)}`]
  })
}

function EntryHeader({ title, entry, timezone }: { readonly title: string; readonly entry: ThreadEntry; readonly timezone: string | null }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-sm">
      <span className="text-name font-semibold">{title}</span>
      {timezone === null ? null : <span className="text-micro text-text-muted tabular-nums">{formatInstant(entry.at, timezone)}</span>}
    </span>
  )
}

function CommentDialogs({
  leave,
  comment,
  mode,
  onClose,
}: {
  readonly leave: Leave
  readonly comment: LeaveComment
  readonly mode: 'edit' | 'delete'
  readonly onClose: () => void
}) {
  const commands = useLeaveCommentCommands(leave.id)
  const [body, setBody] = useState(comment.body)
  const [failure, setFailure] = useState<AppError | null>(null)

  async function confirm() {
    setFailure(null)
    const result = mode === 'edit' ? await commands.edit.run({ comment, body }) : await commands.archive.run(comment)
    if (result.ok) onClose()
    else setFailure(result.error)
  }

  const shared = {
    isPending: commands.edit.isPending || commands.archive.isPending,
    onCancel: onClose,
    onConfirm: () => {
      void confirm()
    },
  }
  if (mode === 'delete') {
    return (
      <SmallDialog role="alertdialog" titleKey="leaves.commentDeleteTitle" hintKey="leaves.commentDeleteHint" confirmKey="leaves.commentDeleteConfirm" {...shared}>
        {failure === null ? null : <FailureNotice error={failure} />}
      </SmallDialog>
    )
  }
  return (
    <SmallDialog titleKey="leaves.commentEditTitle" confirmKey="common.save" {...shared}>
      <TextAreaField labelKey="leaves.commentBody" name="body" value={body} onChange={setBody} error={null} />
      {failure === null ? null : <FailureNotice error={failure} />}
    </SmallDialog>
  )
}

function CommentBox({ leave, may }: { readonly leave: Leave; readonly may: Record<CommentVisibility, boolean> }) {
  const { add } = useLeaveCommentCommands(leave.id)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [failure, setFailure] = useState<AppError | null>(null)
  if (!may.shared && !may.internal) return null
  // Whoever may write only one kind writes that kind.
  const visibility: CommentVisibility = may.internal && (internal || !may.shared) ? 'internal' : 'shared'

  async function submit() {
    setFailure(null)
    const result = await add.run({ body, visibility })
    if (result.ok) setBody('')
    else setFailure(result.error)
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-sm"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <TextAreaField labelKey="leaves.commentLabel" name="comment" value={body} onChange={setBody} error={null} />
      {failure === null ? null : <FailureNotice error={failure} />}
      <div className="flex flex-wrap items-center justify-between gap-sm">
        {may.shared && may.internal ? (
          <SwitchField labelKey="leaves.commentInternal" name="internal" value={internal} onChange={setInternal} />
        ) : (
          <span className="text-label text-text-muted">{visibility === 'internal' ? t('leaves.commentInternal') : null}</span>
        )}
        <Button type="submit" isDisabled={add.isPending || body.trim() === ''}>
          {t('leaves.commentAdd')}
        </Button>
      </div>
    </form>
  )
}

export function LeaveThread({
  leave,
  types,
  nameOf,
}: {
  readonly leave: Leave
  readonly types: readonly LeaveType[]
  readonly nameOf: (id: SoldierId | null) => string
}) {
  const thread = useLeaveThread(leave.id)
  const actions = useLeaveActions(leave)
  const isOwn = useIsOwnComment()
  const organization = useCurrentOrganization()
  const timezone = organization.status === 'ready' && organization.value !== null ? organization.value.timezone : null
  const [dialog, setDialog] = useState<{ readonly comment: LeaveComment; readonly mode: 'edit' | 'delete' } | null>(null)

  return (
    <section className="flex flex-col gap-md">
      <h3 id="leave-thread" className="text-body font-bold">
        {t('leaves.threadTitle')}
      </h3>
      {thread.status === 'failed' ? <FailureNotice error={thread.error} /> : null}
      {thread.status === 'loading' ? <LoadingNotice /> : null}
      {thread.status === 'ready' ? (
        <ol aria-labelledby="leave-thread" className="flex flex-col">
          {thread.value.map((entry) => (
            <li key={entry.key} className="flex items-start justify-between gap-sm border-b border-line py-sm">
              {entry.kind === 'event' ? (
                <div className="flex min-w-none flex-col gap-2xs">
                  <EntryHeader title={eventTitle(entry.event)} entry={entry} timezone={timezone} />
                  {changeLines(entry.event, types).map((line) => (
                    <span key={line} className="text-micro text-text-muted">
                      {line}
                    </span>
                  ))}
                  {entry.event.event_type !== 'reopened' && entry.event.from_status === 'approved' && entry.event.to_status === 'pending' ? (
                    <span className="text-micro text-status-pending-text">{t('leaves.eventBackToPending')}</span>
                  ) : null}
                  <span className="text-micro text-text-muted">{nameOf(entry.actorId)}</span>
                </div>
              ) : (
                <>
                  <div className="flex min-w-none flex-col gap-2xs">
                    <EntryHeader title={nameOf(entry.actorId)} entry={entry} timezone={timezone} />
                    <p className="text-name break-words whitespace-pre-wrap">{entry.comment.body}</p>
                    <span className="flex gap-sm text-micro text-text-muted">
                      {entry.comment.visibility === 'internal' ? (
                        <span className="rounded-pill border border-line px-sm font-semibold">{t('leaves.internalTag')}</span>
                      ) : null}
                      {entry.comment.edited_at === null ? null : <span>{t('leaves.commentEdited')}</span>}
                    </span>
                  </div>
                  {isOwn(entry.comment) ? (
                    <ActionMenu
                      labelKey="leaves.commentActions"
                      actions={[
                        {
                          id: 'edit',
                          labelKey: 'leaves.commentEdit',
                          icon: <Pencil aria-hidden size={14} />,
                          onAction: () => {
                            setDialog({ comment: entry.comment, mode: 'edit' })
                          },
                        },
                        {
                          id: 'delete',
                          labelKey: 'leaves.commentDelete',
                          icon: <Trash2 aria-hidden size={14} />,
                          onAction: () => {
                            setDialog({ comment: entry.comment, mode: 'delete' })
                          },
                        },
                      ]}
                    />
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      <CommentBox leave={leave} may={actions.comment} />
      {dialog === null ? null : (
        <CommentDialogs
          leave={leave}
          comment={dialog.comment}
          mode={dialog.mode}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
    </section>
  )
}
