import type { NavigationModule, PermissionResource } from '@contracts'
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
  /** Custom property definitions, by entity type (D-016). */
  properties: 'properties',
  /** Present and absent lists of a day (D-134). */
  presence: 'presence',
  /** Availability rules, their conflicts, and the broken rules of a day (D-140, D-141). */
  rules: 'rules',
  /** Deployments and their members (D-019, D-179). */
  deployments: 'deployments',
  /** Requests of an identity to link to a soldier, for review (D-150). */
  accountLinks: 'account_links',
  /** Roles with their permission sets and the baseline role, and the rank bindings (D-165). */
  roles: 'roles',
  rankBindings: 'rank_bindings',
  /** Access grants to one soldier (D-165). */
  accessGrants: 'access_grants',
  /** Import from a file, with its dry-run preview, and the organization's export (D-171). */
  dataTransfer: 'data_transfer',
  /** The organization's setup steps, each opening its own module (D-033, D-180). */
  setup: 'setup',
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
  PANEL_IDS.properties,
  PANEL_IDS.presence,
  PANEL_IDS.rules,
  PANEL_IDS.deployments,
  PANEL_IDS.accountLinks,
  PANEL_IDS.roles,
  PANEL_IDS.rankBindings,
  PANEL_IDS.accessGrants,
  PANEL_IDS.dataTransfer,
  PANEL_IDS.setup,
])
export type PanelId = z.infer<typeof PanelId>

/** A long list renders only what is in sight (TanStack Virtual). The height is a first guess, then measured. */
export const VIRTUAL_LIST = { estimatedRowPx: 56, overscanRows: 8 } as const

/**
 * The groups of "ניהול יחידה" and their modules, in order (D-254): grouped by what the commander is doing. The daily
 * work stays in the bottom strip; every module here is one press away, and nothing is pinned out of it.
 */
export const NAVIGATION_SECTIONS = [
  { id: 'unit', modules: ['units', 'soldiers', 'deployments'] },
  { id: 'presence', modules: ['leave_types', 'rules'] },
  { id: 'soldierDetails', modules: ['tags', 'properties'] },
  { id: 'access', modules: ['roles', 'access_grants', 'account_links'] },
  { id: 'data', modules: ['data_transfer'] },
] as const satisfies readonly { readonly id: string; readonly modules: readonly NavigationModule[] }[]
export type NavigationSectionId = (typeof NAVIGATION_SECTIONS)[number]['id']


/**
 * The organization's setup, in order (D-033, D-180): each step opens the module that does it, for who may create what
 * it sets up across the organization. Whether a step is done is read from the data, never stored.
 */
export const SETUP_STEPS = [
  { id: 'unit_levels', panel: PANEL_IDS.unitLevels, resource: 'unit_levels' },
  { id: 'units', panel: PANEL_IDS.units, resource: 'units' },
  { id: 'command_ranks', panel: PANEL_IDS.commandRanks, resource: 'command_ranks' },
  { id: 'rank_bindings', panel: PANEL_IDS.rankBindings, resource: 'roles' },
  { id: 'leave_types', panel: PANEL_IDS.leaveTypes, resource: 'leave_types' },
  { id: 'tags', panel: PANEL_IDS.tagCategories, resource: 'tags' },
  { id: 'soldiers', panel: PANEL_IDS.soldiers, resource: 'soldiers' },
  /** The first rotation (D-212): the range picker's "whole rotation" lists it. */
  { id: 'deployments', panel: PANEL_IDS.deployments, resource: 'deployments' },
] as const satisfies readonly { readonly id: string; readonly panel: PanelId; readonly resource: PermissionResource }[]
export type SetupStepId = (typeof SETUP_STEPS)[number]['id']

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
