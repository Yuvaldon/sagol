import { PANEL_IDS, type PanelId } from '@config'
import { t, type I18nKey } from '@i18n'
import { useModuleAccess, usePanel } from '@logic'
import type { ComponentType } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { CommandRanksModule } from '../modules/command-ranks/CommandRanksModule'
import { SoldiersModule } from '../modules/soldiers/SoldiersModule'
import { UnitLevelsModule } from '../modules/unit-levels/UnitLevelsModule'
import { UnitsModule } from '../modules/units/UnitsModule'
import { Drawer } from '../patterns/Drawer'

// The map of what opens in the drawer (D-092). A drawer holds one or more sections, and each section is
// its own panel in the URL. A section appears only for who may read it, and a deep link to one they
// may not read opens nothing (D-046).

type ModuleAccess = ReturnType<typeof useModuleAccess>

interface ModuleSection {
  readonly panel: PanelId
  readonly labelKey: I18nKey
  readonly isAllowed: (access: ModuleAccess) => boolean
  readonly Module: ComponentType
}

interface ModuleGroup {
  readonly titleKey: I18nKey
  readonly sections: readonly ModuleSection[]
}

const GROUPS: readonly ModuleGroup[] = [
  {
    titleKey: 'units.title',
    sections: [
      { panel: PANEL_IDS.units, labelKey: 'units.tabTree', isAllowed: (access) => access.units, Module: UnitsModule },
      {
        panel: PANEL_IDS.unitLevels,
        labelKey: 'units.tabLevels',
        isAllowed: (access) => access.unitLevels,
        Module: UnitLevelsModule,
      },
    ],
  },
  {
    titleKey: 'soldiers.title',
    sections: [
      { panel: PANEL_IDS.soldiers, labelKey: 'soldiers.tabList', isAllowed: (access) => access.soldiers, Module: SoldiersModule },
      {
        panel: PANEL_IDS.commandRanks,
        labelKey: 'soldiers.tabRanks',
        isAllowed: (access) => access.commandRanks,
        Module: CommandRanksModule,
      },
    ],
  },
]

export function ModuleDrawer() {
  const panel = usePanel()
  const access = useModuleAccess()
  const group = GROUPS.find((candidate) => candidate.sections.some((section) => section.panel === panel.panel))
  const sections = group?.sections.filter((section) => section.isAllowed(access)) ?? []
  const open = sections.find((section) => section.panel === panel.panel)
  if (group === undefined || open === undefined) return null

  return (
    <Drawer
      titleKey={group.titleKey}
      onClose={panel.close}
      header={
        sections.length < 2 ? null : (
          <nav aria-label={t('common.sections')} className="flex gap-xs rounded-pill bg-inner p-2xs">
            {sections.map((section) => (
              <AriaButton
                key={section.panel}
                aria-current={section.panel === open.panel ? 'page' : false}
                onPress={() => {
                  panel.open(section.panel)
                }}
                className={`flex min-h-touch flex-1 cursor-pointer items-center justify-center rounded-pill text-control font-semibold outline-focus md:min-h-control data-focus-visible:outline-2 ${section.panel === open.panel ? 'bg-surface text-text' : 'text-text-muted'}`}
              >
                {t(section.labelKey)}
              </AriaButton>
            ))}
          </nav>
        )
      }
    >
      <open.Module />
    </Drawer>
  )
}
