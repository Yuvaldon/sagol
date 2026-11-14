import { PANEL_IDS, SETUP_SECTIONS, WORK_SECTIONS, type SetupPanel, type WorkModule } from '@config'
import type { I18nKey } from '@i18n'
import {
  useHome,
  useLinkReviewAccess,
  useModuleAccess,
  useMyLeavesAccess,
  usePanel,
  usePendingRequests,
  usePresenceDay,
  useRotationScope,
  useRulesDay,
  useTransferAccess,
} from '@logic'
import {
  ArrowDownUp,
  ChevronsUp,
  Folders,
  CalendarRange,
  FileText,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListPlus,
  Network,
  Scale,
  Shield,
  Tag,
  Tags,
  UserCheck,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useGrantsAccess, useInboxAccess } from './inboxAccess'

// The modules of the workspace (D-116, D-167, D-173): each one only for who may open it. The bar holds the daily ones
// (my leaves, the inbox); the rest live in the navigation panel (D-285, D-291).

export interface ModuleEntry {
  readonly id: string
  readonly Icon: LucideIcon
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** Whether the destination is the one in sight; a module of the panel never is. */
  readonly current?: boolean
  /** What waits for the actor, read with the module's name (D-120, D-150). */
  readonly count: { readonly value: number; readonly labelKey: I18nKey } | null
}

/** The work modules of the panel this actor may open; a module they may not open is absent (D-076, D-285). */
export function useNavigationEntries(): ReadonlyMap<WorkModule, ModuleEntry> {
  const access = useModuleAccess()
  const panel = usePanel()
  const rules = useRulesDay()
  const links = useLinkReviewAccess()
  const grants = useGrantsAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  // Checked by assignment below: every work module needs an entry (D-178).
  const entries = {
    dashboard: access.dashboard && {
      id: 'dashboard',
      Icon: LayoutDashboard,
      labelKey: 'dashboard.open',
      onPress: opener(PANEL_IDS.dashboard),
      count: null,
    },
    soldiers: access.soldiers && { id: 'soldiers', Icon: Users, labelKey: 'soldiers.open', onPress: opener(PANEL_IDS.soldiers), count: null },
    rules: access.rules && { id: 'rules', Icon: Scale, labelKey: 'rules.open', onPress: rules.open, count: null },
    deployments: access.deployments && {
      id: 'deployments',
      Icon: CalendarRange,
      labelKey: 'deployments.open',
      onPress: opener(PANEL_IDS.deployments),
      count: null,
    },
    access_grants: grants && { id: 'grants', Icon: KeyRound, labelKey: 'grants.open', onPress: opener(PANEL_IDS.accessGrants), count: null },
    account_links: links.allowed && {
      id: 'accountLinks',
      Icon: UserCheck,
      labelKey: 'accountLinks.open',
      onPress: opener(PANEL_IDS.accountLinks),
      count: { value: links.pending, labelKey: 'accountLinks.pendingCount' },
    },
  } satisfies Readonly<Record<WorkModule, ModuleEntry | false>>
  const byModule: Readonly<Record<string, ModuleEntry | false>> = entries
  const allowed = new Map<WorkModule, ModuleEntry>()
  for (const section of WORK_SECTIONS) {
    for (const module of section.modules) {
      const entry = byModule[module]
      if (entry !== undefined && entry !== false) allowed.set(module, entry)
    }
  }
  return allowed
}

/**
 * The setup's modules this actor may open (D-285), each by the module's first panel. A module of several tabs opens
 * on the first one they may read: unit types alone still open the structure.
 */
export function useSetupEntries(): ReadonlyMap<SetupPanel, ModuleEntry> {
  const access = useModuleAccess()
  const panel = usePanel()
  const transfer = useTransferAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  const entries: Readonly<Record<SetupPanel, ModuleEntry | false>> = {
    units: (access.units || access.unitLevels) && {
      id: 'units',
      Icon: Network,
      labelKey: 'units.open',
      onPress: opener(access.units ? PANEL_IDS.units : PANEL_IDS.unitLevels),
      count: null,
    },
    command_ranks: access.commandRanks && {
      id: 'commandRanks',
      Icon: ChevronsUp,
      labelKey: 'commandRanks.open',
      onPress: opener(PANEL_IDS.commandRanks),
      count: null,
    },
    roles: access.roles && { id: 'roles', Icon: Shield, labelKey: 'roles.open', onPress: opener(PANEL_IDS.roles), count: null },
    leave_types: access.leaveTypes && {
      id: 'leaveTypes',
      Icon: Tags,
      labelKey: 'leaveTypes.open',
      onPress: opener(PANEL_IDS.leaveTypes),
      count: null,
    },
    tags: access.tags && { id: 'tags', Icon: Tag, labelKey: 'tags.open', onPress: opener(PANEL_IDS.tags), count: null },
    properties: access.properties && {
      id: 'properties',
      Icon: ListPlus,
      labelKey: 'properties.open',
      onPress: opener(PANEL_IDS.properties),
      count: null,
    },
    data_transfer: transfer.any && {
      id: 'dataTransfer',
      Icon: ArrowDownUp,
      labelKey: 'transfer.open',
      onPress: opener(PANEL_IDS.dataTransfer),
      count: null,
    },
    tag_categories: access.tags && {
      id: 'tagCategories',
      Icon: Folders,
      labelKey: 'tagCategories.open',
      onPress: opener(PANEL_IDS.tagCategories),
      count: null,
    },
  }
  const allowed = new Map<SetupPanel, ModuleEntry>()
  for (const section of SETUP_SECTIONS) {
    for (const id of section.panels) {
      const entry = entries[id]
      if (entry !== false) allowed.set(id, entry)
    }
  }
  return allowed
}

const INBOX_PANELS: readonly string[] = [PANEL_IDS.leaveInbox, PANEL_IDS.leaveClosed]

/**
 * The daily destinations: "mine" first, then the inbox, then today's report (D-120, D-252, D-265). The first two are
 * request surfaces, so they exist only while a rotation they can be about does (D-218); the report
 * is about a rotation's day, so routine has none (D-222).
 */
export function useDailyEntries(): ModuleEntry[] {
  const panel = usePanel()
  const { choose } = useHome()
  const access = useModuleAccess()
  const { openToday } = usePresenceDay()
  const { requests, rotation } = useRotationScope()
  const inbox = useInboxAccess()
  const pending = usePendingRequests()
  const mine = useMyLeavesAccess()
  const entries: (ModuleEntry | false)[] = [
    requests &&
      mine?.view === true && {
      id: 'myLeaves',
      Icon: User,
      labelKey: 'myLeaves.open',
      onPress: () => {
        panel.open(PANEL_IDS.myLeaves)
        choose(true)
      },
      current: panel.panel === PANEL_IDS.myLeaves,
      count: null,
    },
    requests &&
      inbox && {
      id: 'inbox',
      Icon: Inbox,
      labelKey: 'inbox.open',
      onPress: () => {
        panel.open(PANEL_IDS.leaveInbox)
      },
      current: panel.panel !== null && INBOX_PANELS.includes(panel.panel),
      count: { value: pending.status === 'ready' ? pending.value.length : 0, labelKey: 'inbox.pendingCount' },
    },
    rotation !== null &&
      access.soldiers && { id: 'dayReport', Icon: FileText, labelKey: 'presence.title', onPress: openToday, count: null },
  ]
  return entries.filter((entry) => entry !== false)
}
