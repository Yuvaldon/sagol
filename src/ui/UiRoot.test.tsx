import { dictionary as he } from '@i18n'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UiRoot } from './UiRoot'

// Staging is marked on every screen, and production carries no mark (D-300).

describe('UiRoot', () => {
  it('shows the staging band, the staging title and the stage on the root element', () => {
    const { unmount } = render(<UiRoot staging>{he.app.name}</UiRoot>)
    expect(screen.getByRole('complementary', { name: he.app.staging })).toBeTruthy()
    expect(document.title).toBe(he.app.stagingName)
    expect(document.documentElement.dataset.stage).toBe('staging')
    unmount()
    expect(document.documentElement.dataset.stage).toBeUndefined()
  })

  it('shows no band and the plain title in production', () => {
    render(<UiRoot staging={false}>{he.app.name}</UiRoot>)
    expect(screen.queryByRole('complementary', { name: he.app.staging })).toBeNull()
    expect(document.title).toBe(he.app.name)
    expect(document.documentElement.dataset.stage).toBeUndefined()
  })
})
