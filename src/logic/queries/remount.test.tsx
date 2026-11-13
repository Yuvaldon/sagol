import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createQueryClient, invalidateChanged, QUERY_KEYS } from './client'

// OI-290: a view that hides a read's subtree while the read is pending and shows a part that reads it again once it
// failed. Mounting that part must not refetch the refusal, or the two states feed each other at network speed.

const KEY = ['oi-290']
const MOUNTS_TO_SETTLE = 20

describe('a refused read', () => {
  it('is not fetched again because another view of it mounts', async () => {
    const client = createQueryClient()
    let calls = 0
    const read = () => {
      calls += 1
      return Promise.reject(new Error('forbidden'))
    }
    function Again() {
      useQuery({ queryKey: KEY, queryFn: read })
      return null
    }
    function View() {
      const query = useQuery({ queryKey: KEY, queryFn: read })
      return query.isError ? createElement(Again) : null
    }
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
    render(createElement(View), { wrapper })
    await waitFor(() => {
      expect(client.getQueryState(KEY)?.status).toBe('error')
    })
    for (let tick = 0; tick < MOUNTS_TO_SETTLE; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(1)
  })
  it('is read afresh by the next view once a change touches it, though no view showed it then', async () => {
    const client = createQueryClient()
    let calls = 0
    const read = () => {
      calls += 1
      return calls === 1 ? Promise.reject(new Error('forbidden')) : Promise.resolve('read')
    }
    function View() {
      const query = useQuery({ queryKey: QUERY_KEYS.organization, queryFn: read })
      return query.isSuccess ? createElement('output', null, query.data) : null
    }
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
    const first = render(createElement(View), { wrapper })
    await waitFor(() => {
      expect(client.getQueryState(QUERY_KEYS.organization)?.status).toBe('error')
    })
    first.unmount()
    invalidateChanged(client, [{ table: 'organizations', ids: [] }])
    const next = render(createElement(View), { wrapper })
    await waitFor(() => {
      expect(next.container.textContent).toBe('read')
    })
    expect(calls).toBe(2)
  })
})
