import { FOCUS_MODE } from '@config'
import { useStartView, useWorkspaceSearch } from '@logic'
import { useEffect } from 'react'
import { useBoardShown } from './boardShown'
import type { BuilderTarget } from './builderOpen'
import { useFocusMode } from './focusMode'
import { RuleBuilder } from './RuleBuilder'
import { SavedViewDroppedNotice } from './SavedViewDroppedNotice'
import { Viewport } from './Viewport'

/**
 * "לוח" (the handoff's board spec; D-455, D-480): the view in sight fills the screen inside the safe area, each in the
 * board's frame (its month title, the view switcher and the options). Focus mode hides the tab bar and the head and
 * leaves a capsule with the month; a phone turned on its side enters it by itself (§2).
 */

/** The page's heading, for readers: the organization (D-175); the board's title is its month. */
function OrganizationName({ name }: { readonly name: string }) {
  return <h1 className="sr-only">{name}</h1>
}

/**
 * The first time the board is opened on an address that names nothing of it, it starts on the soldier's start view,
 * once their preferences are read (D-386). `started` is the workspace's, so a return to the board keeps what was left.
 */
function useStartOnce(started: boolean, onStarted: () => void) {
  const search = useWorkspaceSearch()
  const { settled, open } = useStartView()
  const bare = Object.entries(search).every(([key, value]) => key === 'tab' || value === undefined)
  useEffect(() => {
    if (started || !settled) return
    onStarted()
    if (bare) open()
  }, [started, onStarted, settled, bare, open])
}

/** A phone turned on its side enters focus mode (§2); turning it back leaves it as the actor left it. */
function useLandscapeFocus() {
  const { available, enter } = useFocusMode()
  useEffect(() => {
    if (!available || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(FOCUS_MODE.landscape)
    const onChange = () => {
      if (query.matches) enter()
    }
    query.addEventListener('change', onChange)
    return () => {
      query.removeEventListener('change', onChange)
    }
  }, [available, enter])
}

export interface BoardPlaceProps {
  readonly name: string
  /** Whether the board was already opened since the workspace loaded, and the note that it now is. */
  readonly started: boolean
  readonly onStarted: () => void
  readonly building: BuilderTarget | null
  readonly onBuilt: () => void
}

export function BoardPlace({ name, started, onStarted, building, onBuilt }: BoardPlaceProps) {
  const boardShown = useBoardShown()
  useStartOnce(started, onStarted)
  useLandscapeFocus()
  return (
    <>
      <div className="absolute inset-safe">
        <main className="isolate h-full">
          <OrganizationName name={name} />
          <Viewport />
        </main>
      </div>
      {boardShown ? <SavedViewDroppedNotice /> : null}
      {boardShown && building !== null ? <RuleBuilder target={building} onClose={onBuilt} /> : null}
    </>
  )
}
