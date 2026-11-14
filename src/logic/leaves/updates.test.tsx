import {
  DeploymentId,
  LeaveCommentId,
  LeaveEventId,
  LeaveId,
  LeaveTypeId,
  OrganizationId,
  SoldierId,
  SoldierPreferences,
  type Leave,
  type LeaveComment,
  type LeaveEvent,
  type LeaveFeedQuery,
  type Result,
  type SoldierPreferencesRecord,
  type UpdateMyPreferencesInput,
} from '@contracts'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { allowEverything, fakePorts, organizationIn, wrapperOf } from '../testing/ports'
import { useMarkUpdatesSeen, useMyUpdates } from './updatesHooks'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ORGANIZATION = OrganizationId.parse(uuid(900))
const ACTOR = SoldierId.parse(uuid(901))
const DAN = SoldierId.parse(uuid(2))
const AT = '2026-11-08T10:00:00.000Z'
const LEAVE = LeaveId.parse(uuid(10))

const leave: Leave = {
  id: LEAVE,
  organization_id: ORGANIZATION,
  soldier_id: ACTOR,
  leave_type_id: LeaveTypeId.parse(uuid(30)),
  batch_id: null,
  deployment_id: DeploymentId.parse(uuid(70)),
  start_date: '2026-11-09',
  end_date: '2026-11-10',
  status: 'approved',
  availability_effect_override: null,
  reason: null,
  reviewed_by: DAN,
  reviewed_at: AT,
  properties: {},
  created_at: AT,
  created_by: ACTOR,
  updated_at: AT,
  updated_by: DAN,
  version: 2,
}

function event(n: number, actorId: SoldierId, createdAt: string): LeaveEvent {
  return {
    id: LeaveEventId.parse(uuid(100 + n)),
    organization_id: ORGANIZATION,
    leave_id: LEAVE,
    actor_id: actorId,
    event_type: 'approved',
    from_status: 'pending',
    to_status: 'approved',
    changes: {},
    acknowledged_rule_ids: [],
    change_seq: n,
    created_at: createdAt,
  }
}

const shared: LeaveComment = {
  id: LeaveCommentId.parse(uuid(200)),
  organization_id: ORGANIZATION,
  leave_id: LEAVE,
  author_id: DAN,
  body: 'x',
  visibility: 'shared',
  created_at: '2026-11-08T09:00:00.000Z',
  edited_at: null,
  archived_at: null,
}

interface Fakes {
  readonly events: LeaveEvent[]
  readonly seenAt?: string | null
  /** The stored time when it changes between reads (another device's save). */
  readonly storedSeenAt?: () => string | null
  readonly updateMyPreferences?: (input: UpdateMyPreferencesInput) => Promise<Result<SoldierPreferencesRecord>>
}

function portsWith(fakes: Fakes) {
  const session = { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ORGANIZATION }
  const record = (): SoldierPreferencesRecord => ({
    soldier_id: ACTOR,
    organization_id: ORGANIZATION,
    preferences: SoldierPreferences.parse({ updates_seen_at: fakes.storedSeenAt?.() ?? fakes.seenAt ?? null }),
    updated_at: AT,
    version: 1,
  })
  const feed = vi.fn((query: LeaveFeedQuery) => Promise.resolve({ ok: true, value: fakes.events.filter((row) => row.created_at >= query.since) }))
  const ports = fakePorts({
    session: { current: () => Promise.resolve({ ok: true, value: session }), can: allowEverything },
    repositories: {
      leaves: { list: () => Promise.resolve({ ok: true, value: [leave] }) },
      leave_events: { feed },
      leave_comments: { feed: () => Promise.resolve({ ok: true, value: [shared] }) },
      organizations: organizationIn(),
      soldier_preferences: { mine: () => Promise.resolve({ ok: true, value: record() }) },
    },
    commands: { accounts: { updateMyPreferences: fakes.updateMyPreferences } },
    now: () => AT,
  })
  return { ports, feed }
}

describe('the updates on שלי (D-352)', () => {
  it('lists what others did on my leaves, newest first, with the unread ones counted', async () => {
    const events = [event(1, DAN, '2026-11-07T08:00:00.000Z'), event(2, ACTOR, '2026-11-08T08:00:00.000Z')]
    const { ports, feed } = portsWith({ events, seenAt: '2026-11-07T12:00:00.000Z' })
    const { result } = renderHook(() => useMyUpdates(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current?.status).toBe('ready')
    })
    const value = result.current?.status === 'ready' ? result.current.value : null
    expect(value?.lines.map((line) => [line.update.kind, line.unread])).toEqual([
      ['comment', true],
      ['approved', false],
    ])
    expect(value?.unread).toBe(1)
    expect(value?.newest).toBe(shared.created_at)
    // The window starts at the organization's midnight, `updatesDays` back.
    expect(feed.mock.calls[0]?.[0]).toMatchObject({ soldier_id: ACTOR })
    expect(feed.mock.calls[0]?.[0].since.endsWith('Z')).toBe(true)
  })
})

