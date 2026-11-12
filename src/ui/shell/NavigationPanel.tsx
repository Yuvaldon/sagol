import { NAVIGATION_SECTIONS, PANEL_IDS, TOOLTIP, type NavigationSectionId } from '@config'
import type { NavigationModule } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { usePanel, useSetupAccess } from '@logic'
import { ListChecks, Menu as MenuIcon, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Button as AriaButton, Dialog, Heading, Modal, ModalOverlay, TooltipTrigger } from 'react-aria-components'
import { IconButton, NameTooltip } from '../primitives/Button'
import { EntryCount } from './ModuleButtons'
import { useNavigationEntries, type ModuleEntry } from './moduleEntries'
import { TAB, TAB_COLOR } from './tabStyle'

// "ניהול יחידה" (D-254): the modules that set the unit up, grouped by what the commander is doing, sliding in from the
// inline start. Each item opens its module and says in one plain line what it is for (D-250); nothing is pinned out.

const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
const ROW = `flex min-h-touch w-full items-center gap-sm rounded-control px-sm py-xs text-control md:min-h-control data-hovered:bg-inner ${PRESS}`

const SECTION_KEYS: Record<NavigationSectionId, I18nKey> = {
  unit: 'navigation.sections.unit',
  presence: 'navigation.sections.presence',
  soldierDetails: 'navigation.sections.soldierDetails',
  access: 'navigation.sections.access',
  data: 'navigation.sections.data',
}

const LINE_KEYS: Record<NavigationModule, I18nKey> = {
  units: 'navigation.lines.units',
  soldiers: 'navigation.lines.soldiers',
  deployments: 'navigation.lines.deployments',
  leave_types: 'navigation.lines.leave_types',
  rules: 'navigation.lines.rules',
  tags: 'navigation.lines.tags',
  properties: 'navigation.lines.properties',
  roles: 'navigation.lines.roles',
  access_grants: 'navigation.lines.access_grants',
  account_links: 'navigation.lines.account_links',
  data_transfer: 'navigation.lines.data_transfer',
}

interface PanelSection {
  readonly id: NavigationSectionId
  readonly items: readonly { readonly module: NavigationModule; readonly entry: ModuleEntry }[]
}

function useSections(): PanelSection[] {
  const entries = useNavigationEntries()
  return NAVIGATION_SECTIONS.map((section) => ({
    id: section.id,
    items: section.modules.flatMap((module) => {
      const entry = entries.get(module)
      return entry === undefined ? [] : [{ module, entry }]
    }),
  })).filter((section) => section.items.length > 0)
}

function Item({
  module,
  entry,
  onOpen,
}: {
  readonly module: NavigationModule
  readonly entry: ModuleEntry
  readonly onOpen: () => void
}) {
  const lineId = useId()
  const name = t(entry.labelKey)
  return (
    <li>
      {/* The module is named by its name alone; its line describes it, so the name stays short to read and to find. */}
      <AriaButton
        aria-label={name}
        aria-describedby={lineId}
        onPress={() => {
          onOpen()
          entry.onPress()
        }}
        className={ROW}
      >
        <entry.Icon aria-hidden size={16} className="shrink-0 text-text-muted" />
        <span className="flex min-w-none flex-1 flex-col text-start">
          <span>{name}</span>
          <span id={lineId} className="text-label text-text-muted">
            {t(LINE_KEYS[module])}
          </span>
        </span>
        <EntryCount entry={entry} floating={false} />
      </AriaButton>
    </li>
  )
}

/** The unit's setup, above the groups while it is not done: it is for setting up, not for daily work (D-180, D-254). */
function SetupItem({ onOpen }: { readonly onOpen: () => void }) {
  const panel = usePanel()
  return (
    <AriaButton
      onPress={() => {
        onOpen()
        panel.open(PANEL_IDS.setup)
      }}
      className={ROW}
    >
      <ListChecks aria-hidden size={16} className="text-text-muted" />
      <span className="flex-1 text-start font-semibold">{t('setup.open')}</span>
    </AriaButton>
  )
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

/** The menu button and its panel. Neither exists when the panel would hold nothing for this viewer (D-076). On a phone
 * the button is the last tab of the bottom bar, with a short name under it (V20); in a desktop bar, an icon whose name
 * shows on hover. */
export function NavigationPanel({ variant = 'bar' }: { readonly variant?: 'bar' | 'tab' }) {
  const [isOpen, setOpen] = useState(false)
  const sections = useSections()
  const setup = useSetupAccess().length > 0
  if (sections.length === 0 && !setup) return null
  const close = () => {
    setOpen(false)
  }
  const open = () => {
    setOpen(true)
  }
  // What waits in the panel shows on its button as one sum, so a pending request is not hidden behind it (D-254).
  const waiting = sections.reduce(
    (sum, section) => section.items.reduce((inner, item) => inner + (item.entry.count?.value ?? 0), sum),
    0,
  )
  return (
    <>
      {variant === 'tab' ? (
        <AriaButton aria-expanded={isOpen} aria-label={t('navigation.open')} onPress={open} className={`${TAB} ${TAB_COLOR.other} flex-none`}>
          <MenuIcon aria-hidden size={18} />
          <span aria-hidden>{t('navigation.tab')}</span>
          <Waiting count={waiting} />
        </AriaButton>
      ) : (
        <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
          <AriaButton
            aria-expanded={isOpen}
            aria-label={t('navigation.open')}
            onPress={open}
            className={`relative inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill text-text-muted md:min-h-control md:min-w-control data-hovered:bg-inner ${PRESS}`}
          >
            <MenuIcon aria-hidden size={18} />
            <Waiting count={waiting} />
          </AriaButton>
          <NameTooltip>{t('navigation.open')}</NameTooltip>
        </TooltipTrigger>
      )}
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={setOpen}
        isDismissable
        className="enter-scrim fixed inset-none flex justify-start bg-scrim frame-safe"
      >
        <Modal className="enter-start-panel glass-drawer flex h-full w-full max-w-sheet flex-col overflow-hidden rounded-panel">
          <Dialog className="flex min-h-none flex-1 flex-col outline-none">
            <header className="flex shrink-0 items-center justify-between gap-sm px-lg pt-lg pb-md">
              <Heading slot="title" className="text-title font-bold tracking-tight">
                {t('navigation.title')}
              </Heading>
              <IconButton labelKey="navigation.close" onPress={close}>
                <X aria-hidden size={18} />
              </IconButton>
            </header>
            <nav aria-label={t('navigation.title')} className="flex min-h-none flex-1 flex-col gap-md overflow-y-auto px-md pb-lg">
              {setup ? <SetupItem onOpen={close} /> : null}
              {sections.map((section) => (
                <section key={section.id} aria-labelledby={`navigation-${section.id}`} className="flex flex-col gap-2xs">
                  <h3 id={`navigation-${section.id}`} className="px-sm text-label font-semibold text-text-muted">
                    {t(SECTION_KEYS[section.id])}
                  </h3>
                  <ul className="flex flex-col gap-2xs">
                    {section.items.map((item) => (
                      <Item key={item.module} module={item.module} entry={item.entry} onOpen={close} />
                    ))}
                  </ul>
                </section>
              ))}
            </nav>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  )
}
