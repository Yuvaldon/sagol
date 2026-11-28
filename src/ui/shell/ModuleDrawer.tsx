import { NEW_ENTITY, PANEL_IDS, type PanelId } from '@config'
import { t, type I18nKey } from '@i18n'
import { useModuleAccess, usePanel, useSetupAccess, useTransferAccess } from '@logic'
import { Suspense, lazy, type ComponentType } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Drawer } from '../patterns/Drawer'
import { LoadingNotice } from '../patterns/Notices'
import { useGrantsAccess, useInboxAccess } from './inboxAccess'

// Each module loads when its drawer first opens, so the entry chunk holds only the board (OI-118, D-210).
const PropertiesModule = lazy(() => import('../modules/properties/PropertiesModule').then((module) => ({ default: module.PropertiesModule })))
const GrantsModule = lazy(() => import('../modules/access/GrantsModule').then((module) => ({ default: module.GrantsModule })))
const RankBindingsModule = lazy(() => import('../modules/access/RankBindingsModule').then((module) => ({ default: module.RankBindingsModule })))
const RolesModule = lazy(() => import('../modules/access/RolesModule').then((module) => ({ default: module.RolesModule })))
const CommandRanksModule = lazy(() => import('../modules/command-ranks/CommandRanksModule').then((module) => ({ default: module.CommandRanksModule })))
const LeaveTypeGroupsModule = lazy(() => import('../modules/leave-types/LeaveTypeGroupsModule').then((module) => ({ default: module.LeaveTypeGroupsModule })))
const LeaveTypesModule = lazy(() => import('../modules/leave-types/LeaveTypesModule').then((module) => ({ default: module.LeaveTypesModule })))
const ClosedLeavesModule = lazy(() => import('../modules/leaves/LeaveInboxModule').then((module) => ({ default: module.ClosedLeavesModule })))
const DashboardModule = lazy(() => import('../modules/presence/DashboardModule').then((module) => ({ default: module.DashboardModule })))
const RulesModule = lazy(() => import('../modules/rules/RulesModule').then((module) => ({ default: module.RulesModule })))
const SetupModule = lazy(() => import('../modules/setup/SetupModule').then((module) => ({ default: module.SetupModule })))
const DeploymentsModule = lazy(() => import('../modules/deployments/DeploymentsModule').then((module) => ({ default: module.DeploymentsModule })))
const TagCategoriesModule = lazy(() => import('../modules/tags/TagCategoriesModule').then((module) => ({ default: module.TagCategoriesModule })))
const TagsModule = lazy(() => import('../modules/tags/TagsModule').then((module) => ({ default: module.TagsModule })))
const SoldiersModule = lazy(() => import('../modules/soldiers/SoldiersModule').then((module) => ({ default: module.SoldiersModule })))
const UnitLevelsModule = lazy(() => import('../modules/unit-levels/UnitLevelsModule').then((module) => ({ default: module.UnitLevelsModule })))
const TransferModule = lazy(() => import('../modules/transfer/TransferModule').then((module) => ({ default: module.TransferModule })))
const UnitsModule = lazy(() => import('../modules/units/UnitsModule').then((module) => ({ default: module.UnitsModule })))

// The map of what opens in the modules' drawer (D-092); a leave and a new leave open in their own (`LeaveDrawer`), and so
// do a person card, a rule, a join request and an archive (D-482): only the full form of a new soldier and the board's
// rules of a day stay here for those two panels. A drawer holds one or more sections, and each section is
// its own panel in the URL. A section appears only for who may read it, and a deep link to one they
// may not read opens nothing (D-046).

