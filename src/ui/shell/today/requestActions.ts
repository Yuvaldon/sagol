import type { Leave } from '@contracts'
import { createContext, useContext } from 'react'

// Answering a request that waits (D-467). The answer is given by the screen, not by the row: a request that is
// answered leaves its list at once, and whatever its answer brings (a rule to acknowledge, a refusal, the toast)
// must still have somewhere to show.

export interface RequestActions {
  readonly approve: (leave: Leave) => void
  readonly reject: (leave: Leave) => void
}

export const RequestActionsContext = createContext<RequestActions>({ approve: () => undefined, reject: () => undefined })

export function useRequestActions(): RequestActions {
  return useContext(RequestActionsContext)
}

/** Marks a row's approve button with its request, so the keyboard finds the row that takes its place. */
export const REQUEST_ATTRIBUTE = 'data-request'

/** The control the keyboard returns to when the page of requests closes: the card's title. */
export const REQUESTS_OPENER = 'requests'
