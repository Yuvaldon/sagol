import { FULL_SCREEN_PAGES, PAGE_TABS, PANEL_IDS, ROUND_ENTITY, type PageId } from '@config'
import { t, type I18nKey } from '@i18n'
import {
  liveRules,
  nextSetupStep,
  useAvailabilityRules,
  useLinkReviewAccess,
  useModuleAccess,
  usePanel,
  useRosterPermissions,
  useRotationScope,
  useRoundPlanning,
  useSetupAccess,
  useSetupProgress,
  useShellPlace,
  useSoldiers,
  useUnits,
  type RoundPlanning,
  type SetupStep,
} from '@logic'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode, type Ref } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Badge } from '../../kit/Badge'
import { progressText } from '../../modules/setup/steps'
import { useNavigationEntries, useSetupEntries, type ModuleEntry } from '../moduleEntries'
import { useOpener, useOpenerFallback } from '../chrome'
import { LoadingNotice } from '../../patterns/Notices'
import { useIsDesktop } from '../../patterns/media'
import { PageFrame, PageHead, PageHeading } from '../PageFrame'
import { AddSoldiersPage } from './AddSoldiersPage'
import { JoinsPage } from './JoinsPage'
import { DESIGNED_TOOLS, KEPT_TOOLS, ROUND_ROW_AFTER, useInboxEntry, useSettingsSections } from './rows'
import { RulesPage } from './RulesPage'
import { SettingsPage } from './SettingsPage'
import { SoldiersPage } from './SoldiersPage'

// "ניהול" (D-456, D-482): an index of thin rows, each a tool's name with what it holds now and a chevron. The designed
// tools come first, each opening its page: "חיילים", "בקשות הצטרפות", the leave-round planner and "כללי נוכחות"; after a
// gap, the tools that keep their current screens, each opening its module in a drawer, and "הגדרות" last. On a wide
// screen an open page stands beside the rows, which stay in a column on the inline start (D-460, D-491).

/** The control the keyboard returns to when the settings page closes: its row. */
const SETTINGS_OPENER = 'settings'

const ROW =
  'flex min-h-tab w-full cursor-pointer items-center justify-between gap-md border-b border-divider-strong text-start outline-focus -outline-offset-2 data-focus-visible:outline-2'

