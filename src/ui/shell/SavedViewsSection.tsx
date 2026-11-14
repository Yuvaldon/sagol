import { DEFAULT_RANGE_KIND, type RangeKind, type ViewId } from '@config'
import { IssueCode, SAVED_VIEW_LIMITS, type SavedView, type SavedViewId } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { applyView, savedViewNameIssue, savedViewSummary, useWorkspaceSearch, type SavedViewsState } from '@logic'
import { ArrowDown, ArrowLeft, ArrowUp, Bookmark, BookmarkCheck, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button as AriaButton, Label, Radio, RadioGroup } from 'react-aria-components'
import { engineOf } from '../engines/registry'
import { issueKey } from '../errors/messages'
import { SmallDialog } from '../patterns/Dialogs'
import { Button, IconButton } from '../primitives/Button'
import { RadioList } from '../primitives/ChoiceList'
import { TextField } from '../primitives/fields'
import { SwitchField } from '../primitives/SwitchField'
import { useReportPreferenceSave } from './preferenceFailure'
import { useSavedViewNotice } from './savedViewNotice'

// The soldier's saved views, only inside the view sheet (D-387): the cards once one is saved, the save action beside
// focus mode while the board matches none, and the manage list in place of the sheet's body.

const CARD =
  'flex min-h-touch cursor-pointer flex-col items-start justify-center gap-2xs rounded-panel border border-line p-md text-start text-control text-text outline-focus outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner data-selected:border-action-solid data-selected:bg-inner'
const ACTION =
  'flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control text-text outline-focus outline-offset-2 md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner'
const LABEL = 'text-label font-semibold text-text-muted'

const RANGE_LABELS: Record<RangeKind, I18nKey> = {
  day: 'workspace.ranges.day',
  week: 'workspace.ranges.week',
  two_weeks: 'workspace.ranges.two_weeks',
  four_weeks: 'workspace.ranges.four_weeks',
  month: 'workspace.ranges.month',
  rotation: 'workspace.rotations',
}

function rangeLabel(range: RangeKind | undefined): string {
  return t(RANGE_LABELS[range ?? DEFAULT_RANGE_KIND])
}

/** "שבוע · 3 תנאים": the range kind, and the conditions when there are any (D-387). */
function metaOf(view: SavedView): string {
  const { range, conditions } = savedViewSummary(view.query)
  if (conditions === 0) return rangeLabel(range)
  const count = conditions === 1 ? t('workspace.savedViews.oneCondition') : `${String(conditions)} ${t('workspace.savedViews.conditions')}`
  return `${rangeLabel(range)} · ${count}`
}

function maxHint(): string {
  return `${t('workspace.savedViews.maxHint')} ${String(SAVED_VIEW_LIMITS.max)} ${t('workspace.savedViews.maxHintUnit')}`
}

function nameErrorOf(code: IssueCode | null): I18nKey | null {
  if (code === null) return null
  return code === IssueCode.enum.duplicate_item ? 'workspace.savedViews.duplicateName' : issueKey(code)
}

export interface SavedViewCardsProps {
  readonly saved: SavedViewsState
  /** The view the board shows: a stored view without one shows its icon. */
  readonly shown: ViewId
  readonly onManage: () => void
  readonly onClose: () => void
}

