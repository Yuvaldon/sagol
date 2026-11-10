import { NEW_ENTITY, PANEL_IDS } from '@config'
import { RuleEnforcement, type AppError, type AvailabilityRule, type CalendarDate, type UnitId } from '@contracts'
import { t } from '@i18n'
import {
  liveRules,
  useAvailabilityRules,
  useCommandRanks,
  useDateWindow,
  useDayViolations,
  usePanel,
  useRuleCommands,
  useRuleConflicts,
  useRulePermissions,
  useRulesDay,
  useTagCategories,
  useTags,
  useUnitLevels,
  useUnitsWithArchived,
  useViewFilter,
  type WindowConflict,
} from '@logic'
import { Archive, Plus, X } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Button as AriaButton, Heading } from 'react-aria-components'
import { ActionMenu, type RowAction } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { formatDate } from '../../patterns/dates'
import { Button, IconButton } from '../../primitives/Button'
import { RuleForm, type RuleFormProps } from './RuleForm'
import { RuleViolations } from '../../patterns/rules/RuleViolations'
import { boundText, ruleSummary, useRuleNames } from '../../patterns/rules/ruleText'

// The rules drawer (D-140, D-141): the broken rules of a day pressed on the heat row, the configuration conflicts on
// the board's days, and the rules themselves, by priority then name.

const PART_SEPARATOR = ' · '
const NAME_SEPARATOR = ', '
const DATE_SEPARATOR = ', '

function Section({ title, hint, actions, children }: { readonly title: string; readonly hint?: string; readonly actions?: ReactNode; readonly children: ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm">
        <Heading id={headingId} level={3} className="text-label font-semibold text-text-muted">
          {title}
        </Heading>
        {actions}
      </div>
      {hint === undefined ? null : <p className="text-micro text-text-muted">{hint}</p>}
      {children}
    </section>
  )
}

/** The day pressed on the heat row, for the board's unit (D-141). */
function DaySection({ day, unitId, onClose }: { readonly day: CalendarDate; readonly unitId: UnitId | null; readonly onClose: () => void }) {
  const violations = useDayViolations(day, unitId)
  return (
    <Section
      title={[t('rules.dayTitle'), formatDate(day, 'dayMonth')].join(PART_SEPARATOR)}
      actions={
        <IconButton labelKey="rules.closeDay" onPress={onClose}>
          <X aria-hidden size={14} />
        </IconButton>
      }
    >
      {violations.status === 'failed' ? <FailureNotice error={violations.error} /> : null}
      {violations.status === 'loading' ? <LoadingNotice /> : null}
      {violations.status === 'ready' && violations.value.length === 0 ? <p className="text-name text-text-muted">{t('rules.dayNone')}</p> : null}
      {violations.status === 'ready' && violations.value.length > 0 ? <RuleViolations violations={violations.value} /> : null}
    </Section>
  )
}

