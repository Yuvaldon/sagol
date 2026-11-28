import { OrganizationId, SoldierId, TagCategoryId, TagId, type Soldier, type SoldierPrivate, type Tag, type TagCategory } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { cardEditIssues, cardEditValues, cardTagsOf, cardTagsWith, chosenAfter, useCardSave, type CardEditable, type CardSaved } from './cardEdit'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const AT = '2026-11-08T10:00:00.000Z'
const audit = { created_at: AT, created_by: null, updated_at: AT, updated_by: null, archived_at: null }
const SOLDIER: Soldier = { id: SoldierId.parse(uuid(50)), organization_id: ORGANIZATION, first_name: 'דנה', last_name: 'לוי', nickname: null, command_rank_id: null, status: 'active', properties: {}, ...audit, version: 3 }
const ROW: SoldierPrivate = { soldier_id: SOLDIER.id, organization_id: ORGANIZATION, personal_id: '1234567', invite_email: null, phone: '0501234567', ...audit, version: 1 } as SoldierPrivate
const ROLE: TagCategory = { id: TagCategoryId.parse(uuid(1)), organization_id: ORGANIZATION, name: 'תפקיד', selection_mode: 'multiple', default_lifetime: 'persistent', color_key: 'teal', sort_order: 1, ...audit, version: 1 }
const MEDIC: Tag = { id: TagId.parse(uuid(11)), organization_id: ORGANIZATION, category_id: ROLE.id, name: 'חובש', color_key: null, sort_order: 1, ...audit, version: 1 }
const ALL: CardEditable = { profile: true, private: true, tags: true }