/** "התצוגות שלי": one card per saved view, the current one selected; absent until one is saved (D-076). */
export function SavedViewCards({ saved, shown, onManage, onClose }: SavedViewCardsProps) {
  const notice = useSavedViewNotice()
  if (saved.views.length === 0) return null
  const open = (view: SavedView) => {
    const applied = saved.apply(view)
    notice.show(applied.dropped ? { id: view.id, cleaned: applied.cleaned } : null)
    onClose()
  }
  return (
    <div className="flex flex-col gap-xs">
      <RadioGroup
        value={saved.current?.id ?? null}
        onChange={(key) => {
          const view = saved.views.find((candidate) => candidate.id === key)
          if (view !== undefined) open(view)
        }}
        className="flex flex-col gap-xs"
      >
        <Label className={LABEL}>{t('workspace.savedViews.mine')}</Label>
        <div className="grid grid-cols-2 gap-sm">
          {saved.views.map((view) => {
            const { Icon } = engineOf(applyView(view.query).search.view ?? shown)
            return (
              <Radio
                key={view.id}
                value={view.id}
                // The current card changes nothing, so its press only closes the sheet, as the view cards do (D-311).
                onPress={() => {
                  if (view.id === saved.current?.id) onClose()
                }}
                className={CARD}
              >
                <span className="flex w-full items-center gap-xs">
                  <Icon aria-hidden size={16} className="shrink-0" />
                  <span className="min-w-none flex-1 truncate font-semibold">{view.name}</span>
                  {view.id === saved.startViewId ? (
                    <span className="shrink-0 rounded-pill bg-line px-xs text-micro text-text-muted">{t('workspace.savedViews.startMark')}</span>
                  ) : null}
                </span>
                <span className="text-label text-text-muted">{metaOf(view)}</span>
              </Radio>
            )
          })}
        </div>
      </RadioGroup>
      <AriaButton onPress={onManage} className={ACTION}>
        <Pencil aria-hidden size={16} />
        <span className="flex-1 text-start">{t('workspace.savedViews.manage')}</span>
      </AriaButton>
    </div>
  )
}

export interface SaveViewActionProps {
  readonly saved: SavedViewsState
  readonly shown: ViewId
  readonly onManage: () => void
}

/**
 * "שמירת התצוגה הנוכחית", while the board matches no saved view; at the limit it says so and opens the list (D-387).
 * After a change that left a saved view, "שמירת השינויים" beside it saves the board over that view, under its name (D-442).
 */
export function SaveViewAction({ saved, shown, onManage }: SaveViewActionProps) {
  const [saving, setSaving] = useState(false)
  const reportSave = useReportPreferenceSave()
  const { range } = useWorkspaceSearch()
  if (saved.current !== null) return null
  const { left } = saved
  return (
    <>
      {left === null ? null : (
        <AriaButton
          onPress={() => {
            reportSave(saved.overwrite(left.id))
          }}
          className={ACTION}
        >
          <BookmarkCheck aria-hidden size={16} />
          <span className="flex flex-1 flex-col text-start">
            {t('workspace.savedViews.overwrite')}
            <span className="text-label text-text-muted">{left.name}</span>
          </span>
        </AriaButton>
      )}
      <AriaButton
        onPress={() => {
          if (saved.full) onManage()
          else setSaving(true)
        }}
        className={ACTION}
      >
        <Bookmark aria-hidden size={16} />
        <span className="flex flex-1 flex-col text-start">
          {t('workspace.savedViews.save')}
          {saved.full ? (
            <span className="text-label text-text-muted">{maxHint()}</span>
          ) : null}
        </span>
      </AriaButton>
      {saving ? (
        <SaveViewDialog
          saved={saved}
          suggestion={`${t(engineOf(shown).labelKey)} · ${rangeLabel(range)}`}
          onClose={() => {
            setSaving(false)
          }}
        />
      ) : null}
    </>
  )
}

function SaveViewDialog({ saved, suggestion, onClose }: { readonly saved: SavedViewsState; readonly suggestion: string; readonly onClose: () => void }) {
  const reportSave = useReportPreferenceSave()
  const [name, setName] = useState(suggestion)
  const [start, setStart] = useState(false)
  const [error, setError] = useState<I18nKey | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <SmallDialog
      titleKey="workspace.savedViews.newTitle"
      confirmKey="common.save"
      isPending={pending}
      onCancel={onClose}
      onConfirm={() => {
        const issue = nameErrorOf(savedViewNameIssue(saved.views, name, null))
        setError(issue)
        if (issue !== null) return
        setPending(true)
        void saved.save(name, start).then((result) => {
          setPending(false)
          if (!result.ok && result.error.code === 'validation_failed') {
            setError(nameErrorOf(result.error.issues[0]?.code ?? null))
            return
          }
          reportSave(Promise.resolve(result))
          onClose()
        })
      }}
    >
      <TextField labelKey="workspace.savedViews.name" name="name" value={name} onChange={setName} error={error} isRequired />
      <SwitchField labelKey="workspace.savedViews.openWith" name="start" value={start} onChange={setStart} />
    </SmallDialog>
  )
}