describe('the newest update is of the lines shown', () => {
  it('ignores an update whose leave has no line', async () => {
    const other = { ...event(3, DAN, '2026-11-08T09:30:00.000Z'), leave_id: LeaveId.parse(uuid(11)) }
    const { ports } = portsWith({ events: [other] })
    const { result } = renderHook(() => useMyUpdates(), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(result.current?.status).toBe('ready')
    })
    const value = result.current?.status === 'ready' ? result.current.value : null
    expect(value?.lines.every((line) => line.leave.id === LEAVE)).toBe(true)
    expect(value?.newest).toBe(shared.created_at)
  })
})

describe('marking the updates seen (D-352)', () => {
  const saved = (input: UpdateMyPreferencesInput): Result<SoldierPreferencesRecord> => ({
    ok: true,
    value: {
      soldier_id: ACTOR,
      organization_id: ORGANIZATION,
      preferences: SoldierPreferences.parse(input.preferences),
      updated_at: AT,
      version: 2,
    },
  })

  async function render(fakes: Fakes) {
    const { ports } = portsWith(fakes)
    const view = renderHook(() => ({ mark: useMarkUpdatesSeen(), updates: useMyUpdates() }), { wrapper: wrapperOf(ports) })
    await waitFor(() => {
      expect(view.result.current.updates?.status).toBe('ready')
    })
    return view
  }

  it('saves the newest time', async () => {
    const updateMyPreferences = vi.fn((input: UpdateMyPreferencesInput) => Promise.resolve(saved(input)))
    const { result } = await render({ events: [], updateMyPreferences })
    await act(async () => {
      await result.current.mark(shared.created_at)
    })
    expect(updateMyPreferences).toHaveBeenCalledTimes(1)
    expect(updateMyPreferences.mock.calls[0]?.[0].preferences.updates_seen_at).toBe(shared.created_at)
  })

  it('saves nothing for a time that is not newer than the stored one', async () => {
    const updateMyPreferences = vi.fn()
    const { result } = await render({ events: [], seenAt: shared.created_at, updateMyPreferences })
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.mark('2026-11-08T07:00:00.000Z')
    })
    expect(outcome).toBeNull()
    expect(updateMyPreferences).not.toHaveBeenCalled()
  })

  it('tries once more after another device saved first', async () => {
    const updateMyPreferences = vi
      .fn<(input: UpdateMyPreferencesInput) => Promise<Result<SoldierPreferencesRecord>>>()
      .mockResolvedValueOnce({ ok: false, error: { code: 'stale_version' } })
      .mockImplementation((input) => Promise.resolve(saved(input)))
    const { result } = await render({ events: [], updateMyPreferences })
    let outcome: Result<SoldierPreferencesRecord> | null = null
    await act(async () => {
      outcome = await result.current.mark(shared.created_at)
    })
    expect(updateMyPreferences).toHaveBeenCalledTimes(2)
    expect(outcome).toMatchObject({ ok: true })
  })

  it('computes the change again at most once, however often another device saves first (D-388)', async () => {
    const updateMyPreferences = vi
      .fn<(input: UpdateMyPreferencesInput) => Promise<Result<SoldierPreferencesRecord>>>()
      .mockResolvedValue({ ok: false, error: { code: 'stale_version' } })
    const { result } = await render({ events: [], updateMyPreferences })
    let outcome: Result<SoldierPreferencesRecord> | null = null
    await act(async () => {
      outcome = await result.current.mark(shared.created_at)
    })
    expect(updateMyPreferences).toHaveBeenCalledTimes(2)
    expect(outcome).toMatchObject({ ok: false, error: { code: 'stale_version' } })
  })

  it('keeps a later time another device saved meanwhile', async () => {
    const later = '2026-11-09T08:00:00.000Z'
    let stored: string | null = null
    const updateMyPreferences = vi
      .fn<(input: UpdateMyPreferencesInput) => Promise<Result<SoldierPreferencesRecord>>>()
      .mockImplementationOnce(() => {
        stored = later
        return Promise.resolve({ ok: false, error: { code: 'stale_version' } })
      })
      .mockImplementation((input) => Promise.resolve(saved(input)))
    const { result } = await render({ events: [], storedSeenAt: () => stored, updateMyPreferences })
    await act(async () => {
      await result.current.mark(shared.created_at)
    })
    expect(updateMyPreferences).toHaveBeenCalledTimes(2)
    expect(updateMyPreferences.mock.calls[1]?.[0].preferences.updates_seen_at).toBe(later)
  })
})
