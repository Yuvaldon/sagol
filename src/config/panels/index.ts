import { z } from 'zod'

// Drawer and sheet modules of the workspace (D-023, D-092). A panel id and the entity open inside it
// live in the URL. Each slice adds its own panels.

export const PANEL_IDS = {
  units: 'units',
  unitLevels: 'unit_levels',
  soldiers: 'soldiers',
  commandRanks: 'command_ranks',
  leaveTypes: 'leave_types',
  leaveTypeGroups: 'leave_type_groups',
  /** A new leave (D-115) and a leave's details (D-119). */
  leaves: 'leaves',
  /** The requests inbox: pending requests, and closed ones (D-120). */
  leaveInbox: 'leave_inbox',
  leaveClosed: 'leave_closed',
  /** The actor's own leaves, open and history (D-167). */
  myLeaves: 'my_leaves',
  /** Tags by category, and the categories (D-130). */
  tags: 'tags',
  tagCategories: 'tag_categories',
  /** Present and absent lists of a day (D-134). */
  presence: 'presence',
  /** Availability rules, their conflicts, and the broken rules of a day (D-140, D-141). */
  rules: 'rules',
  /** Requests of an identity to link to a soldier, for review (D-150). */
  accountLinks: 'account_links',
  /** Roles with their permission sets and the baseline role, and the rank bindings (D-165). */
  roles: 'roles',
  rankBindings: 'rank_bindings',
  /** Access grants to one soldier (D-165). */
  accessGrants: 'access_grants',
  /** Import from a file, with its dry-run preview, and the organization's export (D-171). */
  dataTransfer: 'data_transfer',
} as const

export const PanelId = z.enum([
  PANEL_IDS.units,
  PANEL_IDS.unitLevels,
  PANEL_IDS.soldiers,
  PANEL_IDS.commandRanks,
  PANEL_IDS.leaveTypes,
  PANEL_IDS.leaveTypeGroups,
  PANEL_IDS.leaves,
  PANEL_IDS.leaveInbox,
  PANEL_IDS.leaveClosed,
  PANEL_IDS.myLeaves,
  PANEL_IDS.tags,
  PANEL_IDS.tagCategories,
  PANEL_IDS.presence,
  PANEL_IDS.rules,
  PANEL_IDS.accountLinks,
  PANEL_IDS.roles,
  PANEL_IDS.rankBindings,
  PANEL_IDS.accessGrants,
  PANEL_IDS.dataTransfer,
])
export type PanelId = z.infer<typeof PanelId>

/** A long list renders only what is in sight (TanStack Virtual). The height is a first guess, then measured. */
export const VIRTUAL_LIST = { estimatedRowPx: 56, overscanRows: 8 } as const

/** How many module buttons a phone's bottom bar shows before "more" opens the rest (D-165). */
export const PHONE_BAR_MODULES = 4

/** The `entity` value of a form for a row that does not exist yet. */
export const NEW_ENTITY = 'new'

/** A sheet closes when its grip is dragged this far down, or released this fast. */
export const SHEET_DISMISS = { offsetPx: 96, velocityPxPerSecond: 500 } as const

/** Share of a row's height that counts as its top or bottom edge when dropping on it (D-092). */
export const DROP_EDGE_FRACTION = 0.25

/** How far a pointer travels before a press on a handle becomes a drag. */
export const DRAG_ACTIVATION_PX = 4

/** The files of import and export (D-171): what the picker offers, how a CSV is told apart, and the export's name. */
export const TRANSFER_FILES = {
  accept: ['.json', '.csv', 'application/json', 'text/csv'],
  csvExtension: '.csv',
  exportName: 'sagol-export',
  exportExtension: '.json',
  exportMediaType: 'application/json',
} as const
