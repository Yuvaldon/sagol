import { describe, expect, it } from 'vitest'
import { DEVICE_KEYS } from '@config'
import { deviceStoreOver } from './index'

// Test data only (iron rule 4).

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => {
      values.clear()
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('the device store (D-197)', () => {
  const key = DEVICE_KEYS.dayReportReasons

  it('keeps a value per soldier, and forgets it on null', () => {
    const storage = memoryStorage()
    const shared = deviceStoreOver(() => storage)
    expect(shared.read(key, 'a')).toBeNull()
    shared.write(key, 'a', 'true')
    expect(shared.read(key, 'a')).toBe('true')
    expect(shared.read(key, 'b')).toBeNull()
    expect(storage.getItem(`${key}.a`)).toBe('true')
    shared.write(key, 'a', null)
    expect(shared.read(key, 'a')).toBeNull()
  })

  it('loses only the convenience when the storage refuses', () => {
    const refusing = deviceStoreOver(() => {
      throw new Error('blocked')
    })
    expect(refusing.read(key, 'a')).toBeNull()
    expect(() => {
      refusing.write(key, 'a', 'true')
    }).not.toThrow()
  })
})
