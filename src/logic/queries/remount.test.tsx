import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from './client'

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
})
