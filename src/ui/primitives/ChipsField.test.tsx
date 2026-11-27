import { dictionary as he } from '@i18n'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChipsField } from './ChipsField'

// One of a few choices as chips (D-454): a radio group named by its label, the chosen chip checked. Test data only.

const OPTIONS = [
  { key: 'a', label: { text: 'A' }, value: 1 },
  { key: 'b', label: { text: 'B' }, value: 2 },
] as const

describe('the chips field', () => {
  it('is a radio group named by its label, with nothing chosen until a value is', () => {
    render(<ChipsField labelKey="leaves.type" name="type" value={null} options={OPTIONS} onChange={vi.fn()} error={null} />)
    const group = screen.getByRole('radiogroup', { name: he.leaves.type })
    const chips = within(group).getAllByRole<HTMLInputElement>('radio')
    expect(chips.map((chip) => chip.checked)).toEqual([false, false])
  })

  it('checks the chip of its value, and answers a press with the value', () => {
    const onChange = vi.fn()
    render(<ChipsField labelKey="leaves.type" name="type" value={2} options={OPTIONS} onChange={onChange} error={null} />)
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'B' }).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'A' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('says what is wrong under the chips', () => {
    render(<ChipsField labelKey="leaves.type" name="type" value={null} options={OPTIONS} onChange={vi.fn()} error="issues.required" />)
    expect(screen.getByText(he.issues.required)).toBeTruthy()
  })
})
