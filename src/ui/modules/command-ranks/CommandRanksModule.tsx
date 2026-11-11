import { NEW_ENTITY, PANEL_IDS } from '@config'
import type { AppError, CommandRank } from '@contracts'
import { t } from '@i18n'
import {
  liveRanks,
  nextSeniority,
  rankFormIssues,
  useCommandRankCommands,
  useCommandRankPermissions,
  useCommandRanks,
  usePanel,
} from '@logic'
import { useForm } from '@tanstack/react-form'
import { Archive, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EntityForm } from '../../patterns/EntityForm'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { CLEAN_FORM, fieldError, formStateOf, validatorResult } from '../../patterns/forms'
import { Button } from '../../primitives/Button'
import { ColorField } from '../../primitives/ColorField'
import { TextField } from '../../primitives/fields'
import { swatchClassOf } from '../../theme/palette'

// The ranks panel: most senior first. Seniority is a number on the form, and the number is the order
// (D-095).

const RANK_FIELDS: readonly string[] = ['title', 'short_title', 'seniority', 'color_key']

function RankForm({
  rank,
  firstSeniority,
  onReload,
}: {
  readonly rank: CommandRank | null
  readonly firstSeniority: number
  readonly onReload: () => void
}) {
  const panel = usePanel()
  const { create, update } = useCommandRankCommands()
  const [opened] = useState(rank)
  const [state, setState] = useState(CLEAN_FORM)
  const backToList = () => {
    panel.open(PANEL_IDS.commandRanks)
  }

  const form = useForm({
    defaultValues: {
      title: opened?.title ?? '',
      short_title: opened?.short_title ?? '',
      seniority: String(opened?.seniority ?? firstSeniority),
      color_key: opened?.color_key ?? null,
    },
    validators: { onSubmit: ({ value }) => validatorResult(rankFormIssues(value)) },
    onSubmit: async ({ value }) => {
      setState(CLEAN_FORM)
      const result =
        opened === null
          ? await create.run(value)
          : await update.run({ rank: opened, openedVersion: opened.version, values: value })
      if (result.ok) backToList()
      else setState(formStateOf(result.error, RANK_FIELDS))
    },
  })

  return (
    <EntityForm
      titleKey={opened === null ? 'commandRanks.newTitle' : 'commandRanks.editTitle'}
      submitKey={opened === null ? 'common.create' : 'common.save'}
      isPending={create.isPending || update.isPending}
      failure={state.failure}
      onReload={onReload}
      onCancel={backToList}
      onSubmit={() => {
        void form.handleSubmit()
      }}
    >
      <form.Field name="title">
        {(field) => (
          <TextField
            labelKey="commandRanks.name"
            name={field.name}
            isRequired
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="short_title">
        {(field) => (
          <TextField
            labelKey="commandRanks.shortTitle"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <form.Field name="seniority">
        {(field) => (
          <TextField
            labelKey="commandRanks.seniority"
            name={field.name}
            isRequired
            inputMode="numeric"
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
      <p className="text-name text-text-muted">{t('commandRanks.seniorityHint')}</p>
      <form.Field name="color_key">
        {(field) => (
          <ColorField
            labelKey="palette.label"
            name={field.name}
            value={field.state.value}
            onChange={field.handleChange}
            error={fieldError(field.state.meta.errors, field.name, state.answered)}
          />
        )}
      </form.Field>
    </EntityForm>
  )
}

function RankEditor({ rank, firstSeniority }: { readonly rank: CommandRank | null; readonly firstSeniority: number }) {
  // A new generation opens the latest row, after someone else changed it.
  const [generation, setGeneration] = useState(0)
  return (
    <RankForm
      key={generation}
      rank={rank}
      firstSeniority={firstSeniority}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

function RankRow({ rank, canUpdate, actions }: { readonly rank: CommandRank; readonly canUpdate: boolean; readonly actions: readonly RowAction[] }) {
  const panel = usePanel()
  const color = swatchClassOf(rank.color_key)
  const text = (
    <span className="flex min-w-none flex-col">
      <span className="truncate text-name font-semibold">{rank.title}</span>
      <span className="truncate text-micro text-text-muted">
        {t('commandRanks.seniority')} {rank.seniority}
      </span>
    </span>
  )
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      {color === null ? null : <span aria-hidden className={`ms-xs size-dot shrink-0 rounded-pill ${color}`} />}
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.commandRanks, { entity: rank.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {text}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{text}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

export function CommandRanksModule() {
  const panel = usePanel()
  const ranks = useCommandRanks()
  const permissions = useCommandRankPermissions()
  const commands = useCommandRankCommands()
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<CommandRank | null>(null)

  if (ranks.status === 'failed') return <FailureNotice error={ranks.error} />
  if (ranks.status === 'loading') return <LoadingNotice />

  const live = liveRanks(ranks.value)
  const firstSeniority = nextSeniority(live)
  const newRank = () => {
    setFailure(null)
    panel.open(PANEL_IDS.commandRanks, { entity: NEW_ENTITY })
  }

  // A deep link opens only what the actor may use; anything else reads as not found (D-076).
  if (panel.entity === NEW_ENTITY && permissions.create) return <RankEditor rank={null} firstSeniority={firstSeniority} />
  if (panel.entity !== null) {
    const rank = live.find((candidate) => candidate.id === panel.entity)
    if (rank === undefined || !permissions.update) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('commandRanks.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.commandRanks)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <RankEditor key={rank.id} rank={rank} firstSeniority={firstSeniority} />
  }

  if (live.length === 0) {
    return (
      <EmptyNotice titleKey="commandRanks.emptyTitle" bodyKey={permissions.create ? 'commandRanks.emptyBody' : 'commandRanks.emptyReadOnly'}>
        {permissions.create ? (
          <Button variant="primary" onPress={newRank}>
            <Plus aria-hidden size={14} />
            {t('commandRanks.new')}
          </Button>
        ) : null}
      </EmptyNotice>
    )
  }

  const actionsOf = (rank: CommandRank): RowAction[] =>
    permissions.archive
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive',
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(rank)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-md">
      <p className="text-name text-text-muted">{t('commandRanks.hint')}</p>
      {failure === null ? null : <FailureNotice error={failure} />}
      <ul aria-label={t('commandRanks.listLabel')} className="flex flex-col">
        {live.map((rank) => (
          <RankRow key={rank.id} rank={rank} canUpdate={permissions.update} actions={actionsOf(rank)} />
        ))}
      </ul>
      {permissions.create ? (
        <div>
          <Button onPress={newRank}>
            <Plus aria-hidden size={14} />
            {t('commandRanks.new')}
          </Button>
        </div>
      ) : null}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="commandRanks.archiveTitle"
          hintKey="commandRanks.archiveBody"
          confirmKey="common.archive"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(null)
          }}
          onConfirm={() => {
            void commands.archive.run(archiving).then((result) => {
              setArchiving(null)
              if (!result.ok) setFailure(result.error)
            })
          }}
        />
      )}
    </div>
  )
}
