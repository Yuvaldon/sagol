import { NAVIGATION_SECTIONS, PANEL_IDS } from '@config'
import type { NavigationModule } from '@contracts'
import type { I18nKey } from '@i18n'
import {
  useLinkReviewAccess,
  useModuleAccess,
  useMyLeavesAccess,
  usePanel,
  usePendingRequests,
  useRulesDay,
  useTransferAccess,
} from '@logic'
import {
  ArrowDownUp,
  ClipboardList,
  Inbox,
  KeyRound,
  Network,
  Scale,
  Shield,
  Tag,
  Tags,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useGrantsAccess, useInboxAccess } from './inboxAccess'

// The modules of the workspace (D-116, D-167, D-173): each one only for who may open it. The bar holds the daily ones
// (my leaves, the inbox) and the soldier's pins; the rest live in the navigation panel.

export interface ModuleEntry {
  readonly id: string
  readonly Icon: LucideIcon
  readonly labelKey: I18nKey
  readonly onPress: () => void
  /** What waits for the actor, read with the module's name (D-120, D-150). */
  readonly count: { readonly value: number; readonly labelKey: I18nKey } | null
}

/** The panel's modules this actor may open; a module they may not open is absent (D-076). */
export function useNavigationEntries(): ReadonlyMap<NavigationModule, ModuleEntry> {
  const access = useModuleAccess()
  const panel = usePanel()
  const rules = useRulesDay()
  const links = useLinkReviewAccess()
  const grants = useGrantsAccess()
  const transfer = useTransferAccess()
  const opener = (target: Parameters<typeof panel.open>[0]) => () => {
    panel.open(target)
  }
  const entries: Record<NavigationModule, ModuleEntry | false> = {
    units: access.units && { id: 'units', Icon: Network, labelKey: 'units.open', onPress: opener(PANEL_IDS.units), count: null },
    soldiers: access.soldiers && { id: 'soldiers', Icon: Users, labelKey: 'soldiers.open', onPress: opener(PANEL_IDS.soldiers), count: null },
    leave_types: access.leaveTypes && {
      id: 'leaveTypes',
      Icon: Tags,
      labelKey: 'leaveTypes.open',
      onPress: opener(PANEL_IDS.leaveTypes),
      count: null,
    },
    rules: access.rules && { id: 'rules', Icon: Scale, labelKey: 'rules.open', onPress: rules.open, count: null },
    tags: access.tags && { id: 'tags', Icon: Tag, labelKey: 'tags.open', onPress: opener(PANEL_IDS.tags), count: null },
    roles: access.roles && { id: 'roles', Icon: Shield, labelKey: 'roles.open', onPress: opener(PANEL_IDS.roles), count: null },
    access_grants: grants && { id: 'grants', Icon: KeyRound, labelKey: 'grants.open', onPress: opener(PANEL_IDS.accessGrants), count: null },
    account_links: links.allowed && {
      id: 'accountLinks',
      Icon: UserCheck,
      labelKey: 'accountLinks.open',
      onPress: opener(PANEL_IDS.accountLinks),
      count: { value: links.pending, labelKey: 'accountLinks.pendingCount' },
    },
    data_transfer: transfer.any && {
      id: 'dataTransfer',
      Icon: ArrowDownUp,
      labelKey: 'transfer.open',
      onPress: opener(PANEL_IDS.dataTransfer),
      count: null,
    },
  }
  const allowed = new Map<NavigationModule, ModuleEntry>()
  for (const section of NAVIGATION_SECTIONS) {
    for (const module of section.modules) {
      const entry = entries[module]
      if (entry !== false) allowed.set(module, entry)
    }
  }
  return allowed
}

/** The daily modules: a soldier's own requests first, then the inbox (D-120, D-167). */
export function useDailyEntries(): ModuleEntry[] {
  const panel = usePanel()
  const inbox = useInboxAccess()
  const pending = usePendingRequests()
  const mine = useMyLeavesAccess()
  const entries: (ModuleEntry | false)[] = [
    mine?.view === true && {
      id: 'myLeaves',
      Icon: ClipboardList,
      labelKey: 'myLeaves.open',
      onPress: () => {
        panel.open(PANEL_IDS.myLeaves)
      },
      count: null,
    },
    inbox && {
      id: 'inbox',
      Icon: Inbox,
      labelKey: 'inbox.open',
      onPress: () => {
        panel.open(PANEL_IDS.leaveInbox)
      },
      count: { value: pending.status === 'ready' ? pending.value.length : 0, labelKey: 'inbox.pendingCount' },
    },
  ]
  return entries.filter((entry) => entry !== false)
}
