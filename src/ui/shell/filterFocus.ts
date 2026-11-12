import { createContext, useContext, useState } from 'react'

// Where focus goes when a press empties the filter row (D-173): the row leaves with its focused control, so focus moves
// to "filter" in the bar rather than falling to the page.

export interface FilterFocus {
  /** Takes the bar's "filter" button, as its ref. */
  bindTrigger(element: HTMLButtonElement | null): void
  /** Called by the press that may empty the row. */
  request(): void
  /** Called once the row is gone: moves focus if a press asked for it. */
  restore(): void
}

function noop(_element?: HTMLButtonElement | null) {
  // Outside the workspace there is no row to empty.
}

const NONE: FilterFocus = { bindTrigger: noop, request: noop, restore: noop }

export const FilterFocusContext = createContext<FilterFocus>(NONE)

export function useFilterFocus(): FilterFocus {
  return useContext(FilterFocusContext)
}

class FocusHandoff implements FilterFocus {
  private trigger: HTMLButtonElement | null = null
  private requested = false

  readonly bindTrigger = (element: HTMLButtonElement | null) => {
    this.trigger = element
  }

  readonly request = () => {
    this.requested = true
  }

  readonly restore = () => {
    if (!this.requested) return
    this.requested = false
    this.trigger?.focus()
  }
}

/** The workspace's focus handoff, shared by the row and the bar. */
export function useFilterFocusScope(): FilterFocus {
  const [handoff] = useState(() => new FocusHandoff())
  return handoff
}
