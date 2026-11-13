import { UNIT_TEMPLATES, type UnitTemplate, type UnitTemplateId } from '@config'
import {
  AvailabilityRuleId,
  CommandRankId,
  LeaveTypeGroupId,
  LeaveTypeId,
  PermissionSet,
  RankRoleBindingId,
  RoleId,
  TagCategoryId,
  TagId,
  UnitId,
  UnitLevelId,
  type AppError,
  type CommandRank,
  type CreateAvailabilityRuleInput,
  type CreateCommandRankInput,
  type CreateLeaveTypeGroupInput,
  type CreateLeaveTypeInput,
  type CreateRankRoleBindingInput,
  type CreateRoleInput,
  type CreateTagCategoryInput,
  type CreateTagInput,
  type CreateUnitInput,
  type CreateUnitLevelInput,
  type DataCommands,
  type Issue,
  type LeaveType,
  type LeaveTypeGroup,
  type PermissionCheck,
  type RankRoleBinding,
  type Result,
  type TagCategory,
  type Unit,
  type UnitLevel,
  type UpdateUnitInput,
} from '@contracts'
import { useRankBindings } from '../access/hooks'
import { nextSortOrder } from '../forms/order'
import { useLeaveTypeGroups, useLeaveTypes } from '../leaves/hooks'
import { isRotationLeave } from '../leaves/leaveTypes'
import { useCanAnswers } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { useCommand } from '../queries/command'
import type { Loaded } from '../queries/loaded'
import { useCommandRanks } from '../roster/hooks'
import { usePorts } from '../runtime/context'
import { useTagCategories } from '../tags/hooks'
import { useUnitLevels, useUnits } from '../units/hooks'

// Setting up a unit from a template (D-261, D-262, D-223). The adjusted template becomes a list of the ordinary
// create commands, run one after another; the first refusal stops the run and names its stage. Nothing of the
// template is stored: what it made are ordinary rows, edited and archived like any other.

/** What the commander adjusts before "סיום". Keys are the template's own. */
export interface TemplateChoices {
  readonly templateId: UnitTemplateId
  /** One name per section, in order; their number is the section count. */
  readonly sectionNames: readonly string[]
  readonly subsectionCount: number
  readonly keptLeaveTypes: readonly string[]
  readonly keptTags: readonly string[]
}

/** The names the UI resolves from i18n, by template key (logic never reads i18n). */
export interface TemplateNames {
  readonly levels: Readonly<Record<string, string>>
  readonly headquarters: string
  /** A sub-section's name from its 1-based position under its section. */
  readonly subsection: (position: number) => string
  readonly ranks: Readonly<Record<string, { readonly title: string; readonly short: string }>>
  readonly roles: Readonly<Record<string, string>>
  readonly tagCategories: Readonly<Record<string, string>>
  readonly tags: Readonly<Record<string, string>>
  readonly leaveGroups: Readonly<Record<string, string>>
  readonly leaveTypes: Readonly<Record<string, string>>
  readonly rules: Readonly<Record<string, string>>
}

/** One command of the plan. The stage is what a refusal reports. */
export type TemplateStep =
  | { readonly stage: 'unit_levels'; readonly input: CreateUnitLevelInput }
  | { readonly stage: 'root_level'; readonly input: UpdateUnitInput }
  | { readonly stage: 'units'; readonly input: CreateUnitInput }
  | { readonly stage: 'command_ranks'; readonly input: CreateCommandRankInput }
  | { readonly stage: 'roles'; readonly input: CreateRoleInput }
  | { readonly stage: 'rank_bindings'; readonly input: CreateRankRoleBindingInput }
  | { readonly stage: 'tag_categories'; readonly input: CreateTagCategoryInput }
  | { readonly stage: 'tags'; readonly input: CreateTagInput }
  | { readonly stage: 'leave_type_groups'; readonly input: CreateLeaveTypeGroupInput }
  | { readonly stage: 'leave_types'; readonly input: CreateLeaveTypeInput }
  | { readonly stage: 'rules'; readonly input: CreateAvailabilityRuleInput }
export type TemplateStage = TemplateStep['stage']

/** What already exists, so new rows sort after it. A fresh setup has only the root (D-251). */
export interface TemplateBase {
  readonly root: Unit
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly tagCategories: readonly TagCategory[]
  readonly leaveGroups: readonly LeaveTypeGroup[]
}

/** The template as offered: every count at its initial value, every leave type and tag kept. */
export function initialChoices(templateId: UnitTemplateId, sectionName: (position: number) => string): TemplateChoices {
  const template: UnitTemplate = UNIT_TEMPLATES[templateId]
  const sections = template.structure?.section.count.initial ?? 0
  return {
    templateId,
    sectionNames: Array.from({ length: sections }, (_, index) => sectionName(index + 1)),
    subsectionCount: template.structure?.subsection.count.initial ?? 0,
    keptLeaveTypes: template.leaveGroups.flatMap((group) => group.types.map((type) => type.key)),
    keptTags: template.tagCategories.flatMap((category) => category.tags.map((tag) => tag.key)),
  }
}

