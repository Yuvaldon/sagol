import { DEVICE_KEYS } from '@config'
import { OrganizationId, SoldierId } from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { allowEverything, fakePorts, memoryDeviceStore, wrapperOf } from '../testing/ports'
import { useDeviceFlag } from './hooks'

// Sample ids, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))

function portsWith(local = memoryDeviceStore()) {
  return fakePorts({
    session: {
      current: () => Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION } }),
      can: allowEverything,
    },
    device: { local },
  })
}

describe('a choice kept on the device (D-197)', () => {
  it('is off by default, follows a change at once, and keeps it for the signed-in soldier', async () => {
    const local = memoryDeviceStore()
    const { result } = renderHook(() => useDeviceFlag(DEVICE_KEYS.dayReportReasons), { wrapper: wrapperOf(portsWith(local)) })
    expect(result.current.value).toBe(false)
    // A change before the session answers is held in memory only, so retry until it lands under the soldier.
    await waitFor(() => {
      act(() => result.current.set(true))
      expect(local.read(DEVICE_KEYS.dayReportReasons, ACTOR)).toBe('true')
    })
    expect(result.current.value).toBe(true)
    act(() => result.current.set(false))
    expect(result.current.value).toBe(false)
    expect(local.read(DEVICE_KEYS.dayReportReasons, ACTOR)).toBeNull()
  })

  it('reads back what was kept, and anything else as off', async () => {
    const local = memoryDeviceStore()
    local.write(DEVICE_KEYS.dayReportReasons, ACTOR, 'true')
    const kept = renderHook(() => useDeviceFlag(DEVICE_KEYS.dayReportReasons), { wrapper: wrapperOf(portsWith(local)) })
    await waitFor(() => expect(kept.result.current.value).toBe(true))
    local.write(DEVICE_KEYS.dayReportReasons, ACTOR, 'yes')
    const other = renderHook(() => useDeviceFlag(DEVICE_KEYS.dayReportReasons), { wrapper: wrapperOf(portsWith(local)) })
    await waitFor(() => expect(other.result.current.value).toBe(false))
  })
})
