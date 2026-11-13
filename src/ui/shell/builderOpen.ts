import { createContext, useContext } from 'react'

// Which part of "filter and sort" is open (D-312): the whole builder from the bar, or one rule from its chip, which
// the builder scrolls to and focuses.

export type BuilderTarget =
  | { readonly kind: 'all' }
  | { readonly kind: 'rule'; readonly index: number }
  | { readonly kind: 'leaveStatus' }
  | { readonly kind: 'leaveType' }
  | { readonly kind: 'missing' }

export interface BuilderOpen {
  open(target: BuilderTarget): void
}

function noop(_target: BuilderTarget) {
  // Outside the workspace there is no builder to open.
}

export const BuilderOpenContext = createContext<BuilderOpen>({ open: noop })

export function useBuilderOpen(): BuilderOpen {
  return useContext(BuilderOpenContext)
}
