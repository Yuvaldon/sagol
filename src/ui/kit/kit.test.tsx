import { SHELL } from '@config'
import { dictionary as he } from '@i18n'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { Card, CardDoor } from './Card'
import { DayStrip } from './DayStrip'
import { Fraction } from './Fraction'
import { GlassCircle } from './Glass'
import { Month } from './Month'
import { PersonRow } from './PersonRow'
import { StopDrawer } from './StopDrawer'
import { Toast, ToastRegion } from './Toast'
import { Tray } from './Tray'

// The shared components of the new interface (D-454): what each says to a reader, and what a press does. Sample
// data, tests only.

const WAITING = '3'
const BODY = 'body'
const TITLE = 'T'
const DETAIL = 'd'

afterEach(() => {
  vi.useRealTimers()
})

describe('the fraction', () => {
  it('reads as "of", and says when it is below the threshold', () => {
    const { rerender } = render(<Fraction value={12} of={16} low={false} />)
    expect(screen.getByText(`12 ${he.kit.fractionOf} 16`)).toBeTruthy()
    rerender(<Fraction value={9} of={16} low />)
    expect(screen.getByText(`9 ${he.kit.fractionOf} 16 ${he.kit.fractionLow}`)).toBeTruthy()
  })
})

describe('the glass circle', () => {
  it('is named, and reads what waits behind it only while something does', () => {
    const onPress = vi.fn()
    const { rerender } = render(
      <GlassCircle labelKey="myLeaves.updatesTitle" countKey="myLeaves.updatesUnread" count={0} onPress={onPress}>
        <span aria-hidden />
      </GlassCircle>,
    )
    const button = screen.getByRole('button', { name: he.myLeaves.updatesTitle })
    fireEvent.click(button)
    expect(onPress).toHaveBeenCalledOnce()
    rerender(
      <GlassCircle labelKey="myLeaves.updatesTitle" countKey="myLeaves.updatesUnread" count={2} onPress={onPress}>
        <span aria-hidden />
      </GlassCircle>,
    )
    expect(screen.getByRole('button', { name: `${he.myLeaves.updatesTitle} 2 ${he.myLeaves.updatesUnread}` })).toBeTruthy()
  })
})

