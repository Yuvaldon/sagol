import { describe, expect, it } from 'vitest'
import { DeploymentId, SoldierId, TagCategoryId, TagId } from '@contracts'
import {
  archiveTagCategoryIssues,
  effectiveSoldierTags,
  scopeTagIds,
  selectionModeChangeIssues,
  tagSelectionIssues,
} from './index'

// Test data only (iron rule 4).
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const CATEGORY = { marital: TagCategoryId.parse(uuid(1)), skills: TagCategoryId.parse(uuid(2)) }
const TAG = {
  single: TagId.parse(uuid(11)),
  married: TagId.parse(uuid(12)),
  medic: TagId.parse(uuid(21)),
  driver: TagId.parse(uuid(22)),
  unknown: TagId.parse(uuid(99)),
}
const TAGS = [
  { id: TAG.single, category_id: CATEGORY.marital },
  { id: TAG.married, category_id: CATEGORY.marital },
  { id: TAG.medic, category_id: CATEGORY.skills },
  { id: TAG.driver, category_id: CATEGORY.skills },
]
const CATEGORIES = [
  { id: CATEGORY.marital, selection_mode: 'single' as const },
  { id: CATEGORY.skills, selection_mode: 'multiple' as const },
]
const A = SoldierId.parse(uuid(31))
const B = SoldierId.parse(uuid(32))
const ROTATION = DeploymentId.parse(uuid(41))
const OTHER = DeploymentId.parse(uuid(42))

describe('tagSelectionIssues (D-015)', () => {
  it('allows one tag of a single category and many of a multiple one', () => {
    expect(tagSelectionIssues([TAG.single, TAG.medic, TAG.driver], TAGS, CATEGORIES)).toEqual([])
  })

  it('reports the second tag of a single category at its index', () => {
    expect(tagSelectionIssues([TAG.medic, TAG.single, TAG.driver, TAG.married], TAGS, CATEGORIES)).toEqual([
      { path: ['tag_ids', 3], code: 'tag_single_selection' },
    ])
  })

  it('leaves unknown tags to the data layer', () => {
    expect(tagSelectionIssues([TAG.unknown, TAG.single], TAGS, CATEGORIES)).toEqual([])
  })
})

describe('selectionModeChangeIssues', () => {
  it('refuses switching to single while a soldier holds two of its tags', () => {
    const soldierTags = [
      { soldier_id: A, tag_id: TAG.medic, deployment_id: null },
      { soldier_id: B, tag_id: TAG.medic, deployment_id: null },
      { soldier_id: A, tag_id: TAG.driver, deployment_id: null },
    ]
    expect(selectionModeChangeIssues(CATEGORY.skills, 'single', TAGS, soldierTags)).toEqual([
      { path: ['selection_mode'], code: 'tag_single_selection' },
    ])
    expect(selectionModeChangeIssues(CATEGORY.skills, 'multiple', TAGS, soldierTags)).toEqual([])
  })

  it('allows it when every soldier holds at most one', () => {
    const soldierTags = [
      { soldier_id: A, tag_id: TAG.medic, deployment_id: null },
      { soldier_id: B, tag_id: TAG.driver, deployment_id: null },
      { soldier_id: A, tag_id: TAG.single, deployment_id: null },
    ]
    expect(selectionModeChangeIssues(CATEGORY.skills, 'single', TAGS, soldierTags)).toEqual([])
  })
})

describe('tag scopes (D-260, D-221)', () => {
  it('holds single within each scope, not across them', () => {
    const soldierTags = [
      { soldier_id: A, tag_id: TAG.medic, deployment_id: null },
      { soldier_id: A, tag_id: TAG.driver, deployment_id: ROTATION },
    ]
    expect(selectionModeChangeIssues(CATEGORY.skills, 'single', TAGS, soldierTags)).toEqual([])
  })

  it('reads persistent tags plus the rotation\'s, a single rotation tag replacing the persistent one', () => {
    const soldierTags = [
      { soldier_id: A, tag_id: TAG.single, deployment_id: null },
      { soldier_id: A, tag_id: TAG.medic, deployment_id: null },
      { soldier_id: A, tag_id: TAG.married, deployment_id: ROTATION },
      { soldier_id: A, tag_id: TAG.driver, deployment_id: OTHER },
      { soldier_id: B, tag_id: TAG.single, deployment_id: null },
    ]
    const ids = (rotation: DeploymentId | null) =>
      effectiveSoldierTags(soldierTags, rotation, TAGS, CATEGORIES).map((row) => `${row.soldier_id}:${row.tag_id}`)
    expect(ids(ROTATION).sort()).toEqual([`${A}:${TAG.married}`, `${A}:${TAG.medic}`, `${B}:${TAG.single}`].sort())
    expect(ids(null).sort()).toEqual([`${A}:${TAG.medic}`, `${A}:${TAG.single}`, `${B}:${TAG.single}`].sort())
    expect(scopeTagIds(soldierTags, A, OTHER)).toEqual([TAG.driver])
  })
})

describe('archiveTagCategoryIssues (D-130)', () => {
  const live = (id: TagId, category_id: TagCategoryId) => ({ id, category_id, archived_at: null })
  it('refuses a category that holds a live tag', () => {
    expect(archiveTagCategoryIssues([live(TAG.medic, CATEGORY.skills)], CATEGORY.skills)).toEqual([
      { path: [], code: 'group_in_use' },
    ])
  })
  it('allows a category whose tags are all archived, or that has none', () => {
    const archived = { ...live(TAG.medic, CATEGORY.skills), archived_at: '2026-11-08T10:00:00.000Z' }
    expect(archiveTagCategoryIssues([archived, live(TAG.single, CATEGORY.marital)], CATEGORY.skills)).toEqual([])
  })
})
