import { t } from '@i18n'
import { nextSetupStep, usePanel, useSetupAccess, useSetupProgress, useShellPlace } from '@logic'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import { useId } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { SetupChecklist } from '../../modules/setup/SetupModule'
import { IconButton } from '../../primitives/Button'
import { PageFrame, PageHeading } from '../PageFrame'
import { useSettingsSections, type SettingsItem, type SettingsSection } from './rows'

// "הגדרות" (D-456, D-285): what a unit defines once, grouped by what it is, each module with one plain line saying
// what it is for (D-250). While the unit's setup has open steps, its checklist stands first.

function Item({ item }: { readonly item: SettingsItem }) {
  const lineId = useId()
  return (
    <li>
      {/* The module is named by its visible name alone; its line describes it, so the name stays short to read and to find. */}
      <AriaButton
        aria-describedby={lineId}
        onPress={item.entry.onPress}
        className="flex min-h-tab w-full cursor-pointer items-center justify-between gap-md border-b border-divider-strong py-xs text-start outline-focus -outline-offset-2 last:border-b-0 data-focus-visible:outline-2"
      >
        <span className="flex min-w-none flex-col">
          <span className="text-body font-semibold">{t(item.entry.labelKey)}</span>
          <span id={lineId} aria-hidden className="text-small text-text-muted">
            {t(item.lineKey)}
          </span>
        </span>
        <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-muted" />
      </AriaButton>
    </li>
  )
}

/** The checklist of the unit's setup, while a step is open. Mounted only for who has a step. */
function Checklist() {
  const panel = usePanel()
  const progress = useSetupProgress()
  const id = useId()
  if (progress.status !== 'ready' || nextSetupStep(progress.value) === null) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-sm rounded-card bg-surface p-lg">
      <h2 id={id} className="text-heading font-bold">
        {t('setup.title')}
      </h2>
      <SetupChecklist
        steps={progress.value}
        onGo={(step) => {
          panel.open(step.panel)
        }}
      />
    </section>
  )
}

function Section({ section }: { readonly section: SettingsSection }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-xs">
      <h2 id={id} className="text-small font-semibold text-text-muted">
        {t(section.titleKey)}
      </h2>
      <ul className="flex flex-col rounded-card bg-surface px-lg">
        {section.items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}

export function SettingsPage() {
  const place = useShellPlace()
  const sections = useSettingsSections()
  const stepsAllowed = useSetupAccess().length > 0
  return (
    <PageFrame>
      <header className="flex items-center gap-xs">
        <IconButton labelKey="shell.back" onPress={place.closePage}>
          <ArrowRight aria-hidden size={20} />
        </IconButton>
        <PageHeading opens className="text-title font-bold tracking-tight">
          {t('navigation.setupOpen')}
        </PageHeading>
      </header>
      {stepsAllowed ? <Checklist /> : null}
      {sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </PageFrame>
  )
}
