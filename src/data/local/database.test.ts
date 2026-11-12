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

describe('local database versions', () => {
  it('moves a version 2 store to format 3, keeping every soldier tag', async () => {
    const name = `sagol-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(2).stores({ ...STORES, soldier_tags: '[soldier_id+tag_id], organization_id, tag_id' })
    await old.table('soldier_tags').add({ soldier_id: SOLDIER, tag_id: TAG, organization_id: ORG, created_at: 'x', created_by: null })
    await old.table('tag_categories').add({ id: CATEGORY, organization_id: ORG, selection_mode: 'single' })
    await old.table('deployments').add({ id: DEPLOYMENT, organization_id: ORG, end_date: null })
    old.close()

    const store = openDatabase(name)
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

    const store = openDatabase(name)
    expect(await store.table('deployments').get(DEPLOYMENT)).toMatchObject({ report_owner_id: null })
    expect(await store.table('report_confirmations').toArray()).toEqual([])
    const confirming = (await store.table('role_permissions').toArray()).filter((row) => (row as { action: string }).action === 'confirm')
    expect(confirming).toEqual([{ role_id: ROLE, organization_id: ORG, resource: 'day_reports', action: 'confirm' }])
    store.close()
  })
})
