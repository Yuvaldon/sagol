import { t, type I18nKey } from '@i18n'
import { nextSetupStep, useRotationScope, useSetupAccess, useSetupProgress, useShellPlace, useSoldiers, useUnits, type SetupStep } from '@logic'
import { ChevronLeft } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Badge } from '../../kit/Badge'
import { progressText } from '../../modules/setup/steps'
import { useNavigationEntries, useSetupEntries, type ModuleEntry } from '../moduleEntries'
import { PageFrame, PageHead } from '../PageFrame'
import { DESIGNED_TOOLS, KEPT_TOOLS, useInboxEntry, useSettingsSections } from './rows'
import { SettingsPage } from './SettingsPage'

// "ניהול" (D-456): an index of thin rows, each a tool's name with what it holds now and a chevron. The designed tools
// come first; after a gap, the tools that keep their current screens, and "הגדרות" last. A row opens its module in a
// drawer over the page.

const ROW =
  'flex min-h-tab w-full cursor-pointer items-center justify-between gap-md border-b border-divider-strong text-start outline-focus -outline-offset-2 data-focus-visible:outline-2'

function Row({ labelKey, value, onPress }: { readonly labelKey: I18nKey; readonly value: ReactNode; readonly onPress: () => void }) {
  const valueId = useId()
  return (
    <li>
      {/* The tool is named by its visible name alone; what it holds describes it, so the name stays short to read and to find. */}
      <AriaButton aria-describedby={valueId} onPress={onPress} className={ROW}>
        <span className="min-w-none truncate text-body font-semibold">{t(labelKey)}</span>
        <span aria-hidden className="flex shrink-0 items-center gap-xs text-small text-text-muted tabular-nums">
          <span id={valueId}>{value}</span>
          <ChevronLeft size={16} />
        </span>
      </AriaButton>
    </li>
  )
}

/** What waits in a module, as an amber pill read with its words; nothing while nothing waits. */
function waitingOf(entry: ModuleEntry): ReactNode {
  if (entry.count === null || entry.count.value === 0) return null
  return (
    <Badge tone="pending">
      {entry.count.value}
      <span className="sr-only"> {t(entry.count.labelKey)}</span>
    </Badge>
  )
}

/** The setup's progress beside "הגדרות" while steps are open (D-285). Mounted only for who has a step. */
function SetupProgress({ children }: { readonly children: (steps: readonly SetupStep[]) => ReactNode }) {
  const progress = useSetupProgress()
  return progress.status === 'ready' && nextSetupStep(progress.value) !== null ? children(progress.value) : null
}

function Index({ name }: { readonly name: string }) {
  const place = useShellPlace()
  const work = useNavigationEntries()
  const setup = useSetupEntries()
  const sections = useSettingsSections()
  const stepsAllowed = useSetupAccess().length > 0
  const soldiers = useSoldiers()
  const units = useUnits()
  const { rotation } = useRotationScope()
  const values: Partial<Record<string, ReactNode>> = {
    soldiers: soldiers.status === 'ready' ? soldiers.value.length : null,
    units: units.status === 'ready' ? units.value.length : null,
    deployments: rotation?.name ?? null,
  }
  const rowOf = (entry: ModuleEntry | undefined) =>
    entry === undefined ? null : <Row key={entry.id} labelKey={entry.labelKey} value={waitingOf(entry) ?? values[entry.id] ?? null} onPress={entry.onPress} />
  const designed = DESIGNED_TOOLS.map((module) => rowOf(work.get(module))).filter((row) => row !== null)
  const inbox = rowOf(useInboxEntry() ?? undefined)
  const tree = rowOf(setup.get('units'))
  const kept = [...(inbox === null ? [] : [inbox]), ...(tree === null ? [] : [tree]), ...KEPT_TOOLS.map((module) => rowOf(work.get(module))).filter((row) => row !== null)]
  const openSettings = () => {
    place.openPage('settings')
  }
  return (
    <PageFrame updates>
      <PageHead>
        <h1 className="text-title font-bold tracking-tight">{t('navigation.tab')}</h1>
        <p className="text-body text-text-muted">{name}</p>
      </PageHead>
      {designed.length > 0 ? <ul className="flex flex-col">{designed}</ul> : null}
      <ul className="flex flex-col">
        {kept}
        {sections.length > 0 ? (
          <Row
            labelKey="navigation.setupOpen"
            value={stepsAllowed ? <SetupProgress>{(steps) => progressText(steps)}</SetupProgress> : null}
            onPress={openSettings}
          />
        ) : stepsAllowed ? (
          // With no settings module of theirs, the row leads only to steps still open, never to an empty page.
          <SetupProgress>{(steps) => <Row labelKey="navigation.setupOpen" value={progressText(steps)} onPress={openSettings} />}</SetupProgress>
        ) : null}
      </ul>
    </PageFrame>
  )
}

export function ManagePage({ name }: { readonly name: string }) {
  const place = useShellPlace()
  return place.page === 'settings' ? <SettingsPage /> : <Index name={name} />
}
