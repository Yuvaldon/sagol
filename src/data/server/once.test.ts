import { describe, expect, it } from 'vitest'
import { onceRetrying } from './once'

describe('onceRetrying (OI-352)', () => {
  it('loads once and shares the value', async () => {
    let loads = 0
    const get = onceRetrying(() => Promise.resolve((loads += 1)))
    expect(await Promise.all([get(), get()])).toEqual([1, 1])
    expect(await get()).toBe(1)
    expect(loads).toBe(1)
  })

  it('loads again after a failed load', async () => {
    let loads = 0
    const get = onceRetrying(() => {
      loads += 1
      return loads === 1 ? Promise.reject(new Error('lost')) : Promise.resolve(loads)
    })
    await expect(get()).rejects.toThrow('lost')
    expect(await get()).toBe(2)
    expect(await get()).toBe(2)
    expect(loads).toBe(2)
  })
})
