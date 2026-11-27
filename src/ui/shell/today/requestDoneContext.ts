import type { Leave } from '@contracts'
import { createContext, useContext } from 'react'

// A request that was just answered, told to the screen that shows the toast for it (D-467).

export interface RequestDone {
  readonly leave: Leave
  readonly step: 'approve' | 'reject'
}

export const RequestDoneContext = createContext<(done: RequestDone) => void>(() => undefined)

/** Tells the screen that a request was answered. */
export function useReportRequestDone(): (done: RequestDone) => void {
  return useContext(RequestDoneContext)
}
