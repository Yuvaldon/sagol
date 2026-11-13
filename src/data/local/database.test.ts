import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { openDatabase } from './database'
import { STORES } from './store'

// The local database's move to format 3 (D-221). Sample rows, test file only.

const ORG = '0a1b2c3d-1111-4aaa-8aaa-000000000001'
const SOLDIER = '0a1b2c3d-1111-4aaa-8aaa-000000000002'
const TAG = '0a1b2c3d-1111-4aaa-8aaa-000000000003'
const CATEGORY = '0a1b2c3d-1111-4aaa-8aaa-000000000004'
const DEPLOYMENT = '0a1b2c3d-1111-4aaa-8aaa-000000000005'
const ROLE = '0a1b2c3d-1111-4aaa-8aaa-000000000006'
const VIEWER = '0a1b2c3d-1111-4aaa-8aaa-000000000007'
const FIRST = '0a1b2c3d-1111-4aaa-8aaa-000000000008'
const SECOND = '0a1b2c3d-1111-4aaa-8aaa-000000000009'
const PLACED = '0a1b2c3d-1111-4aaa-8aaa-00000000000a'
const UNPLACED = '0a1b2c3d-1111-4aaa-8aaa-00000000000b'
const GONE = '0a1b2c3d-1111-4aaa-8aaa-00000000000c'
const TIME = { now: () => '2026-11-13T08:00:00.000Z' }
const ROTATION_LEAVE = { group: 'Rotation leaves', type: 'Rotation leave' }

