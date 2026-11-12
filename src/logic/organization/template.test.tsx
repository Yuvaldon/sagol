import type { PermissionCheck, Result } from '@contracts'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { useTemplateOffer } from './template'

describe('useTemplateOffer', () => {
  it('waits for the permission answers before saying there is nothing to offer (D-297)', () => {
    const ports = fakePorts({
      session: { can: () => new Promise<Result<readonly boolean[]>>(() => undefined) },
    })
    const { result } = renderHook(() => useTemplateOffer(), { wrapper: wrapperOf(ports) })
    expect(result.current.status).toBe('loading')
  })

  it('offers nothing to who may not set the unit up', async () => {
    const ports = fakePorts({
      session: {
        can: (checks: readonly PermissionCheck[]) => Promise.resolve({ ok: true, value: checks.map(() => false) }),
      },
    })
    const { result } = renderHook(() => useTemplateOffer(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'ready', value: null })
    })
  })
})
