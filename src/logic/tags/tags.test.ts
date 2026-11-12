import { DeploymentId, OrganizationId, SoldierId, SoldierTagId, TagCategoryId, TagId, type Soldier, type SoldierTag, type Tag, type TagCategory } from '@contracts'
import { describe, expect, it } from 'vitest'
import {
  copiedRotationTags,
  heldInScopes,
  initialLifetimes,
  soldierTagGroups,
  soldierTagScopes,
  tagCategoryFormIssues,
  tagColorOf,
  tagFormIssues,
  tagSections,
  toScopedTagInputs,
  toUpdateTagCategoryInput,
  toUpdateTagInput,
  toggledTags,
} from './tags'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

function category(n: number, name: string, overrides: Partial<TagCategory> = {}): TagCategory {
  return {
    id: TagCategoryId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    name,
    selection_mode: 'multiple',
    default_lifetime: 'persistent',
    color_key: 'teal',
    sort_order: n,
    ...audit,
    ...overrides,
  }
}

function tag(n: number, categoryN: number, name: string, overrides: Partial<Tag> = {}): Tag {
  return {
    id: TagId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    category_id: TagCategoryId.parse(uuid(categoryN)),
    name,
    color_key: null,
    sort_order: n,
    ...audit,
    ...overrides,
  }
}

const SOLDIER: Soldier = {
  id: SoldierId.parse(uuid(50)),
  organization_id: ORGANIZATION,
  first_name: 'דנה',
  last_name: 'לוי',
  nickname: null,
  command_rank_id: null,
  status: 'active',
  properties: {},
  ...audit,
  version: 3,
}

const ROLE = category(1, 'תפקיד')
const MARITAL = category(2, 'מצב משפחתי', { selection_mode: 'single', color_key: 'pink' })
const OLD = category(3, 'ישן', { archived_at: AT })
const MEDIC = tag(11, 1, 'חובש')
const DRIVER = tag(12, 1, 'נהג', { color_key: 'amber' })
const RETIRED = tag(13, 1, 'קשר', { archived_at: AT })
const SINGLE = tag(21, 2, 'רווק')
const MARRIED = tag(22, 2, 'נשוי')
const LEFTOVER = tag(31, 3, 'שריד', { archived_at: AT })
const CATEGORIES = [MARITAL, ROLE, OLD]
const TAGS = [DRIVER, MEDIC, RETIRED, SINGLE, MARRIED, LEFTOVER]

describe('tag sections and colors (D-130)', () => {
  it('lists live categories in order, each with its live tags in order', () => {
    expect(tagSections(CATEGORIES, TAGS).map((section) => [section.category.name, section.tags.map((row) => row.name)])).toEqual([
      ['תפקיד', ['חובש', 'נהג']],
      ['מצב משפחתי', ['רווק', 'נשוי']],
    ])
  })

  it("takes a tag's own color, else its category's (D-015)", () => {
    expect(tagColorOf(DRIVER, CATEGORIES)).toBe('amber')
    expect(tagColorOf(MEDIC, CATEGORIES)).toBe('teal')
  })
})

describe('the tag forms', () => {
  it('answers the same field codes as the adapter', () => {
    expect(tagCategoryFormIssues({ name: '', selection_mode: 'multiple', default_lifetime: 'persistent', color_key: null })).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['name'] }), expect.objectContaining({ path: ['color_key'] })]),
    )
    expect(tagFormIssues({ name: 'x', category_id: null, color_key: null })).toEqual([
      expect.objectContaining({ path: ['category_id'] }),
    ])
  })

  it('sends only what changed, with the version the form opened', () => {
    expect(toUpdateTagCategoryInput(ROLE, 1, { name: 'תפקיד', selection_mode: 'single', default_lifetime: 'rotation', color_key: 'teal' })).toEqual({
      id: ROLE.id,
      expected_version: 1,
      changes: { selection_mode: 'single', default_lifetime: 'rotation' },
    })
    expect(toUpdateTagCategoryInput(ROLE, 1, { name: 'תפקיד', selection_mode: 'multiple', default_lifetime: 'persistent', color_key: 'teal' })).toBeNull()
    expect(toUpdateTagInput(MEDIC, 1, { name: 'חובש', category_id: MEDIC.category_id, color_key: 'red' })).toEqual({
      id: MEDIC.id,
      expected_version: 1,
      changes: { color_key: 'red' },
    })
  })
})