describe('the card edit in place (OI-401, D-489)', () => {
  it('answers only the fields the actor may change', () => {
    const values = { ...cardEditValues(SOLDIER, ROW), first_name: '' }
    expect(cardEditIssues(SOLDIER, ALL, values).map((issue) => issue.path.join('.'))).toContain('first_name')
    expect(cardEditIssues(SOLDIER, { profile: false, private: true, tags: false }, values)).toEqual([])
    // The private fields are not the profile's: a valid card has no answer at all.
    expect(cardEditIssues(SOLDIER, ALL, cardEditValues(SOLDIER, ROW))).toEqual([])
  })

  it('saves the profile, the tags and the private details in order, and returns what puts them back', async () => {
    const order: string[] = []
    const update = vi.fn((input: { changes: object }) => {
      order.push('update')
      return Promise.resolve({ ok: true, value: { ...SOLDIER, ...input.changes, version: 4 } })
    })
    const setTags = vi.fn(() => {
      order.push('tags')
      return Promise.resolve({ ok: true, value: [] })
    })
    const updatePrivate = vi.fn(() => {
      order.push('private')
      return Promise.resolve({ ok: true, value: { ...ROW, phone: '0509999999', version: 2 } })
    })
    const ports = fakePorts({ commands: { soldiers: { update, setTags, updatePrivate } } })
    const { result } = renderHook(() => useCardSave(), { wrapper: wrapperOf(ports) })
    const card = cardTagsOf([], SOLDIER, null, [ROLE], [MEDIC])
    const [group] = card.groups
    if (group === undefined) throw new Error('group')
    const chosen = chosenAfter(new Map(), card, group, MEDIC.id, true)
    let saved: Awaited<ReturnType<typeof result.current.run>> | null = null
    await act(async () => {
      saved = await result.current.run({
        soldier: SOLDIER,
        privateRow: ROW,
        editable: ALL,
        values: { ...cardEditValues(SOLDIER, ROW), nickname: 'דני', phone: '0509999999' },
        properties: {},
        tags: { card, chosen },
      })
    })
    expect(order).toEqual(['update', 'tags', 'private'])
    expect(setTags).toHaveBeenCalledWith(expect.objectContaining({ expected_version: 4, tag_ids: [MEDIC.id] }))
    const answer = saved as unknown as { ok: true; value: CardSaved }
    expect(answer.value.changed).toBe(true)
    expect(answer.value.refusal).toBeNull()
    // The undo starts from the versions the save left, and puts back the values the edit opened on.
    expect(answer.value.undo.soldier.version).toBe(5)
    expect([answer.value.undo.values.nickname, answer.value.undo.values.phone]).toEqual(['', '0501234567'])
    expect(answer.value.undo.tags).toEqual({ restore: { persistent: [], rotation: [] }, from: { persistent: [MEDIC.id], rotation: [] }, rotationId: null })
  })

  it('sends nothing when nothing changed', async () => {
    const update = vi.fn()
    const ports = fakePorts({ commands: { soldiers: { update, setTags: update, updatePrivate: update } } })
    const { result } = renderHook(() => useCardSave(), { wrapper: wrapperOf(ports) })
    let changed: boolean | null = null
    await act(async () => {
      const answer = await result.current.run({ soldier: SOLDIER, privateRow: ROW, editable: ALL, values: cardEditValues(SOLDIER, ROW), properties: {}, tags: null })
      changed = answer.ok ? answer.value.changed : null
    })
    expect(changed).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps what was saved when a later command is refused: the versions it left, and its undo (D-490)', async () => {
    const update = vi.fn((input: { changes: object }) => Promise.resolve({ ok: true, value: { ...SOLDIER, ...input.changes, version: 4 } }))
    const updatePrivate = vi.fn(() => Promise.resolve({ ok: false, error: { code: 'forbidden' } }))
    const ports = fakePorts({ commands: { soldiers: { update, setTags: update, updatePrivate } } })
    const { result } = renderHook(() => useCardSave(), { wrapper: wrapperOf(ports) })
    let saved: CardSaved | null = null
    await act(async () => {
      const answer = await result.current.run({
        soldier: SOLDIER,
        privateRow: ROW,
        editable: ALL,
        values: { ...cardEditValues(SOLDIER, ROW), nickname: 'דני', phone: '0509999999' },
        properties: {},
        tags: null,
      })
      saved = answer.ok ? answer.value : null
    })
    const value = saved as unknown as CardSaved
    expect(value.refusal).toEqual({ code: 'forbidden' })
    expect(value.changed).toBe(true)
    // The edit goes on from the version the profile left, so a second ✓ is not stale.
    expect(value.left.soldier.version).toBe(4)
    expect(value.undo.values.nickname).toBe('')
  })

  it('undoes a tag made during the edit, in a category that had none, by putting the sets back as they were', async () => {
    const setTags = vi.fn(() => Promise.resolve({ ok: true, value: [] }))
    const ports = fakePorts({ commands: { soldiers: { update: setTags, setTags, updatePrivate: setTags } } })
    const { result } = renderHook(() => useCardSave(), { wrapper: wrapperOf(ports) })
    const empty: TagCategory = { ...ROLE, id: TagCategoryId.parse(uuid(2)), selection_mode: 'single' }
    const made: Tag = { ...MEDIC, id: TagId.parse(uuid(12)), category_id: empty.id, name: 'נהג' }
    // The category had no live tag: the card had no group for it until the tag was made.
    const opened = cardTagsOf([], SOLDIER, null, [ROLE, empty], [MEDIC])
    expect(opened.groups.map((group) => group.category.id)).toEqual([ROLE.id])
    const card = cardTagsWith(opened, made, empty)
    const chosen = new Map([[empty.id, [made.id]]])
    let undo: CardSaved['undo'] | null = null
    await act(async () => {
      const answer = await result.current.run({ soldier: SOLDIER, privateRow: ROW, editable: { profile: false, private: false, tags: true }, values: cardEditValues(SOLDIER, ROW), properties: {}, tags: { card, chosen } })
      undo = answer.ok ? answer.value.undo : null
    })
    expect(setTags).toHaveBeenLastCalledWith(expect.objectContaining({ tag_ids: [made.id], expected_version: 3 }))
    await act(async () => {
      await result.current.run(undo as unknown as CardSaved['undo'])
    })
    expect(setTags).toHaveBeenLastCalledWith(expect.objectContaining({ tag_ids: [], expected_version: 4 }))
  })
})
