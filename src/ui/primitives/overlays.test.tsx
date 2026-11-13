import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, type RouterHistory } from '@tanstack/react-router'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Button, Dialog, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Modal, Select, SelectValue } from 'react-aria-components'
import { describe, expect, it } from 'vitest'
import { ModalOverlay, Popover } from './overlays'

// The overlays hold one history entry while open, so the back button closes them (D-335). Test markup only.

async function renderWith(content: () => ReactNode) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <div data-testid="screen">{content()}</div> })
  const history = createMemoryHistory({ initialEntries: ['/'] })
  const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })
  render(<RouterProvider router={router as never} />)
  await screen.findByTestId('screen')
  return history
}

const ACTIONS = 'actions'
const ITEM = 'one'

const position = (history: RouterHistory) => history.location.state.__TSR_index ?? 0

async function settle(run: () => void) {
  await act(async () => {
    run()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function ActionsMenu() {
  return (
    <MenuTrigger>
      <Button>{ACTIONS}</Button>
      <Popover>
        <Menu aria-label={ACTIONS}>
          <MenuItem id="one">{ITEM}</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

describe('overlays (D-335)', () => {
  it('a menu holds an entry the back button consumes by closing it', async () => {
    const history = await renderWith(() => <ActionsMenu />)
    const start = position(history)
    await settle(() => {
      fireEvent.click(screen.getByRole('button', { name: 'actions' }))
    })
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(position(history)).toBe(start + 1)
    await settle(() => {
      history.back()
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(position(history)).toBe(start)
  })

  it('a menu closed by its item takes its entry back', async () => {
    const history = await renderWith(() => <ActionsMenu />)
    const start = position(history)
    await settle(() => {
      fireEvent.click(screen.getByRole('button', { name: 'actions' }))
    })
    await settle(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'one' }))
    })
    expect(position(history)).toBe(start)
  })

  it('a closed select adds no entry', async () => {
    const history = await renderWith(() => (
      <Select aria-label={ITEM}>
        <Button>
          <SelectValue />
        </Button>
        <Popover>
          <ListBox>
            <ListBoxItem id="a">{ITEM}</ListBoxItem>
          </ListBox>
        </Popover>
      </Select>
    ))
    expect(position(history)).toBe(0)
  })

  it('an open dialog adds an entry', async () => {
    const history = await renderWith(() => (
      <ModalOverlay isOpen>
        <Modal>
          <Dialog aria-label={ITEM}>{ITEM}</Dialog>
        </Modal>
      </ModalOverlay>
    ))
    expect(position(history)).toBe(1)
  })

  it('a drawer whose state is in the URL adds no entry', async () => {
    const history = await renderWith(() => (
      <ModalOverlay inUrl isOpen>
        <Modal>
          <Dialog aria-label={ITEM}>{ITEM}</Dialog>
        </Modal>
      </ModalOverlay>
    ))
    expect(position(history)).toBe(0)
  })
})
