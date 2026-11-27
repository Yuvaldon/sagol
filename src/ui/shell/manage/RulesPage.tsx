import { ARCHIVE_ENTITY, NEW_ENTITY, PANEL_IDS } from '@config'
import type { AvailabilityRule, AvailabilityRuleId, UnitId } from '@contracts'
import { t } from '@i18n'
import {
  archivedRows,
  liveRules,
  ruleOverrides,
  useAvailabilityRulesWithArchived,
  usePanel,
  useRuleCommands,
  useRulePermissions,
  useUnits,
} from '@logic'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Button as AriaButton, Switch } from 'react-aria-components'
import { OptionsMenu } from '../../kit/OptionsMenu'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../patterns/Notices'
import { ruleSummary, useRuleNames, type RuleNames } from '../../patterns/rules/ruleText'
import { useNotices } from '../notices'
import { PageFrame } from '../PageFrame'
import { CapsuleButton } from './CapsuleButton'
import { PageTop } from './PageTop'

// "כללי נוכחות" (the handoff's Manage → Availability rules, D-461, D-482): the live rules by the unit they apply to, in
// priority order (higher wins), each with its sentence and its switch. A rule a higher one replaces on every day it
// applies says "לא חל", which opens that rule. A row opens the rule's drawer; "+" in the capsule makes a new one, and the
// options hold the archive with its count. "soft", "hard" and "priority" never show here.

const SEPARATOR = ' · '
const WORD = ' '
const NO_UNITS: readonly never[] = []

interface Group {
  readonly key: string
  readonly unitId: UnitId | null
  readonly rules: AvailabilityRule[]
}

/** The rules under the unit they apply to, the groups in the order their first rule comes. */
function groupsOf(rules: readonly AvailabilityRule[]): Group[] {
  const groups = new Map<string, Group>()
  for (const rule of rules) {
    const key = rule.scope_unit_id ?? ''
    const group = groups.get(key) ?? { key, unitId: rule.scope_unit_id, rules: [] }
    group.rules.push(rule)
    groups.set(key, group)
  }
  return [...groups.values()]
}

function RuleRow({
  rule,
  names,
  overriddenBy,
  canToggle,
}: {
  readonly rule: AvailabilityRule
  readonly names: RuleNames
  readonly overriddenBy: AvailabilityRuleId | null
  readonly canToggle: boolean
}) {
  const panel = usePanel()
  const notices = useNotices()
  const { toggle } = useRuleCommands()
  const summary = ruleSummary(rule, names)
  return (
    <li className="flex items-center gap-sm border-b border-divider-strong pe-lg last:border-b-0">
      <AriaButton
        onPress={() => {
          panel.open(PANEL_IDS.rules, { entity: rule.id })
        }}
        className={`flex min-h-touch min-w-none flex-1 cursor-pointer flex-col justify-center gap-2xs py-sm ps-lg text-start outline-focus -outline-offset-2 data-focus-visible:outline-2 data-hovered:bg-inner ${
          rule.is_enabled ? '' : 'text-text-muted'
        }`}
      >
        <span className="truncate text-body font-semibold">{rule.name}</span>
        <span className="truncate text-small text-text-muted">{summary}</span>
      </AriaButton>
      {overriddenBy === null ? null : (
        <AriaButton
          aria-label={[t('manage.rules.notApplied'), names.rule(overriddenBy)].join(SEPARATOR)}
          onPress={() => {
            panel.open(PANEL_IDS.rules, { entity: overriddenBy })
          }}
          className="group inline-flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center outline-none"
        >
          {/* A quiet pill, as the handoff draws it, inside a 44 px target. */}
          <span className="inline-flex min-h-badge items-center rounded-full bg-inner px-md text-small font-semibold text-text-muted outline-focus outline-offset-2 group-data-focus-visible:outline-2">
            {t('manage.rules.notApplied')}
          </span>
        </AriaButton>
      )}
      {canToggle ? (
        <Switch
          aria-label={[t('manage.rules.enabled'), rule.name].join(WORD)}
          isSelected={rule.is_enabled}
          isDisabled={toggle.isPending}
          onChange={() => {
            void toggle.run(rule).then((result) => {
              if (!result.ok) notices.fail(result.error)
            })
          }}
          className="group flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center outline-none"
        >
          <span className="flex h-icon w-control shrink-0 items-center rounded-pill border border-line bg-inner p-2xs outline-focus outline-offset-2 group-data-focus-visible:outline-2 group-data-selected:border-action-solid group-data-selected:bg-action-solid">
            <span className="size-dot rounded-pill bg-text-muted group-data-selected:ms-auto group-data-selected:bg-on-action" />
          </span>
        </Switch>
      ) : null}
    </li>
  )
}

export function RulesPage({ name }: { readonly name: string }) {
  const panel = usePanel()
  const rules = useAvailabilityRulesWithArchived()
  const units = useUnits()
  const names = useRuleNames()
  const live = useMemo(() => (rules.status === 'ready' ? liveRules(rules.value) : []), [rules])
  const archived = useMemo(() => (rules.status === 'ready' ? archivedRows(rules.value) : []), [rules])
  const everyRule = useMemo(() => [...live, ...archived], [live, archived])
  const permissions = useRulePermissions(units.status === 'ready' ? units.value : NO_UNITS, everyRule)
  const overrides = useMemo(() => ruleOverrides(live), [live])
  const restorable = archived.filter((rule) => permissions.archive(rule)).length
  const enabled = live.filter((rule) => rule.is_enabled).length

  return (
    <PageFrame>
      <PageTop
        titleKey="manage.pages.rules"
        detail={rules.status === 'ready' ? [name, [String(enabled), t('manage.rules.active')].join(WORD)].join(SEPARATOR) : name}
        tools={
          restorable === 0 && !permissions.createAny ? null : (
            <>
              {restorable === 0 ? null : (
                <OptionsMenu
                  labelKey="manage.rules.options"
                  icon={<SlidersHorizontal aria-hidden size={20} />}
                  rows={[]}
                  footer={[
                    {
                      key: 'archive',
                      label: [t('manage.people.archive'), String(restorable)].join(SEPARATOR),
                      onPress: () => {
                        panel.open(PANEL_IDS.rules, { entity: ARCHIVE_ENTITY })
                      },
                    },
                  ]}
                />
              )}
              {permissions.createAny ? (
                <CapsuleButton
                  labelKey="manage.rules.new"
                  onPress={() => {
                    panel.open(PANEL_IDS.rules, { entity: NEW_ENTITY })
                  }}
                >
                  <Plus aria-hidden size={20} />
                </CapsuleButton>
              ) : null}
            </>
          )
        }
      />
      {rules.status === 'failed' ? (
        <FailureNotice error={rules.error} />
      ) : rules.status === 'loading' ? (
        <LoadingNotice />
      ) : live.length === 0 ? (
        <EmptyNotice titleKey="rules.emptyTitle" bodyKey={permissions.createAny ? undefined : 'rules.emptyReadOnly'} headingLevel={2} />
      ) : (
        groupsOf(live).map((group) => (
          <section key={group.key} className="flex flex-col gap-xs">
            <h2 className="flex items-center justify-between gap-sm px-xs text-body font-bold">
              <span className="min-w-none truncate">{names.unit(group.unitId)}</span>
              <span className="shrink-0 text-small font-normal text-text-muted tabular-nums">{group.rules.length}</span>
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
              {group.rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} names={names} overriddenBy={overrides.get(rule.id) ?? null} canToggle={permissions.update(rule)} />
              ))}
            </ul>
          </section>
        ))
      )}
    </PageFrame>
  )
}