describe('the card', () => {
  it('is a region named by its title, and its title opens the page behind it', () => {
    const onOpen = vi.fn()
    const onDoor = vi.fn()
    render(
      <Card titleKey="today.approvals" onOpen={onOpen} aside={<Badge tone="pending">{WAITING}</Badge>}>
        <CardDoor labelKey="today.allRequests" onPress={onDoor} />
      </Card>,
    )
    const card = screen.getByRole('region', { name: he.today.approvals })
    fireEvent.click(within(card).getByRole('button', { name: he.today.approvals }))
    expect(onOpen).toHaveBeenCalledOnce()
    fireEvent.click(within(card).getByRole('button', { name: he.today.allRequests }))
    expect(onDoor).toHaveBeenCalledOnce()
    expect(within(card).getByText(WAITING)).toBeTruthy()
  })

  it('has a plain heading when nothing is behind it', () => {
    render(
      <Card titleKey="today.myStatus">
        <p />
      </Card>,
    )
    expect(screen.getByRole('heading', { level: 2, name: he.today.myStatus })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('the person row', () => {
  it('is a button only when it opens something', () => {
    const onPress = vi.fn()
    const { rerender } = render(<PersonRow name="A B" detail="x" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('x')).toBeTruthy()
    rerender(<PersonRow name="A B" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: 'A B' }))
    expect(onPress).toHaveBeenCalledOnce()
  })
})

const DAYS = [
  { date: '2026-11-18', state: 'base' },
  { date: '2026-11-19', state: 'away' },
  { date: '2026-11-20', state: 'pending' },
  { date: '2026-11-21', state: 'round' },
] as const

describe('the day strip', () => {
  it('reads each day with its state, in order', () => {
    render(<DayStrip days={DAYS} today="2026-11-18" labelKey="myLeaves.nextDaysTitle" />)
    const items = within(screen.getByRole('list', { name: he.myLeaves.nextDaysTitle })).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    // The leave round reads apart from another absence.
    expect(items[3]?.textContent).toContain(he.kit.dayRound)
    expect(items[0]?.textContent).toContain(he.kit.dayBase)
    expect(items[1]?.textContent).toContain(he.kit.dayAway)
    expect(items[2]?.textContent).toContain(he.kit.dayPending)
  })
})

function month(select: Parameters<typeof Month>[0]['select'], onPrevious: (() => void) | null = null, onNext = vi.fn()) {
  // 15-21 November 2026 is a whole week, Sunday first.
  const week = Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-${String(15 + index)}`, state: 'base' as const }))
  return render(
    <Month
      month="2026-11-01"
      weeks={[[null, null, null, null, null, null, { date: '2026-11-14', state: 'away' }], week]}
      today="2026-11-18"
      previousKey="today.previousMonth"
      nextKey="today.nextMonth"
      onPrevious={onPrevious}
      onNext={onNext}
      select={select}
    />,
  )
}

describe('the month', () => {
  it('is a table that only shows where days are not chosen, and names its seven columns', () => {
    month(null)
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getAllByRole('columnheader')).toHaveLength(7)
    expect(screen.getAllByRole('cell')).toHaveLength(14)
    // Only the two arrows are pressed here.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('keeps the first month from going back without losing the keyboard, and moves on', () => {
    const onNext = vi.fn()
    month(null, null, onNext)
    const previous = screen.getByRole('button', { name: he.today.previousMonth })
    expect(previous.getAttribute('aria-disabled')).toBe('true')
    // It is still a stop of the keyboard, so focus is never left on a control that went away.
    expect(previous.hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: he.today.nextMonth }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('offers each day as a cell of a grid, selected inside the selection, and refuses a day that is not allowed', () => {
    const onDay = vi.fn()
    month({ covers: (day) => day === '2026-11-19', allows: (day) => day >= '2026-11-18', onDay })
    const days = within(screen.getByRole('grid')).getAllByRole('gridcell').filter((cell) => cell.textContent !== '')
    expect(days).toHaveLength(8)
    const chosen = days.filter((day) => day.getAttribute('aria-selected') === 'true')
    expect(chosen).toHaveLength(1)
    expect(chosen[0]?.textContent).toContain(he.kit.dayBase)
    const past = days.find((day) => day.textContent.includes(he.kit.dayAway))
    expect(past?.getAttribute('aria-disabled')).toBe('true')
    if (past !== undefined) fireEvent.click(past)
    expect(onDay).not.toHaveBeenCalled()
    const free = days.find((day) => day.textContent.startsWith('20'))
    if (free !== undefined) fireEvent.click(free)
    expect(onDay).toHaveBeenCalledWith('2026-11-20')
  })

  it('gives one day the Tab key, and the arrow keys move between the days', () => {
    const onDay = vi.fn()
    const onNext = vi.fn()
    month({ covers: () => false, allows: () => true, onDay }, null, onNext)
    const cellOf = (text: string) => within(screen.getByRole('grid')).getAllByRole('gridcell').find((cell) => cell.textContent.startsWith(text))
    const stops = within(screen.getByRole('grid')).getAllByRole('gridcell').filter((cell) => cell.getAttribute('tabindex') === '0')
    // Today is the one stop.
    expect(stops).toHaveLength(1)
    expect(stops[0]).toBe(cellOf('18'))
    const today = cellOf('18')
    if (today === undefined) throw new Error('no today')
    today.focus()
    // The test page reads left to right: the right arrow is the next day.
    fireEvent.keyDown(today, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cellOf('19'))
    fireEvent.keyDown(document.activeElement ?? today, { key: 'ArrowUp' })
    // The week before holds only the 14th, in the last column: there is no 12th here, so the keyboard stays.
    expect(document.activeElement).toBe(cellOf('19'))
    fireEvent.keyDown(document.activeElement ?? today, { key: 'End' })
    expect(document.activeElement).toBe(cellOf('21'))
    fireEvent.keyDown(document.activeElement ?? today, { key: 'Home' })
    expect(document.activeElement).toBe(cellOf('15'))
    fireEvent.keyDown(document.activeElement ?? today, { key: 'Enter' })
    expect(onDay).toHaveBeenCalledWith('2026-11-15')
    // Past the month's last day the next month is asked for.
    fireEvent.keyDown(cellOf('21') ?? today, { key: 'ArrowRight' })
    expect(onNext).toHaveBeenCalledOnce()
  })
})

describe('the toast', () => {
  function shown(held = false) {
    const onAction = vi.fn()
    const onDone = vi.fn()
    render(
      <ToastRegion>
        <Toast message={BODY} actionKey="common.cancel" onAction={onAction} onDone={onDone} held={held} />
      </ToastRegion>,
    )
    return { onAction, onDone }
  }
  const pass = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('says what happened in a live region, offers its action, and leaves when its time is up', () => {
    vi.useFakeTimers()
    const { onAction, onDone } = shown()
    expect(screen.getByRole('status').textContent).toContain(BODY)
    fireEvent.click(screen.getByRole('button', { name: he.common.cancel }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
    pass(SHELL.toastMs)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('keeps the live region in the page with no toast in it', () => {
    render(<ToastRegion>{null}</ToastRegion>)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('waits while its owner holds it', () => {
    vi.useFakeTimers()
    const { onDone } = shown(true)
    pass(SHELL.toastMs * 3)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('waits while the keyboard or the pointer is on it, and counts again after', () => {
    vi.useFakeTimers()
    const { onDone } = shown()
    const action = screen.getByRole('button', { name: he.common.cancel })
    fireEvent.focus(action)
    pass(SHELL.toastMs * 2)
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.blur(action)
    fireEvent.pointerEnter(action)
    pass(SHELL.toastMs * 2)
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.pointerLeave(action)
    pass(SHELL.toastMs)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('starts its time over at a key press, so the walk to it with Tab is never cut short', () => {
    vi.useFakeTimers()
    const { onDone } = shown()
    pass(SHELL.toastMs - 1)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    pass(SHELL.toastMs - 1)
    expect(onDone).not.toHaveBeenCalled()
    pass(1)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('has no button where the step cannot be taken back', () => {
    render(<Toast message={BODY} onDone={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('the tray', () => {
  it('offers the one action of the selection, and a way to let go of it', () => {
    const onAction = vi.fn()
    const onClear = vi.fn()
    render(<Tray labelKey="today.selection" action="go" onAction={onAction} clearKey="today.clearSelection" onClear={onClear} />)
    const tray = screen.getByRole('group', { name: he.today.selection })
    fireEvent.click(within(tray).getByRole('button', { name: 'go' }))
    fireEvent.click(within(tray).getByRole('button', { name: he.today.clearSelection }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })
})

describe('the drawer with stops', () => {
  it('opens at its half stop, grows and shrinks from its handle, and closes from ✕', async () => {
    const onClose = vi.fn()
    // An overlay holds a history entry while it is open (D-337), so it lives under a router.
    const rootRoute = createRootRoute()
    const route = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <StopDrawer title={TITLE} detail={DETAIL} onClose={onClose}>
          <p>{BODY}</p>
        </StopDrawer>
      ),
    })
    const router = createRouter({ routeTree: rootRoute.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/'] }) })
    render(<RouterProvider router={router as never} />)
    const dialog = await screen.findByRole('dialog', { name: TITLE })
    expect(within(dialog).getByText(BODY)).toBeTruthy()
    const grow = within(dialog).getByRole('button', { name: he.kit.drawerGrow })
    expect(grow.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(grow)
    const shrink = within(dialog).getByRole('button', { name: he.kit.drawerShrink })
    expect(shrink.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(shrink)
    expect(within(dialog).getByRole('button', { name: he.kit.drawerGrow })).toBeTruthy()
    // The drawer's title is the screen's second heading, under the page's own.
    expect(within(dialog).getByRole('heading', { level: 2, name: TITLE })).toBeTruthy()
    // When the control that held the keyboard is gone, focus falls to the body: the next key returns it to the
    // drawer, and Escape still closes it.
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(dialog.contains(document.activeElement)).toBe(true)
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(within(dialog).getByRole('button', { name: he.common.close }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
