import { describe, expect, it } from 'vitest'
import {
  LeaveCommentId,
  LeaveEventId,
  LeaveId,
  OrganizationId,
  PushPayload,
  type LeaveComment,
  type LeaveEvent,
  type LeaveEventType,
  type LeaveStatus,
  type NotificationKind,
  type SoldierId,
} from '@contracts'
import { createPolicyContext, holdersOf, soldierTarget } from '../policy'
import { CLOCK, S, uuid, world } from '../testing'
import { isUnread, pushPayloadOf, pushRecipients, unreadCount, updatesFor, type PushAudience } from '.'

const ORG_ID = OrganizationId.parse(uuid(900))
const L1 = LeaveId.parse(uuid(901))
const L2 = LeaveId.parse(uuid(902))
const L3 = LeaveId.parse(uuid(903))
const LEAVES = new Map([
  [L1, { id: L1, soldier_id: S.f11, start_date: '2026-11-08', end_date: '2026-11-10' }],
  [L2, { id: L2, soldier_id: S.f11, start_date: '2026-11-15', end_date: '2026-11-16' }],
  [L3, { id: L3, soldier_id: S.f21, start_date: '2026-11-20', end_date: '2026-11-21' }],
])

let sequence = 0
function event(
  leaveId: LeaveId,
  actorId: SoldierId,
  type: LeaveEventType,
  createdAt = '2026-11-04T07:00:00Z',
  to: LeaveStatus | null = null,
): LeaveEvent {
  sequence += 1
  return {
    id: LeaveEventId.parse(uuid(1000 + sequence)),
    organization_id: ORG_ID,
    leave_id: leaveId,
    actor_id: actorId,
    event_type: type,
    from_status: null,
    to_status: to,
    changes: {},
    acknowledged_rule_ids: [],
    change_seq: sequence,
    created_at: createdAt,
  }
}
function comment(leaveId: LeaveId, authorId: SoldierId, overrides: Partial<LeaveComment> = {}): LeaveComment {
  sequence += 1
  return {
    id: LeaveCommentId.parse(uuid(2000 + sequence)),
    organization_id: ORG_ID,
    leave_id: leaveId,
    author_id: authorId,
    body: 'x',
    visibility: 'shared',
    created_at: '2026-11-04T07:30:00Z',
    edited_at: null,
    archived_at: null,
    ...overrides,
  }
}

const policy = createPolicyContext(world(), CLOCK)
const APPROVE = { resource: 'leaves', action: 'approve' } as const

function audience(overrides: Partial<PushAudience> = {}): PushAudience {
  return { policy, wants: () => true, subscribed: new Set(policy.soldierIds), ...overrides }
}

describe('holdersOf', () => {
  it('answers who passes can() on the target, by unit scope and organization scope', () => {
    const approvers = holdersOf(policy, APPROVE, soldierTarget(S.f11))
    expect(approvers).toEqual(expect.arrayContaining([S.sc11, S.pc1, S.cc]))
    expect(approvers).not.toContain(S.pc2)
    expect(approvers).not.toContain(S.f11)
    expect(approvers).not.toContain(S.f12)
  })

  it('reaches a soldier-scope holder only for their own target', () => {
    expect(holdersOf(policy, APPROVE, soldierTarget(S.f21))).toContain(S.f21)
    expect(holdersOf(policy, APPROVE, soldierTarget(S.f11))).not.toContain(S.f21)
  })
})

