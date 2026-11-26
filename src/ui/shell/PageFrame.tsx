import { PANEL_IDS, SHELL } from '@config'
import { useMyLeavesAccess, useMyUpdates, usePanel, useRotationScope } from '@logic'
import { Bell } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { GlassCircle } from '../kit/Glass'
import { useShellChrome } from './chrome'

// A page of the shell (D-455): one column on the canvas that scrolls under the floating bar. Once scrolled, its top
// blurs out in a 70 px band. A glass circle in the top corner opens the soldier's updates, for who has them.

/** The updates of the soldier's own requests (D-167), where requests exist (D-218). Absent for anyone else (D-076). */
function UpdatesCircle() {
  const panel = usePanel()
  const mine = useMyLeavesAccess()
  const { requests } = useRotationScope()
  const updates = useMyUpdates()
  if (!requests || mine?.view !== true) return null
  return (
    <div className="pointer-events-none absolute end-lg top-lg">
      <GlassCircle
        labelKey="myLeaves.updatesTitle"
        count={updates?.status === 'ready' ? updates.value.unread : 0}
        countKey="myLeaves.updatesUnread"
        onPress={() => {
          panel.open(PANEL_IDS.myLeaves)
        }}
      >
        <Bell aria-hidden size={20} />
      </GlassCircle>
    </div>
  )
}

export interface PageFrameProps {
  /** Whether the corner circle belongs on this page. */
  readonly updates?: boolean
  /** What stands in the tab bar's place while something is selected. */
  readonly tray?: ReactNode
  readonly children: ReactNode
}

export function PageFrame({ updates = false, tray = null, children }: PageFrameProps) {
  const chrome = useShellChrome()
  const [scrolled, setScrolled] = useState(false)
  const { cover, bindScroller, onScroll } = chrome
  const hasTray = tray !== null
  useEffect(() => {
    cover(hasTray)
    return () => {
      cover(false)
    }
  }, [cover, hasTray])
  return (
    <main className="absolute inset-safe isolate">
      <div
        ref={bindScroller}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop
          setScrolled(top > SHELL.bandFromPx)
          onScroll(top)
        }}
        className="h-full overflow-y-auto"
      >
        <div className="mx-auto flex w-full max-w-drawer flex-col gap-lg px-lg pt-xl pb-page-end">{children}</div>
      </div>
      <div
        aria-hidden
        className={`blur-band pointer-events-none absolute inset-x-none top-none h-band transition-opacity duration-ui ease-standard motion-reduce:transition-none ${scrolled ? 'opacity-100' : 'opacity-0'}`}
      />
      {updates ? <UpdatesCircle /> : null}
      {hasTray ? <div className="pointer-events-none absolute inset-x-lg bottom-lg flex justify-center">{tray}</div> : null}
    </main>
  )
}

/** The first line of a page: it keeps clear of the corner circle. */
export function PageHead({ children }: { readonly children: ReactNode }) {
  return <header className="flex min-h-touch flex-col justify-center gap-2xs pe-action">{children}</header>
}