/** The choices with the section count changed: added sections take their default names, removed ones go. */
export function withSectionCount(
  choices: TemplateChoices,
  count: number,
  sectionName: (position: number) => string,
): TemplateChoices {
  const sectionNames = Array.from({ length: count }, (_, index) => choices.sectionNames[index] ?? sectionName(index + 1))
  return { ...choices, sectionNames }
}

/** Empty section names and counts outside the template's bounds. */
export function templateChoiceIssues(choices: TemplateChoices): Issue[] {
  const structure: UnitTemplate['structure'] = UNIT_TEMPLATES[choices.templateId].structure
  if (structure === null) return []
  const { section, subsection } = structure
  const issues: Issue[] = []
  const bounds = (path: string, value: number, count: { min: number; max: number }) => {
    if (!Number.isInteger(value)) issues.push({ path: [path], code: 'not_integer' })
    else if (value < count.min) issues.push({ path: [path], code: 'too_small' })
    else if (value > count.max) issues.push({ path: [path], code: 'too_big' })
  }
  bounds('sectionNames', choices.sectionNames.length, section.count)
  bounds('subsectionCount', choices.subsectionCount, subsection.count)
  choices.sectionNames.forEach((name, index) => {
    if (name.trim() === '') issues.push({ path: ['sectionNames', index], code: 'required' })
  })
  return issues
}

function named(names: Readonly<Record<string, string>>, key: string): string {
  const name = names[key]
  if (name === undefined) throw new Error(`A template name is missing: ${key}`)
  return name
}

function idOf<T>(ids: ReadonlyMap<string, T>, key: string): T {
  const id = ids.get(key)
  if (id === undefined) throw new Error(`A template key is not defined: ${key}`)
  return id
}

function permissionsOf(permissions: UnitTemplate['roles'][number]['permissions']): PermissionSet {
  // Parsed, so a pair the template names wrongly fails here, not at the adapter.
  return PermissionSet.parse(
    Object.entries(permissions).flatMap(([resource, actions]) => (actions ?? []).map((action) => ({ resource, action }))),
  )
}

const NEW_UNIT = { code: null, kind: 'standing', valid_from: null, valid_to: null, color_key: null, properties: {} } as const

