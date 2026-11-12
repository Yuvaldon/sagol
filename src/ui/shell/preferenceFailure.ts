import type { AppError, Result } from '@contracts'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// A preference save that fails says so (D-187). The menu and the panel close when a choice is made, so the message
// shows over the workspace, as a new version does (D-183), until the soldier dismisses it or a later save succeeds.

export interface PreferenceFailure {
  readonly error: AppError | null
  /** Shows the save's failure, or clears an earlier one when it succeeds. */
  readonly report: (saving: Promise<Result<unknown>>) => void
  readonly dismiss: () => void
}

function noop(_saving?: Promise<Result<unknown>>) {
  // Outside the workspace no preference is offered.
}

const NONE: PreferenceFailure = { error: null, report: noop, dismiss: noop }

export const PreferenceFailureContext = createContext<PreferenceFailure>(NONE)

/** Where the menu and the panel send a preference save's answer. */
export function useReportPreferenceSave(): PreferenceFailure['report'] {
  return useContext(PreferenceFailureContext).report
}

export function usePreferenceFailure(): PreferenceFailure {
  return useContext(PreferenceFailureContext)
}

const UNAVAILABLE: AppError = { code: 'unavailable' }

/** The workspace's preference failure, shared by the menu, the panel and the notice. */
export function usePreferenceFailureScope(): PreferenceFailure {
  const [error, setError] = useState<AppError | null>(null)
  const report = useCallback((saving: Promise<Result<unknown>>) => {
    saving.then(
      (result) => {
        setError(result.ok ? null : result.error)
      },
      () => {
        setError(UNAVAILABLE)
      },
    )
  }, [])
  const dismiss = useCallback(() => {
    setError(null)
  }, [])
  return useMemo(() => ({ error, report, dismiss }), [error, report, dismiss])
}
