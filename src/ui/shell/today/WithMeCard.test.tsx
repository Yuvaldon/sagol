import type { PermissionCheck, Result } from '@contracts'
import { dictionary as he } from '@i18n'
import { LogicProvider, type LogicPorts } from '@logic'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WithMeCard } from './cards'

// "איתך היום" (D-478, D-479): the count and the names, and nothing when the actor has a board, nobody else is on
// base, or the read failed. Test data only.

const NO_STORE = { read: () => null, write: () => undefined }
const ACTOR = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-11-08T10:00:00.000Z'
const TODAY = '2026-11-08'
const ROWS = [
  { id: '00000000-0000-4000-8000-000000000002', first_name: 'נועה', last_name: 'לוי' },
  { id: '00000000-0000-4000-8000-000000000003', first_name: 'תמר', last_name: 'כהן' },
]

function portsWith(answer: Result<unknown>) {
  const quiet = { subscribe: () => () => undefined }
  const presentWithMe = vi.fn(() => Promise.resolve(answer))
  const ports = {
    data: {
      session: {
        ...quiet,
        current: () =>
          Promise.resolve({ ok: true, value: { status: 'linked', identity: {}, soldier_id: ACTOR, organization_id: ACTOR } }),
        can: (checks: readonly PermissionCheck[]) => Promise.resolve<Result<boolean[]>>({ ok: true, value: checks.map(() => true) }),
      },
      repositories: {
        organizations: { current: () => Promise.resolve({ ok: true, value: { timezone: 'Asia/Jerusalem' } }) },
        soldiers: { presentWithMe },
      },
      commands: {},
      changes: quiet,
    },
    auth: {},
    time: { now: () => NOW },
    device: { local: NO_STORE, session: NO_STORE },
    push: { ...quiet, current: () => 'unsupported' },
  } as unknown as LogicPorts
  return { ports, presentWithMe }
}

function renderCard(answer: Result<unknown>, board = false) {
  const { ports, presentWithMe } = portsWith(answer)
  render(
    <LogicProvider ports={ports}>
      <WithMeCard board={board} />
    </LogicProvider>,
  )
  return presentWithMe
}

describe('the card "איתך היום" (D-478, D-479)', () => {
  it('shows the count and the names, in name order, and opens nothing', async () => {
    renderCard({ ok: true, value: { date: TODAY, soldiers: ROWS } })
    const card = await screen.findByRole('region', { name: he.today.withMe })
    expect(card.textContent).toContain(`2 ${he.today.withMeCount}`)
    expect([...card.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['תמר כהן', 'נועה לוי'])
    expect(card.querySelector('button')).toBeNull()
  })

  it('is absent for who has a board, who sees the unit block instead', async () => {
    const presentWithMe = renderCard({ ok: true, value: { date: TODAY, soldiers: ROWS } }, true)
    await waitFor(() => {
      expect(presentWithMe).toHaveBeenCalled()
    })
    expect(screen.queryByRole('region', { name: he.today.withMe })).toBeNull()
  })

  it('is absent when nobody else is on base, or the actor has no unit', async () => {
    const empty = renderCard({ ok: true, value: { date: TODAY, soldiers: [] } })
    const none = renderCard({ ok: true, value: null })
    await waitFor(() => {
      expect(empty).toHaveBeenCalled()
      expect(none).toHaveBeenCalled()
    })
    expect(screen.queryByRole('region', { name: he.today.withMe })).toBeNull()
  })

  it('is absent when the read fails', async () => {
    const failed = renderCard({ ok: false, error: { code: 'unavailable' } })
    await waitFor(() => {
      expect(failed).toHaveBeenCalled()
    })
    expect(screen.queryByRole('region', { name: he.today.withMe })).toBeNull()
  })
})
