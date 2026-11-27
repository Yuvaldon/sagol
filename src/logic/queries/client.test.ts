import { TODAY } from '@config'
import { describe, expect, it, vi } from 'vitest'
import { QUERY_KEYS, createQueryClient, invalidateChanged } from './client'

const stale = (client: ReturnType<typeof createQueryClient>, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false

describe('invalidateChanged', () => {
  it('refreshes every list when a table the policy reads changes', () => {
    const client = createQueryClient()
    client.setQueryData(QUERY_KEYS.leaves, [])
    client.setQueryData(QUERY_KEYS.tags, [])
    invalidateChanged(client, [{ table: 'access_grants', ids: [] }])
    expect(stale(client, QUERY_KEYS.leaves)).toBe(true)
    expect(stale(client, QUERY_KEYS.tags)).toBe(true)
  })

  it('refreshes only the changed table otherwise', () => {
    const client = createQueryClient()
    client.setQueryData(QUERY_KEYS.leaves, [])
    client.setQueryData(QUERY_KEYS.tags, [])
    invalidateChanged(client, [{ table: 'tags', ids: [] }])
    expect(stale(client, QUERY_KEYS.leaves)).toBe(false)
    expect(stale(client, QUERY_KEYS.tags)).toBe(true)
  })

  it('asks again who is on base with the actor once, a while after leaves change (D-478, D-479)', () => {
    vi.useFakeTimers()
    try {
      const client = createQueryClient()
      const key = [...QUERY_KEYS.presentWithMe, '2026-11-10']
      client.setQueryData(key, null)
      invalidateChanged(client, [{ table: 'tags', ids: [] }])
      invalidateChanged(client, [{ table: 'leaves', ids: [] }])
      invalidateChanged(client, [{ table: 'leave_types', ids: [] }])
      expect(stale(client, key)).toBe(false)
      vi.advanceTimersByTime(TODAY.withMeRefreshMs)
      expect(stale(client, key)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
