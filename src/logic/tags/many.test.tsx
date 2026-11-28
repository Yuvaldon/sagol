import { DeploymentId, OrganizationId, SoldierId, SoldierTagId, TagCategoryId, TagId, type Soldier, type SoldierTag, type Tag, type TagCategory } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { changedSelection, heldByMany, useSetTagsOfMany, type TagAnswers } from './many'
import { soldierTagGroups } from './tags'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, version: 1, archived_at: null }

function category(n: number, overrides: Partial<TagCategory> = {}): TagCategory {
  return { id: TagCategoryId.parse(uuid(n)), organization_id: ORGANIZATION, name: `c${String(n)}`, selection_mode: 'multiple', default_lifetime: 'persistent', color_key: 'teal', sort_order: n, ...audit, ...overrides }
}

function tag(n: number, categoryN: number): Tag {
  return { id: TagId.parse(uuid(n)), organization_id: ORGANIZATION, category_id: TagCategoryId.parse(uuid(categoryN)), name: `t${String(n)}`, color_key: null, sort_order: n, ...audit }
}

function soldier(n: number): Soldier {
  return { id: SoldierId.parse(uuid(n)), organization_id: ORGANIZATION, first_name: 'א', last_name: 'ב', nickname: null, command_rank_id: null, status: 'active', properties: {}, ...audit }
}

function held(n: number, soldierN: number, tagN: number, deployment: DeploymentId | null = null): SoldierTag {
  return { id: SoldierTagId.parse(uuid(n)), organization_id: ORGANIZATION, soldier_id: SoldierId.parse(uuid(soldierN)), tag_id: TagId.parse(uuid(tagN)), deployment_id: deployment, ...audit }
}

const ROLE = category(1)
const MARITAL = category(2, { selection_mode: 'single' })
const MEDIC = tag(11, 1)
const DRIVER = tag(12, 1)
const SINGLE = tag(21, 2)
const MARRIED = tag(22, 2)
const CATEGORIES = [ROLE, MARITAL]
const TAGS = [MEDIC, DRIVER, SINGLE, MARRIED]
const [FIRST, SECOND] = [soldier(50), soldier(51)]

describe('tags of several soldiers (OI-400, D-489)', () => {
  it('says which tags every chosen soldier holds and which some hold', () => {
    const rows = [held(1, 50, 11), held(2, 51, 11), held(3, 50, 12)]
    const answer = heldByMany(rows, [FIRST, SECOND], null, CATEGORIES, TAGS)
    expect(answer.get(MEDIC.id)).toBe('all')
    expect(answer.get(DRIVER.id)).toBe('some')
    expect(answer.has(SINGLE.id)).toBe(false)
  })

  it('adds and takes tags in order, and a single-choice category keeps one', () => {
    const [role, marital] = soldierTagGroups(CATEGORIES, TAGS, [])
    if (role === undefined || marital === undefined) throw new Error('groups')
    expect(changedSelection(role, [MEDIC.id], [[DRIVER.id, true], [MEDIC.id, false]])).toEqual([DRIVER.id])
    expect(changedSelection(marital, [SINGLE.id], [[MARRIED.id, true]])).toEqual([MARRIED.id])
    // A change of another category leaves the group as it was.
    expect(changedSelection(role, [MEDIC.id], [[MARRIED.id, true]])).toEqual([MEDIC.id])
  })

  it('counts as tagged only a soldier whose sets were sent (D-490)', async () => {
    const setTags = vi.fn(() => Promise.resolve({ ok: true, value: [] }))
    const { result } = renderHook(() => useSetTagsOfMany(), { wrapper: wrapperOf(fakePorts({ commands: { soldiers: { setTags } } })) })
    let answers: TagAnswers | null = null
    await act(async () => {
      const answer = await result.current.run({ soldiers: [FIRST, SECOND], rows: [held(1, 50, 11)], rotationId: null, categories: CATEGORIES, tags: TAGS, changes: [[MEDIC.id, true]] })
      answers = answer.ok ? answer.value : null
    })
    const byId = answers as unknown as TagAnswers
    expect(byId.get(FIRST.id)).toEqual({ ok: true, changed: false })
    expect(byId.get(SECOND.id)).toEqual({ ok: true, changed: true })
    expect(setTags).toHaveBeenCalledTimes(1)
  })
})