describe("a soldier's tags (D-130)", () => {
  it('offers live tags, and a held archived one so it can be removed', () => {
    const groups = soldierTagGroups(CATEGORIES, TAGS, [RETIRED.id, LEFTOVER.id, SINGLE.id])
    expect(
      groups.map((group) => [group.category.name, group.choices.map((choice) => `${choice.tag.name}${choice.archived ? '*' : ''}`), group.selected.length]),
    ).toEqual([
      ['תפקיד', ['חובש', 'נהג', 'קשר*'], 1],
      ['מצב משפחתי', ['רווק', 'נשוי'], 1],
      ['ישן', ['שריד*'], 1],
    ])
    expect(soldierTagGroups(CATEGORIES, TAGS, []).map((group) => group.category.name)).toEqual(['תפקיד', 'מצב משפחתי'])
  })

  it('keeps one choice in a single category and many in a multiple one', () => {
    const [role, marital] = soldierTagGroups(CATEGORIES, TAGS, [MEDIC.id, SINGLE.id])
    if (role === undefined || marital === undefined) throw new Error('expected two groups')
    expect(toggledTags(marital, MARRIED.id, true)).toEqual([MARRIED.id])
    expect(toggledTags(role, DRIVER.id, true)).toEqual([MEDIC.id, DRIVER.id])
    expect(toggledTags(role, MEDIC.id, false)).toEqual([])
  })

  it('sends the whole set, keeping held tags no group shows, and nothing when unchanged', () => {
    const hidden = TagId.parse(uuid(99))
    const scopes = { persistent: [MEDIC.id, hidden], rotation: [] }
    const groups = soldierTagGroups(CATEGORIES, TAGS, heldInScopes(scopes))
    const lifetimes = initialLifetimes(groups, scopes, null)
    expect(toScopedTagInputs(SOLDIER, 3, null, scopes, groups, new Map(), lifetimes)).toEqual([])
    const chosen = new Map([[ROLE.id, [DRIVER.id]]])
    expect(toScopedTagInputs(SOLDIER, 3, null, scopes, groups, chosen, lifetimes)).toEqual([
      { soldier_id: SOLDIER.id, expected_version: 3, deployment_id: null, tag_ids: [hidden, DRIVER.id] },
    ])
  })
})

describe("a soldier's tags in a rotation (D-260, D-222)", () => {
  const ROTATION = DeploymentId.parse(uuid(70))
  const EARLIER = DeploymentId.parse(uuid(71))
  const SHIFT = category(4, 'משמרת', { default_lifetime: 'rotation' })
  const NIGHT = tag(41, 4, 'לילה')
  const row = (n: number, tagId: TagId, deploymentId: DeploymentId | null): SoldierTag => ({
    id: SoldierTagId.parse(uuid(n)),
    organization_id: ORGANIZATION,
    soldier_id: SOLDIER.id,
    tag_id: tagId,
    deployment_id: deploymentId,
    created_at: AT,
    created_by: null,
  })

  it('splits what a soldier holds by scope', () => {
    const rows = [row(80, MEDIC.id, null), row(81, SINGLE.id, ROTATION), row(82, DRIVER.id, EARLIER)]
    expect(soldierTagScopes(rows, SOLDIER.id, ROTATION)).toEqual({ persistent: [MEDIC.id], rotation: [SINGLE.id] })
    expect(soldierTagScopes(rows, SOLDIER.id, null)).toEqual({ persistent: [MEDIC.id], rotation: [] })
  })

  it('opens each category in the scope that holds it, else its default', () => {
    const scopes = { persistent: [MEDIC.id], rotation: [SINGLE.id] }
    const groups = soldierTagGroups([...CATEGORIES, SHIFT], [...TAGS, NIGHT], heldInScopes(scopes))
    const lifetimes = initialLifetimes(groups, scopes, ROTATION)
    expect(lifetimes.get(ROLE.id)).toBe('persistent')
    expect(lifetimes.get(MARITAL.id)).toBe('rotation')
    expect(lifetimes.get(SHIFT.id)).toBe('rotation')
    expect(initialLifetimes(groups, scopes, null).get(SHIFT.id)).toBe('persistent')
  })

  it('saves the persistent set first, then the rotation set at the next version', () => {
    const scopes = { persistent: [MEDIC.id, SINGLE.id], rotation: [] }
    const groups = soldierTagGroups(CATEGORIES, TAGS, heldInScopes(scopes))
    const lifetimes = new Map([
      [ROLE.id, 'persistent' as const],
      [MARITAL.id, 'rotation' as const],
    ])
    const chosen = new Map([
      [ROLE.id, [DRIVER.id]],
      [MARITAL.id, [MARRIED.id]],
    ])
    expect(toScopedTagInputs(SOLDIER, 3, ROTATION, scopes, groups, chosen, lifetimes)).toEqual([
      { soldier_id: SOLDIER.id, expected_version: 3, deployment_id: null, tag_ids: [SINGLE.id, DRIVER.id] },
      { soldier_id: SOLDIER.id, expected_version: 4, deployment_id: ROTATION, tag_ids: [MARRIED.id] },
    ])
  })

  it('moving a category back to persistent clears it from the rotation', () => {
    const scopes = { persistent: [], rotation: [SINGLE.id] }
    const groups = soldierTagGroups(CATEGORIES, TAGS, heldInScopes(scopes))
    const lifetimes = new Map([[MARITAL.id, 'persistent' as const]])
    const chosen = new Map([[MARITAL.id, [SINGLE.id]]])
    expect(toScopedTagInputs(SOLDIER, 3, ROTATION, scopes, groups, chosen, lifetimes)).toEqual([
      { soldier_id: SOLDIER.id, expected_version: 3, deployment_id: null, tag_ids: [SINGLE.id] },
      { soldier_id: SOLDIER.id, expected_version: 4, deployment_id: ROTATION, tag_ids: [] },
    ])
  })

  it('copies the previous rotation, category by category', () => {
    const groups = soldierTagGroups(CATEGORIES, TAGS, [])
    const copied = copiedRotationTags(groups, [MARRIED.id, LEFTOVER.id])
    expect([...copied.chosen]).toEqual([[MARITAL.id, [MARRIED.id]]])
    expect([...copied.lifetimes]).toEqual([[MARITAL.id, 'rotation']])
  })
})
