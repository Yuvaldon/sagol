import { NAVIGATION_SECTIONS, PANEL_IDS, type NavigationSectionId } from '@config'
import { RulesRowPlacement, type NavigationModule } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { useModuleAccess, useNavigationPreferences, usePanel, useSetupAccess } from '@logic'
import { ListChecks, Menu as MenuIcon, Pin, X } from 'lucide-react'
import { useState } from 'react'
import {
  Button as AriaButton,
  Dialog,
  Heading,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  ToggleButton,
} from 'react-aria-components'
import { IconButton } from '../primitives/Button'
import { EntryCount } from './ModuleButtons'
import { useNavigationEntries, type ModuleEntry } from './moduleEntries'
import { useReportPreferenceSave } from './preferenceFailure'

// The navigation panel (D-173): the modules that set the organization up, by section, sliding in from the inline start.
// Each item opens its module and may be pinned to the bar; the soldier's display choices close the panel's list.

const PRESS = 'cursor-pointer outline-focus outline-offset-2 data-focus-visible:outline-2'
const ROW = `flex min-h-touch flex-1 items-center gap-sm rounded-control px-sm text-control md:min-h-control data-hovered:bg-inner ${PRESS}`

/** Between the pin's action and the module it names, read as one label. */
const NAME_SEPARATOR = ' '

const SECTION_KEYS: Record<NavigationSectionId, I18nKey> = {
  structure: 'navigation.sections.structure',
  leaveSetup: 'navigation.sections.leaveSetup',
  access: 'navigation.sections.access',
  data: 'navigation.sections.data',
}

const PLACEMENT_KEYS: Record<RulesRowPlacement, I18nKey> = {
  above: 'navigation.rulesRowAbove',
  below: 'navigation.rulesRowBelow',
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
  const preferences = useNavigationPreferences()
  const reportSave = useReportPreferenceSave()
  const name = t(entry.labelKey)
  const pinLabel = `${t('navigation.pin')}${NAME_SEPARATOR}${name}`
  return (
    <li className="flex items-center gap-2xs">
      <AriaButton
        onPress={() => {
          onOpen()
          entry.onPress()
        }}
        className={ROW}
      >
        <entry.Icon aria-hidden size={16} className="text-text-muted" />
        <span className="flex-1 text-start">{name}</span>
        <EntryCount entry={entry} floating={false} />
      </AriaButton>
      {/* Pins are offered once the preferences they are saved in have loaded (D-076, D-121). */}
      {preferences.editable ? (
        <ToggleButton
          aria-label={pinLabel}
          isSelected={preferences.pinned.includes(module)}
          onChange={() => {
            reportSave(preferences.togglePin(module))
          }}
          className={`inline-flex size-touch shrink-0 items-center justify-center rounded-pill text-text-muted md:size-control data-hovered:bg-inner data-selected:bg-inner data-selected:text-action-solid ${PRESS}`}
        >
          {/* Filled while pinned, so the state shows beyond its color (WCAG 1.4.1). */}
          {({ isSelected }) => <Pin aria-hidden size={14} fill={isSelected ? 'currentColor' : 'none'} />}
        </ToggleButton>
      ) : null}
    </li>
  )
}

/** The organization's setup, first in the panel and never pinned: it is for setting up, not for daily work (D-180). */
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

function DisplayChoices() {
  const preferences = useNavigationPreferences()
  const reportSave = useReportPreferenceSave()
  return (
    <section className="flex flex-col gap-xs border-t border-line pt-md">
      <h3 className="px-sm text-label font-semibold text-text-muted">{t('navigation.display')}</h3>
      <RadioGroup
        value={preferences.rulesRow}
        onChange={(value) => {
          reportSave(preferences.setRulesRow(RulesRowPlacement.parse(value)))
        }}
        className="flex flex-col gap-2xs px-sm"
      >
        <Label className="text-control font-semibold">{t('navigation.rulesRow')}</Label>
        {RulesRowPlacement.options.map((placement) => (
          <Radio
            key={placement}
            value={placement}
            className="group flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-xs text-control outline-none md:min-h-control data-hovered:bg-inner"
          >
            <span
              aria-hidden
              className="flex size-icon shrink-0 items-center justify-center rounded-pill border border-text-muted bg-surface outline-focus outline-offset-2 group-data-focus-visible:outline-2 group-data-selected:border-action-solid group-data-selected:bg-action-solid"
            >
              <span className="size-dot rounded-pill bg-on-action opacity-0 group-data-selected:opacity-100" />
            </span>
            {t(PLACEMENT_KEYS[placement])}
          </Radio>
        ))}
      </RadioGroup>
    </section>
  )
}

/** The menu button and its panel. Neither exists when the panel would hold nothing for this viewer (D-076). */
export function NavigationPanel() {
  const [isOpen, setOpen] = useState(false)
  const sections = useSections()
  const access = useModuleAccess()
  const preferences = useNavigationPreferences()
  // The placement choice is for who sees the rules, once the preferences it is saved in have loaded.
  const display = access.rules && preferences.editable
  const setup = useSetupAccess().length > 0
  if (sections.length === 0 && !display && !setup) return null
  const close = () => {
    setOpen(false)
  }
  // What waits in the panel shows on its button, so a pending request is not hidden behind it.
  // A pinned module shows its own count in the bar, so it is not counted twice.
  const waiting = sections.reduce(
    (sum, section) =>
      section.items.reduce(
        (inner, item) => (preferences.pinned.includes(item.module) ? inner : inner + (item.entry.count?.value ?? 0)),
        sum,
      ),
    0,
  )
  return (
    <>
      <AriaButton
        aria-expanded={isOpen}
        onPress={() => {
          setOpen(true)
        }}
        className={`relative inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill text-text-muted md:min-h-control md:min-w-control data-hovered:bg-inner ${PRESS}`}
      >
        <MenuIcon aria-hidden size={18} />
        <span className="sr-only">{t('navigation.open')}</span>
        {waiting > 0 ? (
          <span className="absolute end-none top-none inline-flex min-w-icon items-center justify-center rounded-pill bg-action-solid px-xs text-micro text-on-action tabular-nums">
            {waiting}
            <span className="sr-only"> {t('navigation.waiting')}</span>
          </span>
        ) : null}
      </AriaButton>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={setOpen}
        isDismissable
        className="enter-scrim fixed inset-none flex justify-start bg-scrim p-sm"
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
              {display ? <DisplayChoices /> : null}
            </nav>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  )
}