describe('updatesFor', () => {
  const since = '2026-10-05T08:00:00Z'
  const sources = (events: LeaveEvent[], comments: LeaveComment[] = []) => ({ leaves: LEAVES.values(), events, comments })

  it('keeps what others did on the soldier own leaves, every event type, newest first', () => {
    const types: LeaveEventType[] = ['created', 'updated', 'rescheduled', 'approved', 'rejected', 'cancelled', 'reopened']
    const events = types.map((type, index) => event(L1, S.sc11, type, `2026-11-0${index + 1}T08:00:00Z`))
    const updates = updatesFor(S.f11, sources(events), since)
    expect(updates.map((update) => update.kind)).toEqual([...types].reverse())
    expect(updates[0]).toMatchObject({ leave_id: L1, actor_id: S.sc11, created_at: '2026-11-07T08:00:00Z' })
  })

  it('leaves out the soldier own actions and other soldiers leaves', () => {
    const updates = updatesFor(S.f11, sources([event(L1, S.f11, 'created'), event(L3, S.pc2, 'approved')]), since)
    expect(updates).toEqual([])
  })

  it('keeps shared comments of others only: not internal, not archived, not own', () => {
    const comments = [
      comment(L1, S.sc11),
      comment(L1, S.sc11, { visibility: 'internal' }),
      comment(L1, S.sc11, { archived_at: '2026-11-04T07:40:00Z' }),
      comment(L1, S.f11),
      comment(L3, S.pc2),
    ]
    const updates = updatesFor(S.f11, sources([], comments), since)
    expect(updates).toEqual([expect.objectContaining({ kind: 'comment', id: comments[0]?.id, actor_id: S.sc11 })])
  })

  it('bounds the list by the window', () => {
    const events = [event(L1, S.sc11, 'approved', '2026-10-05T07:59:59Z'), event(L1, S.sc11, 'cancelled', since)]
    expect(updatesFor(S.f11, sources(events), since).map((update) => update.kind)).toEqual(['cancelled'])
  })

  it('counts unread by the seen time; NULL reads everything as unread', () => {
    const events = [event(L1, S.sc11, 'approved', '2026-11-01T08:00:00Z'), event(L1, S.sc11, 'cancelled', '2026-11-02T08:00:00Z')]
    const updates = updatesFor(S.f11, sources(events), since)
    expect(unreadCount(updates, null)).toBe(2)
    expect(unreadCount(updates, '2026-11-01T08:00:00Z')).toBe(1)
    expect(unreadCount(updates, '2026-11-02T08:00:00Z')).toBe(0)
    expect(isUnread({ created_at: '2026-11-02T08:00:00.001Z' }, '2026-11-02T10:00:00+02:00')).toBe(true)
  })
})