type ModuleAccess = ReturnType<typeof useModuleAccess> & {
  readonly inbox: boolean
  readonly grants: boolean
  readonly transfer: boolean
  readonly setup: boolean
}

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
    // The template wizard, opened on the new unit by the onboarding screen; the checklist is in "הגדרות היחידה" (D-297).
    titleKey: 'setup.title',
    sections: [{ panel: PANEL_IDS.setup, labelKey: 'setup.title', isAllowed: (access) => access.setup, Module: SetupModule }],
  },
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
      { panel: PANEL_IDS.soldiers, labelKey: 'soldiers.title', isAllowed: (access) => access.soldiers, Module: SoldiersModule },
    ],
  },
  {
    // Command levels are part of the unit's structure, opened from setup, not a tab of the soldiers (D-285).
    titleKey: 'commandRanks.title',
    sections: [
      {
        panel: PANEL_IDS.commandRanks,
        labelKey: 'commandRanks.title',
        isAllowed: (access) => access.commandRanks,
        Module: CommandRanksModule,
      },
    ],
  },
  {
    titleKey: 'tags.title',
    sections: [
      { panel: PANEL_IDS.tags, labelKey: 'tags.title', isAllowed: (access) => access.tags, Module: TagsModule },
    ],
  },
  {
    // Tag categories are the setup's advanced part: a tag picks one, and seldom needs a new one (D-285).
    titleKey: 'tagCategories.title',
    sections: [
      { panel: PANEL_IDS.tagCategories, labelKey: 'tagCategories.title', isAllowed: (access) => access.tags, Module: TagCategoriesModule },
    ],
  },
  {
    titleKey: 'properties.title',
    sections: [
      { panel: PANEL_IDS.properties, labelKey: 'properties.title', isAllowed: (access) => access.properties, Module: PropertiesModule },
    ],
  },
  {
    titleKey: 'dashboard.title',
    sections: [{ panel: PANEL_IDS.dashboard, labelKey: 'dashboard.title', isAllowed: (access) => access.dashboard, Module: DashboardModule }],
  },
  {
    titleKey: 'rules.title',
    sections: [{ panel: PANEL_IDS.rules, labelKey: 'rules.title', isAllowed: (access) => access.rules, Module: RulesModule }],
  },
  {
    titleKey: 'deployments.title',
    sections: [
      { panel: PANEL_IDS.deployments, labelKey: 'deployments.title', isAllowed: (access) => access.deployments, Module: DeploymentsModule },
    ],
  },
  {
    titleKey: 'leaveTypes.title',
    sections: [
      { panel: PANEL_IDS.leaveTypes, labelKey: 'leaveTypes.tabTypes', isAllowed: (access) => access.leaveTypes, Module: LeaveTypesModule },
      {
        panel: PANEL_IDS.leaveTypeGroups,
        labelKey: 'leaveTypes.tabGroups',
        isAllowed: (access) => access.leaveTypes,
        Module: LeaveTypeGroupsModule,
      },
    ],
  },
  {
    // The requests that closed, which the board does not draw. What waits is on "היום" and its page alone (D-474).
    titleKey: 'inbox.closedLabel',
    sections: [{ panel: PANEL_IDS.leaveClosed, labelKey: 'inbox.closedLabel', isAllowed: (access) => access.inbox, Module: ClosedLeavesModule }],
  },
  {
    titleKey: 'roles.title',
    sections: [
      { panel: PANEL_IDS.roles, labelKey: 'roles.tabRoles', isAllowed: (access) => access.roles, Module: RolesModule },
      {
        panel: PANEL_IDS.rankBindings,
        labelKey: 'roles.tabBindings',
        isAllowed: (access) => access.roles,
        Module: RankBindingsModule,
      },
    ],
  },
  {
    titleKey: 'grants.title',
    sections: [{ panel: PANEL_IDS.accessGrants, labelKey: 'grants.title', isAllowed: (access) => access.grants, Module: GrantsModule }],
  },
  {
    // Opened from the account menu, not the module bar (D-171).
    titleKey: 'transfer.title',
    sections: [{ panel: PANEL_IDS.dataTransfer, labelKey: 'transfer.title', isAllowed: (access) => access.transfer, Module: TransferModule }],
  },
]

export function ModuleDrawer() {
  const panel = usePanel()
  const access = {
    ...useModuleAccess(),
    inbox: useInboxAccess(),
    grants: useGrantsAccess(),
    transfer: useTransferAccess().any,
    setup: useSetupAccess().length > 0,
  }
  // A soldier and a rule open in their own drawers; the modules' drawer keeps only the new soldier's form and the day's rules.
  const ownDrawer =
    (panel.panel === PANEL_IDS.soldiers && panel.entity !== NEW_ENTITY) || (panel.panel === PANEL_IDS.rules && panel.entity !== null)
  const group = ownDrawer ? undefined : GROUPS.find((candidate) => candidate.sections.some((section) => section.panel === panel.panel))
  const sections = group?.sections.filter((section) => section.isAllowed(access)) ?? []
  const open = sections.find((section) => section.panel === panel.panel)
  if (group === undefined || open === undefined) return null

  return (
    <Drawer
      inUrl
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
      <Suspense fallback={<LoadingNotice />}>
        <open.Module />
      </Suspense>
    </Drawer>
  )
}