/** The commands that set the template up, in the order they must run. */
export function templatePlan(base: TemplateBase, choices: TemplateChoices, names: TemplateNames): TemplateStep[] {
  const template: UnitTemplate = UNIT_TEMPLATES[choices.templateId]
  const steps: TemplateStep[] = []

  const levelIds = new Map(template.levels.map((level) => [level.key, UnitLevelId.parse(crypto.randomUUID())]))
  const firstLevel = nextSortOrder(base.levels)
  template.levels.forEach((level, index) => {
    const input = { id: idOf(levelIds, level.key), name: named(names.levels, level.key), sort_order: firstLevel + index }
    steps.push({ stage: 'unit_levels', input })
  })

  const structure = template.structure
  if (structure !== null) {
    const changes = { unit_level_id: idOf(levelIds, structure.rootLevel) }
    steps.push({ stage: 'root_level', input: { id: base.root.id, expected_version: base.root.version, changes } })
    const underRoot = base.units.filter((unit) => unit.parent_id === base.root.id)
    let order = nextSortOrder(underRoot)
    const child = (parent: UnitId, name: string, level: UnitLevelId | null, sort: number): CreateUnitInput => ({
      ...NEW_UNIT,
      id: UnitId.parse(crypto.randomUUID()),
      parent_id: parent,
      sort_order: sort,
      name,
      unit_level_id: level,
    })
    // The headquarters has no level, so a rule on each section skips it.
    if (structure.headquarters) steps.push({ stage: 'units', input: child(base.root.id, names.headquarters, null, order++) })
    const sectionLevel = idOf(levelIds, structure.section.level)
    const subsectionLevel = idOf(levelIds, structure.subsection.level)
    for (const name of choices.sectionNames) {
      const section = child(base.root.id, name.trim(), sectionLevel, order++)
      steps.push({ stage: 'units', input: section })
      for (let position = 1; position <= choices.subsectionCount; position++) {
        steps.push({ stage: 'units', input: child(section.id, names.subsection(position), subsectionLevel, position - 1) })
      }
    }
  }

  const rankIds = new Map(template.ranks.map((rank) => [rank.key, CommandRankId.parse(crypto.randomUUID())]))
  for (const rank of template.ranks) {
    const rankName = names.ranks[rank.key]
    if (rankName === undefined) throw new Error(`A template name is missing: ${rank.key}`)
    const { title, short } = rankName
    steps.push({
      stage: 'command_ranks',
      input: { id: idOf(rankIds, rank.key), title, short_title: short, seniority: rank.seniority, color_key: rank.color },
    })
  }

  const roleIds = new Map(template.roles.map((role) => [role.key, RoleId.parse(crypto.randomUUID())]))
  for (const role of template.roles) {
    steps.push({
      stage: 'roles',
      input: {
        id: idOf(roleIds, role.key),
        name: named(names.roles, role.key),
        description: null,
        color_key: role.color,
        permissions: permissionsOf(role.permissions),
      },
    })
  }

  for (const binding of template.bindings) {
    steps.push({
      stage: 'rank_bindings',
      input: {
        id: RankRoleBindingId.parse(crypto.randomUUID()),
        command_rank_id: idOf(rankIds, binding.rank),
        role_id: idOf(roleIds, binding.role),
        anchor_type: binding.anchor,
        anchor_unit_id: null,
        anchor_soldier_id: null,
        anchor_level_id: null,
        anchor_steps: null,
        // A section's commanders cover its sub-sections.
        include_descendants: binding.anchor === 'home_unit',
        subject_rank_constraint: 'any',
      },
    })
  }

  const firstCategory = nextSortOrder(base.tagCategories)
  template.tagCategories.forEach((category, index) => {
    const id = TagCategoryId.parse(crypto.randomUUID())
    steps.push({
      stage: 'tag_categories',
      input: {
        id,
        name: named(names.tagCategories, category.key),
        selection_mode: category.selection,
        default_lifetime: category.lifetime,
        color_key: category.color,
        sort_order: firstCategory + index,
      },
    })
    category.tags
      .filter((tag) => choices.keptTags.includes(tag.key))
      .forEach((tag, position) => {
        const input = {
          id: TagId.parse(crypto.randomUUID()),
          category_id: id,
          name: named(names.tags, tag.key),
          color_key: tag.color,
          sort_order: position,
        }
        steps.push({ stage: 'tags', input })
      })
  })

  // A group none of whose types is kept is not made.
  const groups = template.leaveGroups
    .map((group) => ({ ...group, types: group.types.filter((type) => choices.keptLeaveTypes.includes(type.key)) }))
    .filter((group) => group.types.length > 0)
  const firstGroup = nextSortOrder(base.leaveGroups)
  groups.forEach((group, index) => {
    const id = LeaveTypeGroupId.parse(crypto.randomUUID())
    steps.push({ stage: 'leave_type_groups', input: { id, name: named(names.leaveGroups, group.key), sort_order: firstGroup + index } })
    group.types.forEach((type, position) => {
      const input = {
        id: LeaveTypeId.parse(crypto.randomUUID()),
        group_id: id,
        name: named(names.leaveTypes, type.key),
        color_key: type.color,
        icon_key: type.icon,
        availability_effect: type.effect,
        requires_reason: type.requiresReason,
        sort_order: position,
      }
      steps.push({ stage: 'leave_types', input })
    })
  })

  // Rules are on the root's tree; a rule needs the structure it counts.
  if (structure !== null) {
    for (const rule of template.rules) {
      steps.push({
        stage: 'rules',
        input: {
          id: AvailabilityRuleId.parse(crypto.randomUUID()),
          name: named(names.rules, rule.key),
          description: null,
          is_enabled: true,
          priority: 0,
          enforcement: rule.enforcement,
          scope_unit_id: base.root.id,
          scope_mode: rule.scope,
          scope_level_id: rule.level === null ? null : idOf(levelIds, rule.level),
          population_filter: {},
          group_by: 'none',
          group_tag_category_id: null,
          metric: rule.metric,
          min_value: rule.min,
          max_value: null,
          effective_from: null,
          effective_to: null,
          deployment_id: null,
          count_pending_as_unavailable: false,
        },
      })
    }
  }

  return steps
}

function runStep(commands: DataCommands, step: TemplateStep): Promise<Result<unknown>> {
  switch (step.stage) {
    case 'unit_levels':
      return commands.unit_levels.create(step.input)
    case 'root_level':
      return commands.units.update(step.input)
    case 'units':
      return commands.units.create(step.input)
    case 'command_ranks':
      return commands.command_ranks.create(step.input)
    case 'roles':
      return commands.roles.create(step.input)
    case 'rank_bindings':
      return commands.rank_role_bindings.create(step.input)
    case 'tag_categories':
      return commands.tag_categories.create(step.input)
    case 'tags':
      return commands.tags.create(step.input)
    case 'leave_type_groups':
      return commands.leave_type_groups.create(step.input)
    case 'leave_types':
      return commands.leave_types.create(step.input)
    case 'rules':
      return commands.availability_rules.create(step.input)
  }
}

