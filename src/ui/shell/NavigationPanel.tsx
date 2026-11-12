import { SETUP_SECTIONS, WORK_SECTIONS, type SetupPanel, type SetupSectionId, type WorkSectionId } from '@config'
import { t, type I18nKey } from '@i18n'
import { nextSetupStep, usePanel, useSetupAccess, useSetupProgress, type SetupStep } from '@logic'
import { ArrowRight, ChevronLeft, ListChecks, Menu as MenuIcon, Settings, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button as AriaButton, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { IconButton } from '../primitives/Button'
import { EntryCount } from './EntryCount'
import { SetupChecklist } from '../modules/setup/SetupModule'
import { WORD, progressText, stepTitle } from '../modules/setup/steps'
import { useNavigationEntries, useSetupEntries, type ModuleEntry } from './moduleEntries'
import { useNavigationPanel } from './navigationPanelState'
import { TAB, TAB_COLOR } from './tabStyle'

// "ניהול יחידה" (D-254, D-285): the daily work, grouped by what the commander is doing, sliding in from the inline start.
// The unit's setup lives apart in the same panel, behind one quiet row at the foot: its rows replace the work's, with
// a way back. Each item opens its module and says in one plain line what it is for (D-250).

const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
const ROW = `flex min-h-touch w-full items-center gap-sm rounded-control px-sm py-xs text-control md:min-h-control data-hovered:bg-inner ${PRESS}`

const WORK_KEYS: Record<WorkSectionId, I18nKey> = {
  people: 'navigation.sections.people',
  presence: 'navigation.sections.presence',
}

const SETUP_KEYS: Record<SetupSectionId, I18nKey> = {
  structure: 'navigation.sections.structure',
  access: 'navigation.sections.access',
  catalogs: 'navigation.sections.catalogs',
  data: 'navigation.sections.data',
  advanced: 'navigation.sections.advanced',
}

const WORK_LINE_KEYS: Record<WorkModule, I18nKey> = {
  soldiers: 'navigation.lines.soldiers',
  account_links: 'navigation.lines.account_links',
  access_grants: 'navigation.lines.access_grants',
  deployments: 'navigation.lines.deployments',
  rules: 'navigation.lines.rules',
}

const SETUP_LINE_KEYS: Record<SetupPanel, I18nKey> = {
  units: 'navigation.lines.units',
  command_ranks: 'navigation.lines.command_ranks',
  roles: 'navigation.lines.roles',
  leave_types: 'navigation.lines.leave_types',
  tags: 'navigation.lines.tags',
  properties: 'navigation.lines.properties',
  data_transfer: 'navigation.lines.data_transfer',
  tag_categories: 'navigation.lines.tag_categories',
}

type WorkModule = (typeof WORK_SECTIONS)[number]['modules'][number]

interface PanelItem {
  readonly id: string
  readonly entry: ModuleEntry
  readonly lineKey: I18nKey
}

interface PanelSection {
  readonly id: string
  readonly titleKey: I18nKey
  readonly items: readonly PanelItem[]
}

function useWorkSections(): PanelSection[] {
  const entries = useNavigationEntries()
  return WORK_SECTIONS.map((section) => ({
    id: section.id,
    titleKey: WORK_KEYS[section.id],
    items: section.modules.flatMap((module: WorkModule) => {
      const entry = entries.get(module)
      return entry === undefined ? [] : [{ id: module, entry, lineKey: WORK_LINE_KEYS[module] }]
    }),
  })).filter((section) => section.items.length > 0)
}

function useSetupSections(): PanelSection[] {
  const entries = useSetupEntries()
  return SETUP_SECTIONS.map((section) => ({
    id: section.id,
    titleKey: SETUP_KEYS[section.id],
    items: section.panels.flatMap((id: SetupPanel) => {
      const entry = entries.get(id)
      return entry === undefined ? [] : [{ id, entry, lineKey: SETUP_LINE_KEYS[id] }]
    }),
  })).filter((section) => section.items.length > 0)
}

function Item({ item, onOpen }: { readonly item: PanelItem; readonly onOpen: () => void }) {
  const lineId = useId()
  const countId = useId()
  const { entry } = item
  return (
    <li>
      {/* The module is named by its visible name alone; its line and its count describe it, so the name stays short to read and to find. */}
      <AriaButton
        aria-describedby={`${lineId} ${countId}`}
        onPress={() => {
          onOpen()
          entry.onPress()
        }}
        className={ROW}
      >
        <entry.Icon aria-hidden size={16} className="shrink-0 text-text-muted" />
        <span className="flex min-w-none flex-1 flex-col text-start">
          <span>{t(entry.labelKey)}</span>
          <span id={lineId} aria-hidden className="text-label text-text-muted">
            {t(item.lineKey)}
          </span>
        </span>
        <span id={countId} aria-hidden>
          <EntryCount entry={entry} floating={false} />
        </span>
      </AriaButton>
    </li>
  )
}

function Sections({ sections, onOpen }: { readonly sections: readonly PanelSection[]; readonly onOpen: () => void }) {
  return sections.map((section) => (
    <section key={section.id} aria-labelledby={`navigation-${section.id}`} className="flex flex-col gap-2xs">
      <h3 id={`navigation-${section.id}`} className="px-sm text-label font-semibold text-text-muted">
        {t(section.titleKey)}
      </h3>
      <ul className="flex flex-col gap-2xs">
        {section.items.map((item) => (
          <Item key={item.id} item={item} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  ))
}

/** The setup's progress at the top of the work, while unfinished: how far, and the next step (D-285). */
function SetupCallout({ steps, onPress }: { readonly steps: readonly SetupStep[]; readonly onPress: () => void }) {
  const next = nextSetupStep(steps)
  if (next === null) return null
  return (
    <AriaButton onPress={onPress} className={`${ROW} border border-line bg-inner`}>
      <ListChecks aria-hidden size={16} className="shrink-0 text-text-muted" />
      <span className="flex min-w-none flex-1 flex-col text-start">
        <span className="font-semibold">{t('setup.title')}</span>
        <span className="text-label text-text-muted tabular-nums">{progressText(steps)}</span>
        <span className="text-label">{[t('navigation.nextStep'), stepTitle(next)].join(WORD)}</span>
      </span>
      <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-muted" />
    </AriaButton>
  )
}

/** The one quiet row at the foot of the work that opens the setup (D-285). */
function SetupRow({ onPress }: { readonly onPress: () => void }) {
  const lineId = useId()
  return (
    <AriaButton aria-describedby={lineId} onPress={onPress} className={`${ROW} mt-sm border-t border-line`}>
      <Settings aria-hidden size={16} className="shrink-0 text-text-muted" />
      <span className="flex min-w-none flex-1 flex-col text-start">
        <span>{t('navigation.setupOpen')}</span>
        <span id={lineId} aria-hidden className="text-label text-text-muted">
          {t('navigation.setupLine')}
        </span>
      </span>
      <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-muted" />
    </AriaButton>
  )
}

/**
 * The steps this actor may do, once they are read. Mounted only for who has a step, so nobody else reads what the
 * steps count; while they load, nothing shows, and the panel never waits on them.
 */
function WithSteps({ children }: { readonly children: (steps: readonly SetupStep[]) => ReactNode }) {
  const progress = useSetupProgress()
  return progress.status === 'ready' ? children(progress.value) : null
}

/** What waits in the panel, on its button; a pending request is not hidden behind the menu. */
function Waiting({ count }: { readonly count: number }) {
  if (count === 0) return null
  return (
    <span className="absolute end-none top-none inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums">
      {count}
      <span className="sr-only"> {t('navigation.waiting')}</span>
    </span>
  )
}

/** The menu button and its panel. Neither exists when the panel would hold nothing for this viewer (D-076). The button
 * is the last destination of the bottom strip, "ניהול" under its icon (D-252, D-254). */
export function NavigationPanel() {
  const panel = usePanel()
  const navigation = useNavigationPanel()
  const { isOpen, view } = navigation
  const work = useWorkSections()
  const setup = useSetupSections()
  const stepsAllowed = useSetupAccess().length > 0
  const hasSetup = setup.length > 0 || stepsAllowed
  if (work.length === 0 && !hasSetup) return null
  const close = navigation.close
  const open = () => {
    // Every opening starts at the work; the setup is a step away (D-285).
    navigation.open(work.length > 0 ? 'work' : 'setup')
  }
  const toSetup = () => {
    navigation.open('setup')
  }
  // What waits in the panel shows on its button as one sum, so a pending request is not hidden behind it (D-254).
  const waiting = [...work, ...setup].reduce(
    (sum, section) => section.items.reduce((inner, item) => inner + (item.entry.count?.value ?? 0), sum),
    0,
  )
  const inSetup = view === 'setup'
  const title = t(inSetup ? 'navigation.setupTitle' : 'navigation.title')
  return (
    <>
      <AriaButton aria-expanded={isOpen} aria-label={t('navigation.open')} onPress={open} className={`${TAB} ${TAB_COLOR.other}`}>
        <MenuIcon aria-hidden size={18} />
        <span aria-hidden>{t('navigation.tab')}</span>
        <Waiting count={waiting} />
      </AriaButton>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={(next) => {
          if (next) open()
          else close()
        }}
        isDismissable
        className="enter-scrim fixed inset-screen flex items-start justify-start bg-scrim frame-safe"
      >
        <Modal className="enter-start-panel glass-drawer flex max-h-full w-full max-w-sheet flex-col overflow-hidden rounded-panel">
          <Dialog className="flex min-h-none flex-col outline-none">
            <header className="flex shrink-0 items-center justify-between gap-sm px-lg pt-lg pb-md">
              <span className="flex min-w-none items-center gap-xs">
                {inSetup && work.length > 0 ? (
                  <IconButton
                    labelKey="navigation.back"
                    onPress={() => {
                      navigation.open('work')
                    }}
                  >
                    <ArrowRight aria-hidden size={18} />
                  </IconButton>
                ) : null}
                <Heading slot="title" className="truncate text-title font-bold tracking-tight">
                  {title}
                </Heading>
              </span>
              <IconButton labelKey="navigation.close" onPress={close}>
                <X aria-hidden size={18} />
              </IconButton>
            </header>
            <nav aria-label={title} className="flex min-h-none flex-col gap-md overflow-y-auto px-md pb-lg">
              {inSetup ? (
                <>
                  {stepsAllowed ? (
                    <WithSteps>
                      {(steps) =>
                        nextSetupStep(steps) === null ? null : (
                          <section aria-labelledby="navigation-checklist" className="flex flex-col gap-2xs px-sm">
                            <h3 id="navigation-checklist" className="text-label font-semibold text-text-muted">
                              {t('setup.title')}
                            </h3>
                            <SetupChecklist
                              steps={steps}
                              onGo={(step) => {
                                close()
                                panel.open(step.panel)
                              }}
                            />
                          </section>
                        )
                      }
                    </WithSteps>
                  ) : null}
                  <Sections sections={setup} onOpen={close} />
                </>
              ) : (
                <>
                  {stepsAllowed ? <WithSteps>{(steps) => <SetupCallout steps={steps} onPress={toSetup} />}</WithSteps> : null}
                  <Sections sections={work} onOpen={close} />
                  {/* With no setup module of theirs, the row leads only to steps still open, never to an empty view. */}
                  {setup.length > 0 ? (
                    <SetupRow onPress={toSetup} />
                  ) : stepsAllowed ? (
                    <WithSteps>{(steps) => (nextSetupStep(steps) === null ? null : <SetupRow onPress={toSetup} />)}</WithSteps>
                  ) : null}
                </>
              )}
            </nav>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  )
}