describe('pushRecipients', () => {
  const effect = (actorId: SoldierId, events: LeaveEvent[], comments: LeaveComment[] = []) => ({
    actorId,
    leaves: LEAVES,
    events,
    comments,
  })
  const approversOfF11 = holdersOf(policy, APPROVE, soldierTarget(S.f11)).filter((id) => id !== S.f11)

  it('a pending leave goes to every approver of its soldier, never the actor', () => {
    const recipients = pushRecipients(effect(S.sc11, [event(L1, S.sc11, 'created', undefined, 'pending')]), audience())
    expect(recipients.every((recipient) => recipient.kind === 'awaiting_me')).toBe(true)
    expect(recipients.map((recipient) => recipient.soldier_id).sort()).toEqual(
      approversOfF11.filter((id) => id !== S.sc11).sort(),
    )
    expect(recipients.map((recipient) => recipient.soldier_id)).toContain(S.pc1)
  })

  it('a pending leave never goes to its own soldier, even one who approves themselves', () => {
    const recipients = pushRecipients(effect(S.pc2, [event(L3, S.pc2, 'created', undefined, 'pending')]), audience())
    expect(recipients.map((recipient) => recipient.soldier_id)).not.toContain(S.f21)
  })

  it('a leave created approved for someone else goes to its soldier', () => {
    const recipients = pushRecipients(effect(S.pc1, [event(L1, S.pc1, 'created', undefined, 'approved')]), audience())
    expect(recipients).toEqual([{ soldier_id: S.f11, kind: 'my_request', outcome: 'created', leave_ids: [L1] }])
  })

  it.each([
    ['approved', 'approved'],
    ['rejected', 'rejected'],
    ['cancelled', 'cancelled'],
    ['reopened', 'reopened'],
    ['rescheduled', 'rescheduled'],
  ] as const)('a %s event goes to the leave soldier', (type, outcome) => {
    const recipients = pushRecipients(effect(S.pc1, [event(L1, S.pc1, type)]), audience())
    expect(recipients).toEqual([{ soldier_id: S.f11, kind: 'my_request', outcome, leave_ids: [L1] }])
  })

  it('a details-only update sends nothing', () => {
    expect(pushRecipients(effect(S.pc1, [event(L1, S.pc1, 'updated')]), audience())).toEqual([])
  })

  it('self-actions never notify', () => {
    expect(pushRecipients(effect(S.f11, [event(L1, S.f11, 'cancelled')]), audience())).toEqual([])
    expect(pushRecipients(effect(S.f11, [event(L1, S.f11, 'created', undefined, 'approved')]), audience())).toEqual([])
  })

  it('a new shared comment goes to the leave soldier; internal, edited or own comments do not', () => {
    const shared = comment(L1, S.pc1)
    expect(pushRecipients(effect(S.pc1, [], [shared]), audience())).toEqual([
      { soldier_id: S.f11, kind: 'my_request', outcome: 'comment', leave_ids: [L1] },
    ])
    const quiet = [
      comment(L1, S.pc1, { visibility: 'internal' }),
      comment(L1, S.pc1, { edited_at: '2026-11-04T07:45:00Z' }),
    ]
    expect(pushRecipients(effect(S.pc1, [], quiet), audience())).toEqual([])
    expect(pushRecipients(effect(S.f11, [], [comment(L1, S.f11)]), audience())).toEqual([])
  })

  it('leaves out a kind the recipient turned off, and a recipient without a subscription', () => {
    const created = [event(L1, S.sc11, 'created', undefined, 'pending')]
    const off = (soldierId: SoldierId, kind: NotificationKind) => !(soldierId === S.pc1 && kind === 'awaiting_me')
    expect(pushRecipients(effect(S.sc11, created), audience({ wants: off })).map((r) => r.soldier_id)).not.toContain(S.pc1)
    const onlyCc = audience({ subscribed: new Set([S.cc]) })
    expect(pushRecipients(effect(S.sc11, created), onlyCc).map((r) => r.soldier_id)).toEqual([S.cc])
    expect(pushRecipients(effect(S.pc1, [event(L1, S.pc1, 'approved')]), audience({ subscribed: new Set() }))).toEqual([])
  })

  it('collapses a batch into one push per recipient, describing the first leave', () => {
    const events = [event(L1, S.sc11, 'created', undefined, 'pending'), event(L2, S.sc11, 'created', undefined, 'pending')]
    const recipients = pushRecipients(effect(S.sc11, events), audience())
    const cc = recipients.filter((recipient) => recipient.soldier_id === S.cc)
    expect(cc).toEqual([{ soldier_id: S.cc, kind: 'awaiting_me', leave_ids: [L1, L2] }])
  })

  it('ignores events of other actors and leaves the command did not touch', () => {
    const stray = { ...event(L1, S.cc, 'approved') }
    const unknown = event(LeaveId.parse(uuid(999)), S.pc1, 'approved')
    expect(pushRecipients(effect(S.pc1, [stray, unknown]), audience())).toEqual([])
  })
})

describe('pushPayloadOf', () => {
  const leave = LEAVES.get(L1)
  if (leave === undefined) throw new Error('fixture')

  it('carries the outcome for one own request and parses', () => {
    const payload = pushPayloadOf({ soldier_id: S.f11, kind: 'my_request', outcome: 'approved', leave_ids: [L1] }, leave, 'f11')
    expect(PushPayload.parse(payload)).toEqual({
      kind: 'my_request',
      outcome: 'approved',
      leave_id: L1,
      count: 1,
      start_date: '2026-11-08',
      end_date: '2026-11-10',
    })
  })

  it('carries the name and the count for an approver, nothing else', () => {
    const payload = pushPayloadOf({ soldier_id: S.cc, kind: 'awaiting_me', leave_ids: [L1, L2] }, leave, 'דנה כהן')
    expect(PushPayload.parse(payload)).toEqual({ ...payload })
    expect(Object.keys(payload).sort()).toEqual(['count', 'end_date', 'kind', 'leave_id', 'soldier_name', 'start_date'])
    expect(payload).toMatchObject({ count: 2, soldier_name: 'דנה כהן' })
    expect(PushPayload.safeParse({ ...payload, reason: 'x' }).success).toBe(false)
  })
})
