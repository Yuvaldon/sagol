import type { AppError, Result } from '@contracts'
import { dictionary as he } from '@i18n'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ArchivedSection } from './ArchivedSection'

// The archived section restores through the command it is given and says why a restore was refused (D-371).
// Test rows only.

interface Row {
  readonly id: string
  readonly archived_at: string | null
  readonly name: string
}

const ROW: Row = { id: 'row-1', archived_at: '2026-01-01T00:00:00Z', name: 'row one' }

async function renderIn(content: ReactNode) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div data-testid="screen">{content}</div> })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  render(<RouterProvider router={router as never} />)
  await screen.findByTestId('screen')
}

async function restoreWith(result: Result<unknown>) {
  const run = vi.fn((_row: Row) => Promise.resolve(result))
  await renderIn(<ArchivedSection rows={[ROW]} nameOf={(row) => row.name} restore={{ run, isPending: false }} />)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(he.archived.section) }))
  fireEvent.click(await screen.findByRole('button', { name: he.common.restore }))
  const dialog = await screen.findByRole('dialog', { name: he.archived.restoreTitle })
  expect(dialog.textContent).toContain(ROW.name)
  const confirm = screen.getAllByRole('button', { name: he.common.restore }).find((button) => dialog.contains(button))
  await act(async () => {
    confirm?.click()
    await Promise.resolve()
  })
  return run
}

const refused = (code: 'reference_archived' | 'already_exists' | 'required', path: string): Result<unknown> => {
  const error: AppError = { code: 'validation_failed', issues: [{ path: [path], code }] }
  return { ok: false, error }
}

describe('ArchivedSection', () => {
  it('shows nothing without rows the actor may restore', async () => {
    await renderIn(<ArchivedSection rows={[]} nameOf={(row: Row) => row.name} restore={{ run: vi.fn(), isPending: false }} />)
    expect(screen.queryByRole('button', { name: new RegExp(he.archived.section) })).toBeNull()
  })

  it('restores the confirmed row', async () => {
    const run = await restoreWith({ ok: true, value: ROW })
    expect(run).toHaveBeenCalledWith(ROW)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('dialog', { name: he.archived.restoreTitle })).toBeNull()
  })

  it.each([
    ['reference_archived', 'parent_id', he.archived.blockedArchived],
    ['already_exists', 'personal_id', he.archived.blockedTaken],
    ['required', 'parent_id', he.archived.blockedRoot],
  ] as const)('says why a %s refusal kept the row archived, inside the dialog it leaves open', async (code, path, text) => {
    await restoreWith(refused(code, path))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(text)
    expect(screen.getByRole('dialog', { name: he.archived.restoreTitle }).contains(alert)).toBe(true)
  })
})