function Row({
  labelKey,
  value,
  onPress,
  buttonRef,
  current = false,
}: {
  readonly labelKey: I18nKey
  readonly value: ReactNode
  readonly onPress: () => void
  readonly buttonRef?: Ref<HTMLButtonElement>
  /** The row of the page open beside the column (D-491). */
  readonly current?: boolean
}) {
  const valueId = useId()
  return (
    <li>
      {/* The tool is named by its visible name alone; what it holds describes it, so the name stays short to read and to find. */}
      <AriaButton
        {...(buttonRef === undefined ? {} : { ref: buttonRef })}
        aria-describedby={valueId}
        aria-current={current ? 'page' : false}
        onPress={onPress}
        className={`${ROW} ${current ? 'font-bold text-action-solid' : ''}`}
      >
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

const WORD = ' '

/** What the planner's row says: who of the rotation has no round yet, or that every one has (OI-389). */
function roundValue(planning: RoundPlanning): ReactNode {
  if (planning.unplanned === null) return null
  return planning.unplanned === 0 ? t('manage.round.planned') : [String(planning.unplanned), t('manage.round.unplanned')].join(WORD)
}

/** The page each designed row opens, so the column marks the one open beside it. */
const ROW_PAGES: Readonly<Partial<Record<string, PageId>>> = { soldiers: 'soldiers', accountLinks: 'joins', rules: 'rules' }

/** The rows of "ניהול": the designed tools, then the kept ones and "הגדרות"; `current` is the page open beside them. */
function ToolRows({ current }: { readonly current: PageId | null }) {
  const place = useShellPlace()
  const panel = usePanel()
  const work = useNavigationEntries()
  const planning = useRoundPlanning()
  const rules = useAvailabilityRules()
  const setup = useSetupEntries()
  const sections = useSettingsSections()
  const stepsAllowed = useSetupAccess().length > 0
  const soldiers = useSoldiers()
  const units = useUnits()
  const { rotation } = useRotationScope()
  const enabled = rules.status === 'ready' ? liveRules(rules.value).filter((rule) => rule.is_enabled).length : null
  const values: Partial<Record<string, ReactNode>> = {
    soldiers: soldiers.status === 'ready' ? soldiers.value.length : null,
    rules: enabled === null ? null : [String(enabled), t('manage.rules.active')].join(WORD),
    units: units.status === 'ready' ? units.value.length : null,
    deployments: rotation?.name ?? null,
  }
  const rowOf = (entry: ModuleEntry | undefined) =>
    entry === undefined ? null : (
      <Row
        key={entry.id}
        labelKey={entry.labelKey}
        value={waitingOf(entry) ?? values[entry.id] ?? null}
        onPress={entry.onPress}
        current={current !== null && ROW_PAGES[entry.id] === current}
      />
    )
  const roundRow =
    planning === null ? null : (
      <Row
        key="round"
        labelKey="manage.round.row"
        value={roundValue(planning)}
        onPress={() => {
          panel.open(PANEL_IDS.leaves, { entity: ROUND_ENTITY })
        }}
      />
    )
  const designed = DESIGNED_TOOLS.flatMap((module) => [rowOf(work.get(module)), ...(module === ROUND_ROW_AFTER ? [roundRow] : [])]).filter((row) => row !== null)
  const inbox = rowOf(useInboxEntry() ?? undefined)
  const tree = rowOf(setup.get('units'))
  const kept = [...(inbox === null ? [] : [inbox]), ...(tree === null ? [] : [tree]), ...KEPT_TOOLS.map((module) => rowOf(work.get(module))).filter((row) => row !== null)]
  const opener = useOpener(SETTINGS_OPENER)
  // Only the index takes the keyboard back on its row: the column beside an open page must not take it while it opens.
  const settingsRef = current === null ? opener.ref : undefined
  const openSettings = () => {
    opener.remember()
    place.openPage('settings')
  }
  const settingsCurrent = current === 'settings'
  return (
    <>
      {designed.length > 0 ? <ul className="flex flex-col">{designed}</ul> : null}
      <ul className="flex flex-col">
        {kept}
        {sections.length > 0 ? (
          <Row
            labelKey="navigation.setupOpen"
            value={stepsAllowed ? <SetupProgress>{(steps) => progressText(steps)}</SetupProgress> : null}
            onPress={openSettings}
            {...(settingsRef === undefined ? {} : { buttonRef: settingsRef })}
            current={settingsCurrent}
          />
        ) : stepsAllowed ? (
          // With no settings module of theirs, the row leads only to steps still open, never to an empty page.
          <SetupProgress>
            {(steps) => <Row labelKey="navigation.setupOpen" value={progressText(steps)} onPress={openSettings} {...(settingsRef === undefined ? {} : { buttonRef: settingsRef })} current={settingsCurrent} />}
          </SetupProgress>
        ) : null}
      </ul>
    </>
  )
}

function Index({ name }: { readonly name: string }) {
  useOpenerFallback(SETTINGS_OPENER)
  return (
    <PageFrame updates>
      <PageHead>
        <PageHeading className="text-title font-bold tracking-tight">{t('navigation.tab')}</PageHeading>
        <p className="text-body text-text-muted">{name}</p>
      </PageHead>
      <ToolRows current={null} />
    </PageFrame>
  )
}

/**
 * A wide screen's "ניהול" with a page open (D-460, D-491): the rows in a column on the inline start, the page beside
 * them. The column names itself for readers; the page keeps the one heading of the screen.
 */
function Beside({ current, children }: { readonly current: PageId; readonly children: ReactNode }) {
  return (
    <div className="flex h-full">
      <nav aria-label={t('navigation.tab')} className="w-tools shrink-0 overflow-y-auto border-e border-divider-strong px-lg pt-xl pb-page-end">
        <div className="flex flex-col gap-lg">
          <ToolRows current={current} />
        </div>
      </nav>
      <div className="relative min-w-none flex-1">{children}</div>
    </div>
  )
}

interface PageAccess {
  readonly allowed: boolean
  /** Whether the answers behind `allowed` are in: until then a page is neither shown as refused nor closed. */
  readonly known: boolean
}

/** The pages of "ניהול": those whose destination it is. */
type ManagePageId = { [P in PageId]: (typeof PAGE_TABS)[P] extends 'manage' ? P : never }[PageId]

function isManagePage(page: PageId): page is ManagePageId {
  return PAGE_TABS[page] === 'manage'
}

/** Which pages of "ניהול" the actor may open: each its tool's own access (D-455); a page they may not open is put right. */
function usePages(): Readonly<Record<ManagePageId, PageAccess>> {
  const access = useModuleAccess()
  const links = useLinkReviewAccess()
  const units = useUnits()
  const roster = useRosterPermissions(NO_SOLDIERS, units.status === 'ready' ? units.value : NO_SOLDIERS)
  const sure = (allowed: boolean): PageAccess => ({ allowed, known: true })
  return {
    settings: sure(true),
    soldiers: sure(access.soldiers),
    joins: { allowed: links.allowed, known: links.known },
    rules: sure(access.rules),
    add_soldiers: { allowed: access.soldiers && roster.create, known: !access.soldiers || roster.create || (units.status !== 'loading' && roster.settled) },
  }
}

const NO_SOLDIERS: readonly never[] = []

export function ManagePage({ name }: { readonly name: string }) {
  const place = useShellPlace()
  const desktop = useIsDesktop()
  const pages = usePages()
  const { page, closePage } = place
  // A page once allowed stays while it is open: approving the last join request empties "הצטרפות" without closing it.
  const [kept, setKept] = useState<PageId | null>(null)
  const access = page === null || !isManagePage(page) ? null : pages[page]
  if (access?.allowed === true && kept !== page) setKept(page)
  else if (kept !== null && kept !== page) setKept(null)
  const stray = access !== null && access.known && !access.allowed && kept !== page
  useEffect(() => {
    if (stray) closePage()
  }, [stray, closePage])
  if (access !== null && !access.allowed && !access.known && kept !== page) {
    return (
      <PageFrame>
        <LoadingNotice />
      </PageFrame>
    )
  }
  if (stray) return <Index name={name} />
  const open = openPageOf(page, name)
  if (open === null || page === null) return <Index name={name} />
  // A temporary full screen stands alone on a wide screen too.
  return desktop && !FULL_SCREEN_PAGES.includes(page) ? <Beside current={page}>{open}</Beside> : open
}

/** The page of "ניהול" the address names, or NULL for the index. */
function openPageOf(page: PageId | null, name: string): ReactNode {
  switch (page) {
    case 'settings':
      return <SettingsPage />
    case 'soldiers':
      return <SoldiersPage name={name} />
    case 'joins':
      return <JoinsPage name={name} />
    case 'rules':
      return <RulesPage name={name} />
    case 'add_soldiers':
      return <AddSoldiersPage />
    default:
      return null
  }
}
