import { LeaveId, type PushPayload } from '@contracts'
import { dictionary as he } from '@i18n'
import { describe, expect, it, vi } from 'vitest'
import { asksForWaitingVersion, onNotificationClick, onPush, type NotificationShown, type WorkerWindow } from './handlers'
import { daysText } from './pushText'

// Sample payloads, test files only.
const LEAVE = LeaveId.parse('00000000-0000-4000-8000-000000000010')
const ORIGIN = 'https://app.example.test'
const approved: PushPayload = { kind: 'my_request', outcome: 'approved', leave_id: LEAVE, count: 1, start_date: '2026-11-09', end_date: '2026-11-10' }

function registration() {
  const shown: { title: string; options: NotificationShown }[] = []
  return {
    shown,
    showNotification: vi.fn((title: string, options: NotificationShown) => {
      shown.push({ title, options })
      return Promise.resolve()
    }),
  }
}

describe('a push (D-355)', () => {
  it('tells the soldier what happened to the request, with its days, and opens the leave', async () => {
    const worker = registration()
    await onPush(approved, worker, false)
    expect(worker.shown).toEqual([
      {
        title: he.app.name,
        options: expect.objectContaining({
          body: `${he.notifications.push.approved} · ${daysText('2026-11-09', '2026-11-10')}`,
          tag: LEAVE,
          dir: 'rtl',
          data: { url: `/?panel=leaves&entity=${LEAVE}` },
        }) as NotificationShown,
      },
    ])
  })

  it('counts the requests of one command, and names the staging build', async () => {
    const worker = registration()
    await onPush({ ...approved, count: 3 }, worker, true)
    expect(worker.shown[0]?.title).toBe(he.app.stagingName)
    expect(worker.shown[0]?.options.body).toBe(`3 ${he.notifications.push.approvedMany}`)
  })

  it('names the soldier to who approves, and sends many to the inbox under one tag', async () => {
    const awaiting: PushPayload = { kind: 'awaiting_me', soldier_name: 'דן כהן', leave_id: LEAVE, count: 1, start_date: '2026-11-09', end_date: '2026-11-09' }
    const worker = registration()
    await onPush(awaiting, worker, false)
    await onPush({ ...awaiting, count: 2 }, worker, false)
    expect(worker.shown[0]?.options.body).toBe(`${he.notifications.push.awaitingOne}דן כהן · ${daysText('2026-11-09', '2026-11-09')}`)
    expect(worker.shown[1]?.options).toMatchObject({ body: `2 ${he.notifications.push.awaitingMany}`, tag: 'awaiting_me', data: { url: '/?panel=leave_inbox' } })
  })

  it('shows nothing for a payload the contract refuses', async () => {
    const worker = registration()
    await onPush({ kind: 'my_request', leave_id: LEAVE }, worker, false)
    await onPush(null, worker, false)
    expect(worker.showNotification).not.toHaveBeenCalled()
  })

  it('writes one day without a range', () => {
    expect(daysText('2026-11-09', '2026-11-09')).not.toMatch(/[–-]/)
    expect(daysText('2026-11-09', '2026-11-12')).toMatch(/9.*12/)
  })
})

describe('a tap on the notification (D-354)', () => {
  const tapped = (url: unknown) => ({ data: { url }, close: vi.fn() })
  const windowAt = (url: string): WorkerWindow => ({ url, focus: vi.fn(() => Promise.resolve()), navigate: vi.fn(() => Promise.resolve()) })

  it('brings the open app forward and opens the leave there', async () => {
    const open = windowAt(`${ORIGIN}/`)
    const openWindow = vi.fn()
    const notification = tapped('/?panel=leaves')
    await onNotificationClick(notification, { matchAll: () => Promise.resolve([windowAt('https://other.example.test/'), open]), openWindow }, ORIGIN)
    expect(notification.close).toHaveBeenCalled()
    expect(open.focus).toHaveBeenCalled()
    expect(open.navigate).toHaveBeenCalledWith(`${ORIGIN}/?panel=leaves`)
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a window when the app is closed', async () => {
    const openWindow = vi.fn(() => Promise.resolve(null))
    await onNotificationClick(tapped('/?panel=leave_inbox'), { matchAll: () => Promise.resolve([]), openWindow }, ORIGIN)
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/?panel=leave_inbox`)
  })

  it('only closes a notification without a place to open', async () => {
    const openWindow = vi.fn()
    await onNotificationClick(tapped(7), { matchAll: () => Promise.resolve([]), openWindow }, ORIGIN)
    expect(openWindow).not.toHaveBeenCalled()
  })
})

describe('the update the open app asks for (D-183)', () => {
  it('takes the waiting version on the message workbox-window sends, and on nothing else', () => {
    expect(asksForWaitingVersion({ type: 'SKIP_WAITING' })).toBe(true)
    for (const other of [null, 'SKIP_WAITING', {}, { type: 'OTHER' }, { kind: 'SKIP_WAITING' }]) expect(asksForWaitingVersion(other)).toBe(false)
  })
})
