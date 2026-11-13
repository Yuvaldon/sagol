import 'fake-indexeddb/auto'
import { UNIT_TEMPLATES, type UnitTemplate } from '@config'
import {
  LeaveTypeGroupId,
  LeaveTypeId,
  AccessGrantId,
  OrganizationId,
  RoleId,
  SoldierAccountId,
  SoldierId,
  UnitId,
  UnitMembershipId,
  type DataAdapter,
  type Result,
  type Unit,
} from '@contracts'
import { loadLocalData, type IdentityStore } from '@data'
import {
  applyTemplatePlan,
  initialChoices,
  isFreshSetup,
  templateChoiceIssues,
  templatePlan,
  withSectionCount,
  type TemplateBase,
  type TemplateNames,
} from '@logic'
import { describe, expect, it } from 'vitest'

// D-261, D-262: the template's plan is the ordinary commands, so the real local adapter takes it as it is, as the
// owner, right after the claim. `app` is the one layer that may import both `data` and `logic`. Sample data only.

const NOW = '2026-11-12T10:00:00.000Z'

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`unexpected refusal: ${JSON.stringify(result.error)}`)
  return result.value
}

function memoryStore(): IdentityStore {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    subscribe: () => () => undefined,
  }
}

async function claimedData(): Promise<DataAdapter> {
  const { createLocalAuthProvider, createLocalDataAdapter } = await loadLocalData()
  const auth = createLocalAuthProvider(memoryStore())
  const id = crypto.randomUUID()
  const data = createLocalDataAdapter({ identity: auth, time: { now: () => NOW }, rotationLeave: { group: 'Rotation leave', type: 'Rotation leave' } }, { database: `template-${id}`, channel: `template-${id}` })
  valueOf(await auth.signInAs({ email: 'owner@example.test', display_name: null }))
  valueOf(
    await data.commands.organizations.bootstrapOwner({
      organization: { id: OrganizationId.parse(crypto.randomUUID()), name: 'Company', timezone: 'Asia/Jerusalem' },
      soldier: { id: SoldierId.parse(crypto.randomUUID()), first_name: 'Dana', last_name: 'Levi' },
      owner_role: { id: RoleId.parse(crypto.randomUUID()), name: 'Owner' },
      account_id: SoldierAccountId.parse(crypto.randomUUID()),
      access_grant_id: AccessGrantId.parse(crypto.randomUUID()),
      root_unit_id: UnitId.parse(crypto.randomUUID()),
      membership_id: UnitMembershipId.parse(crypto.randomUUID()),
      rotation_group: { id: LeaveTypeGroupId.parse(crypto.randomUUID()), name: 'Rotation leave' },
      rotation_type: { id: LeaveTypeId.parse(crypto.randomUUID()), name: 'Rotation leave 1' },
    }),
  )
  return data
}

/** Every key named after itself. */
function namesOf(template: UnitTemplate): TemplateNames {
  const self = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, key]))
  return {
    levels: self(template.levels.map((level) => level.key)),
    headquarters: 'hq',
    subsection: (position) => `squad ${position}`,
    ranks: Object.fromEntries(template.ranks.map((rank) => [rank.key, { title: rank.key, short: rank.key.slice(0, 3) }])),
    roles: self(template.roles.map((role) => role.key)),
    tagCategories: self(template.tagCategories.map((category) => category.key)),
    tags: self(template.tagCategories.flatMap((category) => category.tags.map((tag) => tag.key))),
    leaveGroups: self(template.leaveGroups.map((group) => group.key)),
    leaveTypes: self(template.leaveGroups.flatMap((group) => group.types.map((type) => type.key))),
    rules: self(template.rules.map((rule) => rule.key)),
  }
}

async function baseOf(data: DataAdapter): Promise<TemplateBase> {
  const { repositories } = data
  const query = { include_archived: true }
  const units = valueOf(await repositories.units.list(query))
  const root = units.find((unit) => unit.parent_id === null)
  if (root === undefined) throw new Error('no root unit')
  return {
    root,
    units,
    levels: valueOf(await repositories.unit_levels.list(query)),
    tagCategories: valueOf(await repositories.tag_categories.list(query)),
    leaveGroups: valueOf(await repositories.leave_type_groups.list(query)),
  }
}

async function fresh(data: DataAdapter): Promise<boolean> {
  const { repositories } = data
  const query = { include_archived: true }
  return isFreshSetup({
    units: valueOf(await repositories.units.list(query)),
    levels: valueOf(await repositories.unit_levels.list(query)),
    ranks: valueOf(await repositories.command_ranks.list(query)),
    bindings: valueOf(await repositories.rank_role_bindings.list(query)),
    leaveTypes: valueOf(await repositories.leave_types.list(query)),
    tagCategories: valueOf(await repositories.tag_categories.list(query)),
    leaveGroups: valueOf(await repositories.leave_type_groups.list(query)),
  })
}