function ConflictsSection({ conflicts }: { readonly conflicts: readonly WindowConflict[] }) {
  const names = useRuleNames()
  return (
    <Section title={t('rules.conflictsTitle')} hint={t('rules.conflictsHint')}>
      {conflicts.length === 0 ? (
        <p className="text-name text-text-muted">{t('rules.noConflicts')}</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {conflicts.map((conflict) => (
            <li
              key={JSON.stringify([conflict.scope_unit_id, conflict.group, conflict.rule_ids, conflict.days])}
              className="flex flex-col gap-xs rounded-control border border-status-rejected p-sm text-micro"
            >
              <span className="text-name font-semibold">{conflict.rule_ids.map(names.rule).join(NAME_SEPARATOR)}</span>
              <span className="text-text-muted">
                {[names.unit(conflict.scope_unit_id), ...(conflict.group === null ? [] : [names.group(conflict.group)])].join(PART_SEPARATOR)}
              </span>
              <span className="tabular-nums">
                {[
                  boundText('rules.requiresAtLeast', conflict.required_min, false),
                  boundText('rules.allowsAtMost', conflict.allowed_max, false),
                ].join(' ')}
              </span>
              <span className="tabular-nums text-text-muted">{conflict.days.map((day) => formatDate(day, 'dayMonth')).join(DATE_SEPARATOR)}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function RuleRow({ rule, canUpdate, actions }: { readonly rule: AvailabilityRule; readonly canUpdate: boolean; readonly actions: readonly RowAction[] }) {
  const panel = usePanel()
  const names = useRuleNames()
  const hard = rule.enforcement === RuleEnforcement.enum.hard
  const content = (
    <span className="flex min-w-none flex-col gap-2xs">
      <span className="flex items-center gap-sm">
        <span className="min-w-none truncate text-name font-semibold">{rule.name}</span>
        <span
          className={`shrink-0 rounded-pill px-sm text-micro font-semibold ${hard ? 'bg-status-rejected text-on-action' : 'border border-dashed border-status-pending text-status-pending-text'}`}
        >
          {t(hard ? 'rules.hard' : 'rules.soft')}
        </span>
        {rule.is_enabled ? null : <span className="shrink-0 rounded-pill bg-inner px-sm text-micro text-text-muted">{t('rules.disabled')}</span>}
      </span>
      <span className="text-micro text-text-muted">{ruleSummary(rule, names)}</span>
    </span>
  )
  return (
    <li className="flex items-center gap-2xs border-b border-line bg-surface">
      {canUpdate ? (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.rules, { entity: rule.id })
          }}
          className="flex min-h-touch min-w-none flex-1 cursor-pointer items-center rounded-control p-xs text-start outline-focus md:min-h-control data-focus-visible:outline-2 data-hovered:bg-inner"
        >
          {content}
        </AriaButton>
      ) : (
        <span className="flex min-h-touch min-w-none flex-1 items-center p-xs md:min-h-control">{content}</span>
      )}
      <ActionMenu labelKey="common.actions" actions={actions} />
    </li>
  )
}

function RuleEditor(props: Omit<RuleFormProps, 'onReload'>) {
  const [generation, setGeneration] = useState(0)
  return (
    <RuleForm
      key={generation}
      {...props}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
    />
  )
}

export function RulesModule() {
  const panel = usePanel()
  const rules = useAvailabilityRules()
  const units = useUnitsWithArchived()
  const levels = useUnitLevels()
  const categories = useTagCategories()
  const tags = useTags()
  const ranks = useCommandRanks()
  const { window } = useDateWindow()
  const { unit } = useViewFilter()
  const rulesDay = useRulesDay()
  const conflicts = useRuleConflicts(window)
  const commands = useRuleCommands()
  const liveUnits = useMemo(() => (units.status === 'ready' ? units.value.filter((row) => row.archived_at === null) : NO_ROWS), [units])
  const live = useMemo(() => (rules.status === 'ready' ? liveRules(rules.value) : NO_ROWS), [rules])
  const permissions = useRulePermissions(liveUnits, live)
  const [failure, setFailure] = useState<AppError | null>(null)
  const [archiving, setArchiving] = useState<AvailabilityRule | null>(null)

  for (const loaded of [rules, units, levels, categories, tags, ranks]) {
    if (loaded.status === 'failed') return <FailureNotice error={loaded.error} />
  }
  if (
    rules.status !== 'ready' ||
    units.status !== 'ready' ||
    levels.status !== 'ready' ||
    categories.status !== 'ready' ||
    tags.status !== 'ready' ||
    ranks.status !== 'ready'
  ) {
    return <LoadingNotice />
  }

  const formProps = {
    units: units.value,
    levels: levels.value,
    categories: categories.value,
    tags: tags.value,
    ranks: ranks.value,
  }
  if (panel.entity === NEW_ENTITY) return <RuleEditor rule={null} placeable={permissions.createIn} {...formProps} />
  if (panel.entity !== null) {
    const rule = live.find((candidate) => candidate.id === panel.entity)
    if (rule === undefined) {
      return (
        <div className="flex flex-col items-center gap-md py-xl text-center">
          <p className="text-name text-text-muted">{t('rules.notFound')}</p>
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.rules)
            }}
          >
            {t('common.backToList')}
          </Button>
        </div>
      )
    }
    return <RuleEditor key={rule.id} rule={rule} placeable={permissions.moveTo} {...formProps} />
  }

  const newRule = () => {
    setFailure(null)
    panel.open(PANEL_IDS.rules, { entity: NEW_ENTITY })
  }
  const actionsOf = (rule: AvailabilityRule): RowAction[] =>
    permissions.archive(rule)
      ? [
          {
            id: 'archive',
            labelKey: 'common.archive',
            icon: <Archive aria-hidden size={14} />,
            onAction: () => {
              setFailure(null)
              setArchiving(rule)
            },
          },
        ]
      : []

  return (
    <div className="flex flex-col gap-xl">
      {rulesDay.day === null ? null : (
        <DaySection day={rulesDay.day} unitId={unit.kind === 'unit' ? unit.unitId : null} onClose={rulesDay.open} />
      )}
      {live.length === 0 ? (
        <EmptyNotice titleKey="rules.emptyTitle" bodyKey={permissions.createAny ? 'rules.emptyBody' : 'rules.emptyReadOnly'}>
          {permissions.createAny ? (
            <Button variant="primary" onPress={newRule}>
              <Plus aria-hidden size={14} />
              {t('rules.new')}
            </Button>
          ) : null}
        </EmptyNotice>
      ) : (
        <>
          {conflicts.status === 'ready' ? <ConflictsSection conflicts={conflicts.value} /> : null}
          <Section title={t('rules.listLabel')} hint={t('rules.hint')}>
            {failure === null ? null : <FailureNotice error={failure} />}
            <ul aria-label={t('rules.listLabel')} className="flex flex-col">
              {live.map((rule) => (
                <RuleRow key={rule.id} rule={rule} canUpdate={permissions.update(rule)} actions={actionsOf(rule)} />
              ))}
            </ul>
            {permissions.createAny ? (
              <div>
                <Button onPress={newRule}>
                  <Plus aria-hidden size={14} />
                  {t('rules.new')}
                </Button>
              </div>
            ) : null}
          </Section>
        </>
      )}
      {archiving === null ? null : (
        <SmallDialog
          role="alertdialog"
          titleKey="rules.archiveTitle"
          hintKey="rules.archiveBody"
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

const NO_ROWS: readonly never[] = []
