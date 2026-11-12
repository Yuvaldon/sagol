import { createContext, useContext, useMemo, useState } from 'react'

// The navigation panel opens from its own button, and on its setup, "הגדרות היחידה", from wherever the setup is
// offered: the empty board and the template wizard once it is done or put off (D-297).

export type NavigationView = 'work' | 'setup'

export interface NavigationPanelState {
  readonly isOpen: boolean
  readonly view: NavigationView
  /** Opens the panel on a view, or moves an open panel to it. */
  readonly open: (view: NavigationView) => void
  readonly close: () => void
}

function noop(_view?: NavigationView) {
  // Outside the workspace there is no navigation panel.
}

const NONE: NavigationPanelState = { isOpen: false, view: 'work', open: noop, close: noop }

export const NavigationPanelContext = createContext<NavigationPanelState>(NONE)

export function useNavigationPanel(): NavigationPanelState {
  return useContext(NavigationPanelContext)
}

/** Opens "הגדרות היחידה", where the setup's checklist is (D-297). */
export function useOpenUnitSetup(): () => void {
  const { open } = useContext(NavigationPanelContext)
  return () => {
    open('setup')
  }
}

/** The workspace's navigation panel, shared by its button and the setup's openers. */
export function useNavigationPanelScope(): NavigationPanelState {
  const [state, setState] = useState<{ readonly isOpen: boolean; readonly view: NavigationView }>({ isOpen: false, view: 'work' })
  return useMemo(
    () => ({
      ...state,
      open: (view: NavigationView) => {
        setState({ isOpen: true, view })
      },
      close: () => {
        setState((current) => ({ ...current, isOpen: false }))
      },
    }),
    [state],
  )
}
