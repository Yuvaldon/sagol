import { PANEL_IDS, type PanelId } from '@config'
import { t, type I18nKey } from '@i18n'
import { useModuleAccess, usePanel } from '@logic'
import { Button as AriaButton } from 'react-aria-components'
import { Drawer } from '../../patterns/Drawer'
import { UnitLevelsModule } from '../unit-levels/UnitLevelsModule'
import { UnitsModule } from './UnitsModule'

// One drawer with two sections, each its own panel in the URL (D-092). A section appears only for
// who may read it, and a deep link to one they may not read opens nothing (D-046).

interface Section {
  readonly panel: PanelId
  readonly labelKey: I18nKey
}

const SECTIONS: readonly Section[] = [
  { panel: PANEL_IDS.units, labelKey: 'units.tabTree' },
  { panel: PANEL_IDS.unitLevels, labelKey: 'units.tabLevels' },
]

export function UnitsDrawer() {
  const panel = usePanel()
  const access = useModuleAccess()
  const allowed: Record<PanelId, boolean> = { units: access.units, unit_levels: access.unitLevels }
  if (panel.panel === null || !allowed[panel.panel]) return null
  const open = panel.panel
  const sections = SECTIONS.filter((section) => allowed[section.panel])

  return (
    <Drawer
      titleKey="units.title"
      onClose={panel.close}
      header={
        sections.length < 2 ? null : (
          <nav aria-label={t('units.sections')} className="flex gap-xs rounded-pill bg-inner p-2xs">
            {sections.map((section) => (
              <AriaButton
                key={section.panel}
                aria-current={section.panel === open ? 'page' : false}
                onPress={() => {
                  panel.open(section.panel)
                }}
                className={`flex min-h-touch flex-1 cursor-pointer items-center justify-center rounded-pill text-control font-semibold outline-focus md:min-h-control data-focus-visible:outline-2 ${section.panel === open ? 'bg-surface text-text' : 'text-text-muted'}`}
              >
                {t(section.labelKey)}
              </AriaButton>
            ))}
          </nav>
        )
      }
    >
      {open === PANEL_IDS.units ? <UnitsModule /> : <UnitLevelsModule />}
    </Drawer>
  )
}
