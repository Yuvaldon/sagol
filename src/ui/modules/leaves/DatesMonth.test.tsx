import type { DaySelection } from '@logic'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DatesMonth } from './DatesMonth'

// The month of a new leave's dates (D-476): a first tap is always one day, whatever the dates held before. Test data only.

const TODAY = '2026-11-11'
const TYPE = 'type'

function Harness({ start, end }: { readonly start: string; readonly end: string }) {
  const [dates, setDates] = useState<DaySelection>({ start, end })
  return (
    <>
      <output>{[dates.start, dates.end].join('..')}</output>
      <DatesMonth today={TODAY} start={dates.start} end={dates.end} onChange={setDates} />
      <button
        type="button"
        onClick={() => {
          setDates({ start: '2027-01-05', end: '2027-01-06' })
        }}
      >
        {TYPE}
      </button>
    </>
  )
}

const cell = (text: string) => {
  const found = within(screen.getByRole('grid')).getAllByRole('gridcell').find((one) => one.textContent.startsWith(text))
  if (found === undefined) throw new Error(`no day ${text}`)
  return found
}
const dates = () => screen.getByRole('status').textContent

describe('the month of a new leave', () => {
  it('takes a first tap as one day on a blank row, which holds today to today', () => {
    render(<Harness start={TODAY} end={TODAY} />)
    fireEvent.click(cell('30'))
    expect(dates()).toBe('2026-11-30..2026-11-30')
  })

  it('makes a range of the second tap, either way, and starts over at the third', () => {
    render(<Harness start={TODAY} end={TODAY} />)
    fireEvent.click(cell('20'))
    fireEvent.click(cell('23'))
    expect(dates()).toBe('2026-11-20..2026-11-23')
    fireEvent.click(cell('25'))
    expect(dates()).toBe('2026-11-25..2026-11-25')
    fireEvent.click(cell('18'))
    expect(dates()).toBe('2026-11-18..2026-11-25')
  })

  it('says only the date of a day: the month picks days, it does not tell where anyone is', () => {
    render(<Harness start={TODAY} end={TODAY} />)
    expect(cell('30').textContent).toMatch(/2026$/)
  })

  it('opens on the month of the first date, and follows it when it is typed', () => {
    render(<Harness start="2026-12-03" end="2026-12-04" />)
    expect(screen.getByRole('grid').getAttribute('aria-label')).toContain('דצמבר')
    fireEvent.click(screen.getByRole('button', { name: TYPE }))
    expect(screen.getByRole('grid').getAttribute('aria-label')).toContain('ינואר 2027')
    expect(cell('5').getAttribute('aria-selected')).toBe('true')
  })
})
