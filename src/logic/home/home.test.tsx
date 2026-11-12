import { DEVICE_KEYS } from '@config'
import { OrganizationId, SoldierId, type PermissionCheck, type Result, type Soldier } from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakePorts, memoryDeviceStore, wrapperOf } from '../testing/ports'
import { useHome } from './hooks'

// Sample ids, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const AT = '2026-11-08T10:00:00.000Z'

const ME: Soldier = {
  id: ACTOR,
  organization_id: ORGANIZATION,
  first_name: 'A',
  last_name: 'B',
  nickname: null,
  command_rank_id: null,
  status: 'active',
  properties: {},
  created_at: AT,
  created_by: null,
  updated_at: AT,
  updated_by: null,
  version: 1,
  archived_at: null,
}

const OTHER: Soldier = { ...ME, id: SoldierId.parse(uuid(902)), first_name: 'C' }

type Allows = (check: PermissionCheck) => boolean

const own = (check: PermissionCheck) => check.target.kind === 'soldier' && check.target.soldier_id === ACTOR
/** A fighter reads their own leaves, and views modules through their own record. */
const FIGHTER: Allows = (check) =>
  check.permission.action === 'view' && (check.permission.resource !== 'leaves' || own(check))
/** A manager approves the leaves of whoever they see. */
const MANAGER: Allows = (check) => FIGHTER(check) || (check.permission.resource === 'leaves' && check.permission.action === 'approve')
/** An owner creates across the organization. */
const OWNER: Allows = (check) => FIGHTER(check) || check.permission.action === 'create'

function render(allows: Allows, local = memoryDeviceStore(), roster: readonly Soldier[] = [ME, OTHER]) {
  const ports = fakePorts({
    session: {
      current: () => Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION } }),
      can: (checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(allows) }),
    },
    repositories: { soldiers: { list: () => Promise.resolve<Result<Soldier[]>>({ ok: true, value: [...roster] }) } },
    device: { local },
  })
  return renderHook(() => useHome(), { wrapper: wrapperOf(ports) })
}

describe('home follows the permissions, then the last choice (D-265)', () => {
  it('opens a manager on the board and a fighter on "mine"', async () => {
    const manager = render(MANAGER)
    await waitFor(() => expect(manager.result.current.ready).toBe(true))
    expect(manager.result.current).toMatchObject({ offersMine: true, mine: false })
    const fighter = render(FIGHTER)
    await waitFor(() => expect(fighter.result.current.ready).toBe(true))
    expect(fighter.result.current).toMatchObject({ offersMine: true, mine: true })
  })

  it('opens an owner on the board before anyone else is listed', async () => {
    const { result } = render(OWNER, memoryDeviceStore(), [ME])
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current).toMatchObject({ offersMine: true, mine: false })
  })

  it('opens on "mine" whoever approves only their own leaves', async () => {
    const { result } = render(MANAGER, memoryDeviceStore(), [ME])
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current).toMatchObject({ offersMine: true, mine: true })
  })

  it('keeps the home last chosen, and forgets it once it is the derived one again', async () => {
    const local = memoryDeviceStore()
    const { result } = render(FIGHTER, local)
    await waitFor(() => expect(result.current.ready).toBe(true))
    act(() => result.current.choose(false))
    expect(result.current.mine).toBe(false)
    expect(local.read(DEVICE_KEYS.homeAway, ACTOR)).toBe('true')
    act(() => result.current.choose(true))
    expect(result.current.mine).toBe(true)
    expect(local.read(DEVICE_KEYS.homeAway, ACTOR)).toBeNull()
  })

  it('keeps no choice made before the answers arrive', async () => {
    const local = memoryDeviceStore()
    const { result } = render(MANAGER, local)
    expect(result.current.ready).toBe(false)
    act(() => result.current.choose(true))
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(local.read(DEVICE_KEYS.homeAway, ACTOR)).toBeNull()
    expect(result.current.mine).toBe(false)
  })

  it('never offers "mine" to whoever may not read their own leaves', async () => {
    const { result } = render(() => false)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current).toMatchObject({ offersMine: false, mine: false })
  })
})