/** All the steps ran, or the first refusal, with how many ran before it. */
export type TemplateOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly stage: TemplateStage; readonly error: AppError; readonly done: number }

/** Runs the steps one after another and stops at the first refusal; what ran before it stays (D-261). */
export async function applyTemplatePlan(commands: DataCommands, steps: readonly TemplateStep[]): Promise<TemplateOutcome> {
  for (const [done, step] of steps.entries()) {
    const result = await runStep(commands, step)
    if (!result.ok) return { ok: false, stage: step.stage, error: result.error, done }
  }
  return { ok: true }
}

const ORGANIZATION = { kind: 'organization' } as const

/** What the template writes, across the organization, and the root's level. */
const TEMPLATE_CHECKS: readonly PermissionCheck[] = [
  ...(['unit_levels', 'units', 'command_ranks', 'roles', 'tags', 'leave_types', 'availability_rules'] as const).map(
    (resource): PermissionCheck => ({ permission: { resource, action: 'create' }, target: ORGANIZATION }),
  ),
  { permission: { resource: 'units', action: 'update' }, target: ORGANIZATION },
]

const live = <Row extends { readonly archived_at: string | null }>(rows: readonly Row[]) =>
  rows.filter((row) => row.archived_at === null)

/**
 * A fresh setup: the root alone, and none of what a template sets up. The built-in group's types come with the
 * claim, like the root, so they do not count (D-347).
 */
export function isFreshSetup(rows: {
  readonly units: readonly Unit[]
  readonly levels: readonly UnitLevel[]
  readonly ranks: readonly CommandRank[]
  readonly bindings: readonly RankRoleBinding[]
  readonly leaveTypes: readonly LeaveType[]
  readonly tagCategories: readonly TagCategory[]
  readonly leaveGroups: readonly LeaveTypeGroup[]
}): boolean {
  const units = live(rows.units)
  const leaveTypes = rows.leaveTypes.filter((type) => !isRotationLeave(type, rows.leaveGroups))
  return (
    units.length === 1 &&
    units[0]?.parent_id === null &&
    live(rows.levels).length +
      live(rows.ranks).length +
      live(rows.bindings).length +
      live(leaveTypes).length +
      live(rows.tagCategories).length ===
      0
  )
}

/**
 * The base to set a template up on, or NULL when there is no template to offer: the setup is not fresh, or the
 * actor may not write all of it. The checklist shows instead (D-180, D-262).
 */
export function useTemplateOffer(): Loaded<TemplateBase | null> {
  const { can, known } = useCanAnswers(TEMPLATE_CHECKS)
  const allowed = TEMPLATE_CHECKS.every((check) => can(check))
  const sources = [useUnits(), useUnitLevels(), useCommandRanks(), useRankBindings(), useLeaveTypes(), useTagCategories(), useLeaveTypeGroups()] as const
  const [units, levels, ranks, bindings, leaveTypes, tagCategories, leaveGroups] = sources
  // Until the answers come, "nothing to offer" would be a guess, and the drawer hands over on it (D-297).
  if (!TEMPLATE_CHECKS.every((check) => known(check))) return { status: 'loading' }
  if (!allowed) return { status: 'ready', value: null }
  for (const source of sources) {
    if (source.status === 'loading' || source.status === 'failed') return source
  }
  if (
    units.status !== 'ready' ||
    levels.status !== 'ready' ||
    ranks.status !== 'ready' ||
    bindings.status !== 'ready' ||
    leaveTypes.status !== 'ready' ||
    tagCategories.status !== 'ready' ||
    leaveGroups.status !== 'ready'
  ) {
    return { status: 'ready', value: null }
  }
  const rows = {
    units: units.value,
    levels: levels.value,
    ranks: ranks.value,
    bindings: bindings.value,
    leaveTypes: leaveTypes.value,
    tagCategories: tagCategories.value,
    leaveGroups: leaveGroups.value,
  }
  const root = live(units.value).find((unit) => unit.parent_id === null)
  if (!isFreshSetup(rows) || root === undefined) return { status: 'ready', value: null }
  return {
    status: 'ready',
    value: { root, units: units.value, levels: levels.value, tagCategories: tagCategories.value, leaveGroups: leaveGroups.value },
  }
}

/**
 * Sets the template up. The answer is always a result, so every read it touched refreshes, even after a refusal
 * part of the way through; the outcome says how it ended.
 */
export function useApplyTemplate() {
  const { data } = usePorts()
  return useCommand(
    [QUERY_KEYS.tables],
    async ({ base, choices, names }: { base: TemplateBase; choices: TemplateChoices; names: TemplateNames }) => {
      const outcome = await applyTemplatePlan(data.commands, templatePlan(base, choices, names))
      const answer: Result<TemplateOutcome> = { ok: true, value: outcome }
      return answer
    },
  )
}