interface Renaming {
  readonly id: SavedViewId
  readonly name: string
  readonly error: I18nKey | null
}

/** "ניהול התצוגות": rename, move, delete and the start view, in place of the sheet's body (D-387). */
export function ManageSavedViews({ saved, onBack }: { readonly saved: SavedViewsState; readonly onBack: () => void }) {
  const reportSave = useReportPreferenceSave()
  const [renaming, setRenaming] = useState<Renaming | null>(null)
  const [deleting, setDeleting] = useState<SavedView | null>(null)
  const views = saved.views
  return (
    <div className="flex flex-col gap-lg">
      <AriaButton onPress={onBack} className={ACTION}>
        <ArrowLeft aria-hidden size={16} className="rotate-180" />
        <span className="flex-1 text-start">{t('workspace.savedViews.manageBack')}</span>
      </AriaButton>
      <ul aria-label={t('workspace.savedViews.manage')} className="flex flex-col gap-xs">
        {views.map((view, index) => (
          <li key={view.id} className="flex flex-col gap-xs rounded-control border border-line p-sm">
            {renaming?.id === view.id ? (
              <form
                className="flex flex-col gap-xs"
                onSubmit={(event) => {
                  event.preventDefault()
                  const error = nameErrorOf(savedViewNameIssue(views, renaming.name, view.id))
                  if (error !== null) {
                    setRenaming({ ...renaming, error })
                    return
                  }
                  reportSave(saved.rename(view.id, renaming.name))
                  setRenaming(null)
                }}
              >
                <TextField
                  labelKey="workspace.savedViews.name"
                  name="name"
                  value={renaming.name}
                  onChange={(name) => {
                    setRenaming({ ...renaming, name, error: null })
                  }}
                  error={renaming.error}
                  isRequired
                />
                <div className="flex justify-end gap-sm">
                  <Button
                    onPress={() => {
                      setRenaming(null)
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" type="submit">
                    {t('common.save')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2xs">
                <span className="min-w-none flex-1 truncate text-control font-semibold">{view.name}</span>
                {index > 0 ? (
                  <IconButton
                    labelKey="common.stepUp"
                    onPress={() => {
                      reportSave(saved.move(view.id, -1))
                    }}
                  >
                    <ArrowUp aria-hidden size={14} />
                  </IconButton>
                ) : null}
                {index < views.length - 1 ? (
                  <IconButton
                    labelKey="common.stepDown"
                    onPress={() => {
                      reportSave(saved.move(view.id, 1))
                    }}
                  >
                    <ArrowDown aria-hidden size={14} />
                  </IconButton>
                ) : null}
                <IconButton
                  labelKey="workspace.savedViews.rename"
                  onPress={() => {
                    setRenaming({ id: view.id, name: view.name, error: null })
                  }}
                >
                  <Pencil aria-hidden size={14} />
                </IconButton>
                <IconButton
                  labelKey="workspace.savedViews.delete"
                  onPress={() => {
                    setDeleting(view)
                  }}
                >
                  <Trash2 aria-hidden size={14} />
                </IconButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      <RadioList
        label={{ key: 'workspace.savedViews.startView' }}
        noneKey="workspace.savedViews.noStartView"
        choices={views.map((view) => ({ key: view.id, label: { text: view.name } }))}
        selected={saved.startViewId}
        onChange={(key) => {
          reportSave(saved.setStart(views.find((view) => view.id === key)?.id ?? null))
        }}
      />
      {deleting === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="workspace.savedViews.deleteTitle"
          hintKey="workspace.savedViews.deleteHint"
          confirmKey="workspace.savedViews.delete"
          isPending={false}
          onCancel={() => {
            setDeleting(null)
          }}
          onConfirm={() => {
            reportSave(saved.remove(deleting.id))
            setDeleting(null)
            if (views.length === 1) onBack()
          }}
        >
          <p className="text-name font-semibold">{deleting.name}</p>
        </SmallDialog>
      )}
    </div>
  )
}
