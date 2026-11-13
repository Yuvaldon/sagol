import { PANEL_IDS, type PanelId } from '@config'
import { t, type I18nKey } from '@i18n'
import { useLinkReviewAccess, useModuleAccess, useMyLeavesAccess, usePanel, useSetupAccess, useTransferAccess } from '@logic'
import { Suspense, lazy, type ComponentType } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { Drawer } from '../patterns/Drawer'
import { LoadingNotice } from '../patterns/Notices'
import { ApproveNowSwitch, MyApproveNowSwitch } from './ApproveNowSwitch'
import { useGrantsAccess, useInboxAccess } from './inboxAccess'

// Each module loads when its drawer first opens, so the entry chunk holds only the board (OI-118, D-210).
const PropertiesModule = lazy(() => import('../modules/properties/PropertiesModule').then((module) => ({ default: module.PropertiesModule })))
const AccountLinksModule = lazy(() => import('../modules/account-links/AccountLinksModule').then((module) => ({ default: module.AccountLinksModule })))
const GrantsModule = lazy(() => import('../modules/access/GrantsModule').then((module) => ({ default: module.GrantsModule })))
const RankBindingsModule = lazy(() => import('../modules/access/RankBindingsModule').then((module) => ({ default: module.RankBindingsModule })))
const RolesModule = lazy(() => import('../modules/access/RolesModule').then((module) => ({ default: module.RolesModule })))
const CommandRanksModule = lazy(() => import('../modules/command-ranks/CommandRanksModule').then((module) => ({ default: module.CommandRanksModule })))
const LeaveTypeGroupsModule = lazy(() => import('../modules/leave-types/LeaveTypeGroupsModule').then((module) => ({ default: module.LeaveTypeGroupsModule })))
const LeaveTypesModule = lazy(() => import('../modules/leave-types/LeaveTypesModule').then((module) => ({ default: module.LeaveTypesModule })))
const ClosedLeavesModule = lazy(() => import('../modules/leaves/LeaveInboxModule').then((module) => ({ default: module.ClosedLeavesModule })))
const PendingRequestsModule = lazy(() => import('../modules/leaves/LeaveInboxModule').then((module) => ({ default: module.PendingRequestsModule })))
const LeavesModule = lazy(() => import('../modules/leaves/LeavesModule').then((module) => ({ default: module.LeavesModule })))
const MyLeavesModule = lazy(() => import('../modules/leaves/MyLeavesModule').then((module) => ({ default: module.MyLeavesModule })))
const RulesModule = lazy(() => import('../modules/rules/RulesModule').then((module) => ({ default: module.RulesModule })))
const SetupModule = lazy(() => import('../modules/setup/SetupModule').then((module) => ({ default: module.SetupModule })))
const DeploymentsModule = lazy(() => import('../modules/deployments/DeploymentsModule').then((module) => ({ default: module.DeploymentsModule })))
const TagCategoriesModule = lazy(() => import('../modules/tags/TagCategoriesModule').then((module) => ({ default: module.TagCategoriesModule })))
const TagsModule = lazy(() => import('../modules/tags/TagsModule').then((module) => ({ default: module.TagsModule })))
const SoldiersModule = lazy(() => import('../modules/soldiers/SoldiersModule').then((module) => ({ default: module.SoldiersModule })))
const UnitLevelsModule = lazy(() => import('../modules/unit-levels/UnitLevelsModule').then((module) => ({ default: module.UnitLevelsModule })))
const TransferModule = lazy(() => import('../modules/transfer/TransferModule').then((module) => ({ default: module.TransferModule })))
const UnitsModule = lazy(() => import('../modules/units/UnitsModule').then((module) => ({ default: module.UnitsModule })))

// The map of what opens in the drawer (D-092). A drawer holds one or more sections, and each section is
// its own panel in the URL. A section appears only for who may read it, and a deep link to one they
// may not read opens nothing (D-046).

type ModuleAccess = ReturnType<typeof useModuleAccess> & {
  readonly inbox: boolean
  readonly accountLinks: boolean
  readonly grants: boolean
  readonly myLeaves: boolean
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
  /** What the group's header holds under its sections, for the whole group. */
  readonly Header?: ComponentType
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
    titleKey: 'leaves.title',
    // A leave opens for whoever may read it, and the form says so when there is nobody to ask for (D-115, D-119).
    sections: [{ panel: PANEL_IDS.leaves, labelKey: 'leaves.newTitle', isAllowed: () => true, Module: LeavesModule }],
  },
  {
    titleKey: 'myLeaves.title',
    // Who approves their own requests but nobody else's has no inbox: the default sits with their requests (D-299).
    Header: MyApproveNowSwitch,
    sections: [{ panel: PANEL_IDS.myLeaves, labelKey: 'myLeaves.title', isAllowed: (access) => access.myLeaves, Module: MyLeavesModule }],
  },
  {
    titleKey: 'inbox.title',
    // The approve-now default sits where approving happens (D-265).
    Header: ApproveNowSwitch,
    sections: [
      { panel: PANEL_IDS.leaveInbox, labelKey: 'inbox.tabPending', isAllowed: (access) => access.inbox, Module: PendingRequestsModule },
      { panel: PANEL_IDS.leaveClosed, labelKey: 'inbox.tabClosed', isAllowed: (access) => access.inbox, Module: ClosedLeavesModule },
    ],
  },
  {
    titleKey: 'accountLinks.title',
    sections: [
      {
        panel: PANEL_IDS.accountLinks,
        labelKey: 'accountLinks.title',
        isAllowed: (access) => access.accountLinks,
        Module: AccountLinksModule,
      },
    ],
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
    accountLinks: useLinkReviewAccess().allowed,
    grants: useGrantsAccess(),
    myLeaves: useMyLeavesAccess()?.view === true,
    transfer: useTransferAccess().any,
    setup: useSetupAccess().length > 0,
  }
  const group = GROUPS.find((candidate) => candidate.sections.some((section) => section.panel === panel.panel))
  const sections = group?.sections.filter((section) => section.isAllowed(access)) ?? []
  const open = sections.find((section) => section.panel === panel.panel)
  if (group === undefined || open === undefined) return null

  return (
    <Drawer
      inUrl
      titleKey={group.titleKey}
      onClose={panel.close}
      header={
        sections.length < 2 && group.Header === undefined ? null : (
          // A header that renders nothing leaves no gap.
          <div className="flex flex-col gap-xs empty:hidden">
            {sections.length < 2 ? null : (
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
            )}
            {group.Header === undefined ? null : <group.Header />}
          </div>
        )
      }
    >
      <Suspense fallback={<LoadingNotice />}>
        <open.Module />
      </Suspense>
    </Drawer>
  )
}