describe('local database versions', () => {
  it('moves a version 2 store to format 3, keeping every soldier tag', async () => {
    const name = `sagol-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(2).stores({ ...STORES, soldier_tags: '[soldier_id+tag_id], organization_id, tag_id' })
    await old.table('soldier_tags').add({ soldier_id: SOLDIER, tag_id: TAG, organization_id: ORG, created_at: 'x', created_by: null })
    await old.table('tag_categories').add({ id: CATEGORY, organization_id: ORG, selection_mode: 'single' })
    await old.table('deployments').add({ id: DEPLOYMENT, organization_id: ORG, end_date: null })
    old.close()

    const store = openDatabase(name, TIME, ROTATION_LEAVE)
    const [tag] = await store.table('soldier_tags').toArray()
    expect(tag).toMatchObject({ soldier_id: SOLDIER, tag_id: TAG, deployment_id: null })
    expect(typeof (tag as { id: unknown }).id).toBe('string')
    expect(await store.table('tag_categories').get(CATEGORY)).toMatchObject({ default_lifetime: 'persistent' })
    expect(await store.table('deployments').get(DEPLOYMENT)).toMatchObject({ closed_at: null, closed_by: null, report_owner_id: null })
    store.close()
  })

  it('adds the report confirmations to a version 6 store, names no report owner, and lets who approves confirm (D-293)', async () => {
    const name = `sagol-${crypto.randomUUID()}`
    const { report_confirmations: _confirmations, ...earlier } = STORES
    const old = new Dexie(name)
    old.version(6).stores(earlier)
    await old.table('deployments').add({ id: DEPLOYMENT, organization_id: ORG, end_date: null, closed_at: null, closed_by: null })
    await old.table('role_permissions').bulkAdd([
      { role_id: ROLE, organization_id: ORG, resource: 'leaves', action: 'approve' },
      { role_id: VIEWER, organization_id: ORG, resource: 'leaves', action: 'view' },
    ])
    old.close()

    const store = openDatabase(name, TIME, ROTATION_LEAVE)
    expect(await store.table('deployments').get(DEPLOYMENT)).toMatchObject({ report_owner_id: null })
    expect(await store.table('report_confirmations').toArray()).toEqual([])
    const confirming = (await store.table('role_permissions').toArray()).filter((row) => (row as { action: string }).action === 'confirm')
    expect(confirming).toEqual([{ role_id: ROLE, organization_id: ORG, resource: 'day_reports', action: 'confirm' }])
    store.close()
  })

  it('puts the top-level units of a version 7 store under one root, and places each soldier in it before their first unit (D-321)', async () => {
    const name = `sagol-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(7).stores(STORES)
    await old.table('organizations').add({ id: ORG, name: 'Battalion', timezone: 'Asia/Jerusalem' })
    await old.table('units').bulkAdd([
      { id: FIRST, organization_id: ORG, parent_id: null, archived_at: null, version: 1 },
      { id: SECOND, organization_id: ORG, parent_id: null, archived_at: null, version: 1 },
    ])
    // 22:30 UTC on 1 January is already 2 January in Jerusalem.
    const created = '2026-01-01T22:30:00.000Z'
    await old.table('soldiers').bulkAdd([
      { id: PLACED, organization_id: ORG, created_at: created, archived_at: null },
      { id: UNPLACED, organization_id: ORG, created_at: created, archived_at: null },
      { id: GONE, organization_id: ORG, created_at: created, archived_at: created },
    ])
    await old.table('unit_memberships').add({
      id: crypto.randomUUID(),
      organization_id: ORG,
      soldier_id: PLACED,
      unit_id: FIRST,
      membership_type: 'primary',
      valid_from: '2026-03-01',
      valid_to: null,
    })
    old.close()

    const store = openDatabase(name, TIME, ROTATION_LEAVE)
    const units = (await store.table('units').toArray()).map((row) => row as { id: string; name?: string; parent_id: string | null })
    const roots = units.filter((unit) => unit.parent_id === null)
    expect(roots).toHaveLength(1)
    const root = roots[0]
    expect(root).toMatchObject({ name: 'Battalion', kind: 'standing', sort_order: 0 })
    expect(units.filter((unit) => unit.parent_id === root?.id).map((unit) => unit.id).sort()).toEqual([FIRST, SECOND])
    const memberships = (await store.table('unit_memberships').toArray()).map(
      (row) => row as { soldier_id: string; unit_id: string; valid_from: string; valid_to: string | null },
    )
    const of = (soldier: string) =>
      memberships
        .filter((row) => row.soldier_id === soldier)
        .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
        .map((row) => [row.unit_id, row.valid_from, row.valid_to])
    expect(of(PLACED)).toEqual([
      [root?.id, '2026-01-02', '2026-02-28'],
      [FIRST, '2026-03-01', null],
    ])
    expect(of(UNPLACED)).toEqual([[root?.id, '2026-01-02', null]])
    expect(of(GONE)).toEqual([])
    store.close()
  })

  it('gives each organization of a version 8 store the built-in leave group and its first type (D-347)', async () => {
    const name = `sagol-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(8).stores(STORES)
    await old.table('organizations').add({ id: ORG, name: 'Battalion', timezone: 'Asia/Jerusalem' })
    await old.table('leave_type_groups').add({ id: CATEGORY, organization_id: ORG, name: 'Home', sort_order: 0 })
    old.close()

    const store = openDatabase(name, TIME, ROTATION_LEAVE)
    const groups = (await store.table('leave_type_groups').toArray()).map((row) => row as { id: string; name: string; is_rotation_leave: boolean })
    expect(groups.find((group) => group.id === CATEGORY)).toMatchObject({ is_rotation_leave: false, sort_order: 1 })
    const builtIn = groups.filter((group) => group.is_rotation_leave)
    expect(builtIn).toHaveLength(1)
    expect(builtIn[0]).toMatchObject({ organization_id: ORG, name: 'Rotation leaves', archived_at: null })
    expect(await store.table('leave_types').toArray()).toEqual([
      expect.objectContaining({
        organization_id: ORG,
        group_id: builtIn[0]?.id,
        name: 'Rotation leave',
        color_key: 'blue',
        availability_effect: 'unavailable',
        requires_reason: false,
        archived_at: null,
      }),
    ])
    store.close()
  })
})