const sectionName = (position: number) => `platoon ${position}`

describe('the company template', () => {
  it('sets up the adjusted company on a fresh claim, through the ordinary commands', async () => {
    const data = await claimedData()
    expect(await fresh(data)).toBe(true)
    const template = UNIT_TEMPLATES.company
    const offered = initialChoices('company', sectionName)
    const choices = {
      ...withSectionCount(offered, 2, sectionName),
      subsectionCount: 2,
      keptLeaveTypes: offered.keptLeaveTypes.filter((key) => key !== 'course' && key !== 'mission'),
      keptTags: offered.keptTags.slice(1),
    }
    expect(templateChoiceIssues(choices)).toEqual([])

    const outcome = await applyTemplatePlan(data.commands, templatePlan(await baseOf(data), choices, namesOf(template)))
    expect(outcome).toEqual({ ok: true })

    const { repositories } = data
    const query = { include_archived: false }
    const units = valueOf(await repositories.units.list(query))
    const levels = valueOf(await repositories.unit_levels.list(query))
    const levelOf = (unit: Unit) => levels.find((level) => level.id === unit.unit_level_id)?.name ?? null
    const root = units.find((unit) => unit.parent_id === null)
    expect(root === undefined ? null : levelOf(root)).toBe('company')
    const sections = units.filter((unit) => unit.parent_id === root?.id).toSorted((a, b) => a.sort_order - b.sort_order)
    expect(sections.map((unit) => [unit.name, levelOf(unit)])).toEqual([
      ['hq', null],
      ['platoon 1', 'platoon'],
      ['platoon 2', 'platoon'],
    ])
    const squads = units.filter((unit) => unit.parent_id === sections[1]?.id).map((unit) => unit.name)
    expect(squads.toSorted()).toEqual(['squad 1', 'squad 2'])
    expect(units).toHaveLength(1 + 3 + 2 * 2)

    expect(valueOf(await repositories.command_ranks.list(query))).toHaveLength(template.ranks.length)
    expect(valueOf(await repositories.rank_role_bindings.list(query))).toHaveLength(template.bindings.length)
    // The duty group lost both its types, so it is not made.
    const groups = valueOf(await repositories.leave_type_groups.list(query)).map((group) => group.name)
    expect(groups).not.toContain('duty')
    // The built-in group's type came with the claim (D-346).
    expect(valueOf(await repositories.leave_types.list(query))).toHaveLength(offered.keptLeaveTypes.length - 2 + 1)
    expect(valueOf(await repositories.tags.list(query))).toHaveLength(offered.keptTags.length - 1)
    expect(valueOf(await repositories.availability_rules.list(query))).toHaveLength(template.rules.length)
    expect(await fresh(data)).toBe(false)
  })

  it('stops at the first refusal and says where, keeping what ran before it', async () => {
    const data = await claimedData()
    const base = await baseOf(data)
    const steps = templatePlan(base, initialChoices('company', sectionName), namesOf(UNIT_TEMPLATES.company))
    // The root moved on since the plan read it, so its level update is refused as stale.
    const rootLevel = steps.findIndex((step) => step.stage === 'root_level')
    valueOf(
      await data.commands.units.update({ id: base.root.id, expected_version: base.root.version, changes: { name: 'Renamed' } }),
    )
    const outcome = await applyTemplatePlan(data.commands, steps)
    expect(outcome).toMatchObject({ ok: false, stage: 'root_level', done: rootLevel })
    expect(valueOf(await data.repositories.unit_levels.list({ include_archived: false }))).toHaveLength(
      UNIT_TEMPLATES.company.levels.length,
    )
  })

  it('sets up only the military and civilian tag categories from the empty template', async () => {
    const data = await claimedData()
    const choices = initialChoices('empty', sectionName)
    const steps = templatePlan(await baseOf(data), choices, namesOf(UNIT_TEMPLATES.empty))
    expect(steps.map((step) => step.stage)).toEqual(['tag_categories', 'tag_categories'])
    expect(await applyTemplatePlan(data.commands, steps)).toEqual({ ok: true })
  })

  it('bounds the section and sub-section counts and needs every section named', () => {
    const offered = initialChoices('company', sectionName)
    const { section, subsection } = UNIT_TEMPLATES.company.structure ?? { section: null, subsection: null }
    if (section === null || subsection === null) throw new Error('the company template has a structure')
    expect(templateChoiceIssues(withSectionCount(offered, section.count.max + 1, sectionName))).toEqual([
      { path: ['sectionNames'], code: 'too_big' },
    ])
    expect(templateChoiceIssues({ ...offered, subsectionCount: subsection.count.min - 1 })).toEqual([
      { path: ['subsectionCount'], code: 'too_small' },
    ])
    expect(templateChoiceIssues({ ...offered, sectionNames: ['A', ' '] })).toEqual([{ path: ['sectionNames', 1], code: 'required' }])
  })
})
