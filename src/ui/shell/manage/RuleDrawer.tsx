import { ARCHIVE_ENTITY, NEW_ENTITY, PANEL_IDS } from '@config'
import { RuleEnforcement, type AppError, type AvailabilityRule } from '@contracts'
import { t } from '@i18n'
import {
  archivedRows,
  liveRules,
  ruleOverrides,
  useAvailabilityRulesWithArchived,
  useCommandRanks,
  useDeployments,
  useModuleAccess,
  usePanel,
  useRuleCommands,
  useRulePermissions,
  useTagCategories,
  useTags,
  useUnitLevels,
  useUnits,
  useUnitsWithArchived,
} from '@logic'
import { Archive, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { useFullStop } from '../../kit/drawerStop'
import { StopDrawer } from '../../kit/StopDrawer'
import { RuleForm } from '../../modules/rules/RuleForm'
import { ActionMenu } from '../../patterns/ActionMenu'
import { SmallDialog } from '../../patterns/Dialogs'
import { formatDate, formatDateRange } from '../../patterns/dates'
import { FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { ruleParts, useRuleNames } from '../../patterns/rules/ruleText'
import { IconButton } from '../../primitives/Button'
import { restoreFailureKey } from '../../patterns/restoreFailure'
import { useNotices } from '../notices'
import { RuleArchiveDrawer } from './ArchiveDrawers'

// The rule's drawer (the handoff's rule details and form, D-461, D-482): the rule as a sentence of chips, "לא חל" when a
// higher rule replaces it, and quietly what else it does; the pencil opens the form in the same drawer (OI-385: the form
// is the current one), and "⋯" holds "העברה לארכיון", which asks by name and is undone from the toast. A new rule opens
// on the form. `panel=rules&entity=<id|new|archive>`.

const WORD = ' '
const NO_UNITS: readonly never[] = []

const CHIP = 'rounded-full bg-inner px-md py-xs text-body font-semibold'

function useFormData() {
  const units = useUnitsWithArchived()
  const levels = useUnitLevels()
  const categories = useTagCategories()
  const tags = useTags()
  const ranks = useCommandRanks()
  const deployments = useDeployments()
  const reads = [units, levels, categories, tags, ranks, deployments]
  const failed = reads.find((read) => read.status === 'failed')
  if (failed?.status === 'failed') return { status: 'failed' as const, error: failed.error }
  if (
    units.status !== 'ready' ||
    levels.status !== 'ready' ||
    categories.status !== 'ready' ||
    tags.status !== 'ready' ||
    ranks.status !== 'ready' ||
    deployments.status !== 'ready'
  ) {
    return { status: 'loading' as const }
  }
  return {
    status: 'ready' as const,
    value: { units: units.value, levels: levels.value, categories: categories.value, tags: tags.value, ranks: ranks.value, deployments: deployments.value },
  }
}

function Editor({ rule, onDone }: { readonly rule: AvailabilityRule | null; readonly onDone: () => void }) {
  const data = useFormData()
  const units = useUnits()
  const permissions = useRulePermissions(units.status === 'ready' ? units.value : NO_UNITS, rule === null ? [] : [rule])
  const [generation, setGeneration] = useState(0)
  // A form needs the room: it asks the drawer for its full stop as it shows (D-477).
  const grow = useFullStop()
  useEffect(() => {
    grow()
  }, [grow])
  if (data.status === 'failed') return <FailureNotice error={data.error} />
  if (data.status === 'loading') return <LoadingNotice />
  return (
    <RuleForm
      key={generation}
      rule={rule}
      {...data.value}
      placeable={rule === null ? permissions.createIn : permissions.moveTo}
      onReload={() => {
        setGeneration((current) => current + 1)
      }}
      onDone={onDone}
    />
  )
}

function View({ rule, rules }: { readonly rule: AvailabilityRule; readonly rules: readonly AvailabilityRule[] }) {
  const panel = usePanel()
  const names = useRuleNames()
  const overriding = ruleOverrides(rules).get(rule.id) ?? null
  const dates =
    rule.effective_from !== null && rule.effective_to !== null
      ? formatDateRange(rule.effective_from, rule.effective_to)
      : rule.effective_from !== null
        ? [t('manage.rules.from'), formatDate(rule.effective_from, 'dayMonth')].join(WORD)
        : rule.effective_to !== null
          ? [t('manage.rules.until'), formatDate(rule.effective_to, 'dayMonth')].join(WORD)
          : null
  const quiet = [
    ...(rule.is_enabled ? [] : [t('manage.rules.off')]),
    ...(rule.enforcement === RuleEnforcement.enum.hard ? [t('manage.rules.noExceptions')] : []),
    ...(rule.count_pending_as_unavailable ? [t('manage.rules.countsPending')] : []),
  ]
  return (
    <div className="flex flex-col gap-md">
      <ul aria-label={t('manage.rules.sentence')} className="flex flex-wrap gap-xs">
        {[...ruleParts(rule, names), ...(dates === null ? [] : [dates])].map((part) => (
          <li key={part} className={CHIP}>
            {part}
          </li>
        ))}
      </ul>
      {overriding === null ? null : (
        <AriaButton
          onPress={() => {
            panel.open(PANEL_IDS.rules, { entity: overriding })
          }}
          className="flex min-h-touch w-full cursor-pointer items-center rounded-card bg-surface px-lg text-start text-body outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          {[t('manage.rules.notAppliedBecause'), names.rule(overriding)].join(WORD)}
        </AriaButton>
      )}
      {quiet.map((line) => (
        <p key={line} className="text-small text-text-muted">
          {line}
        </p>
      ))}
    </div>
  )
}

function RuleCard({ rule, rules, onClose }: { readonly rule: AvailabilityRule; readonly rules: readonly AvailabilityRule[]; readonly onClose: () => void }) {
  const notices = useNotices()
  const units = useUnits()
  const permissions = useRulePermissions(units.status === 'ready' ? units.value : NO_UNITS, [rule])
  const commands = useRuleCommands()
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  // A refusal shows in the drawer, which stands over the toast.
  const [failure, setFailure] = useState<AppError | null>(null)
  const tools = editing ? null : (
    <>
      {permissions.update(rule) ? (
        <IconButton
          labelKey="manage.rules.edit"
          variant="circle"
          onPress={() => {
            setEditing(true)
          }}
        >
          <Pencil aria-hidden size={18} />
        </IconButton>
      ) : null}
      <ActionMenu
        labelKey="common.actions"
        variant="circle"
        actions={
          permissions.archive(rule)
            ? [
                {
                  id: 'archive',
                  labelKey: 'manage.archive.move',
                  icon: <Archive aria-hidden size={14} />,
                  tone: 'danger',
                  onAction: () => {
                    setArchiving(true)
                  },
                },
              ]
            : []
        }
      />
    </>
  )
  return (
    <StopDrawer inUrl title={rule.name} onClose={onClose} tools={tools}>
      {editing ? (
        <Editor
          rule={rule}
          onDone={() => {
            setEditing(false)
          }}
        />
      ) : (
        <View rule={rule} rules={rules} />
      )}
      {failure === null ? null : <FailureNotice error={failure} />}
      {archiving ? (
        <SmallDialog
          role="alertdialog"
          titleKey="manage.archive.ruleTitle"
          hintKey="manage.archive.ruleBody"
          confirmKey="manage.archive.confirm"
          tone="danger"
          isPending={commands.archive.isPending}
          onCancel={() => {
            setArchiving(false)
          }}
          onConfirm={() => {
            void commands.archive.run(rule).then((result) => {
              setArchiving(false)
              if (!result.ok) {
                setFailure(result.error)
                return
              }
              onClose()
              notices.say([rule.name, t('manage.archive.done')].join(WORD), {
                labelKey: 'common.cancel',
                run: () => {
                  void commands.restore.run(result.value).then((restored) => {
                    if (!restored.ok) notices.fail(restored.error, restoreFailureKey(restored.error))
                  })
                },
              })
            })
          }}
        >
          <p className="text-body font-semibold">{rule.name}</p>
        </SmallDialog>
      ) : null}
    </StopDrawer>
  )
}

export function RuleDrawer() {
  const panel = usePanel()
  const access = useModuleAccess()
  const units = useUnits()
  const rules = useAvailabilityRulesWithArchived()
  const live = useMemo(() => (rules.status === 'ready' ? liveRules(rules.value) : []), [rules])
  const archived = useMemo(() => (rules.status === 'ready' ? archivedRows(rules.value) : []), [rules])
  const permissions = useRulePermissions(units.status === 'ready' ? units.value : NO_UNITS, live)
  // The rules' drawers are the rules module's: a link opens them only for who may open it (D-076, rule 4).
  if (panel.panel !== PANEL_IDS.rules || panel.entity === null || !access.rules) return null
  if (panel.entity === ARCHIVE_ENTITY) return <RuleArchiveDrawer onClose={panel.close} />
  if (panel.entity === NEW_ENTITY && !permissions.createAny) {
    return (
      <StopDrawer inUrl title={t('manage.pages.rules')} onClose={panel.close}>
        <p className="text-body text-text-muted">{t('rules.notFound')}</p>
      </StopDrawer>
    )
  }
  if (panel.entity === NEW_ENTITY) {
    return (
      <StopDrawer inUrl title={t('rules.newTitle')} opensAt="full" onClose={panel.close}>
        <Editor rule={null} onDone={panel.close} />
      </StopDrawer>
    )
  }
  const rule = live.find((candidate) => candidate.id === panel.entity) ?? archived.find((candidate) => candidate.id === panel.entity)
  if (rule === undefined || rule.archived_at !== null) {
    return (
      <StopDrawer inUrl title={t('manage.pages.rules')} onClose={panel.close}>
        {rules.status === 'failed' ? (
          <FailureNotice error={rules.error} />
        ) : rules.status === 'loading' ? (
          <LoadingNotice />
        ) : (
          <p className="text-body text-text-muted">{t('rules.notFound')}</p>
        )}
      </StopDrawer>
    )
  }
  return <RuleCard key={rule.id} rule={rule} rules={live} onClose={panel.close} />
}
