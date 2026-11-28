import { PANEL_IDS, SHELL } from '@config'
import { useMyLeavesAccess, useMyUpdates, usePanel } from '@logic'
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { GlassCircle } from '../kit/Glass'
import { useShellChrome } from './chrome'

// A page of the shell (D-455): one column on the canvas that scrolls under the floating bar. Once scrolled, its top
// blurs out in a 70 px band. A glass circle in the top corner, the bell, opens the notifications drawer.

/**
 * The bell (D-488): the notifications drawer, what others did on the soldier's own requests (D-352). For every linked
 * soldier who reads their own leaves, in routine too: an update of the last days still matters there. Absent for anyone
 * else, who has nothing it could hold (D-076).
 */
function UpdatesCircle() {
  const panel = usePanel()
  const mine = useMyLeavesAccess()
  const updates = useMyUpdates()
  if (mine?.view !== true) return null
  return (
    <div className="pointer-events-none absolute end-lg top-lg">
      <GlassCircle
        labelKey="me.notificationsTitle"
        count={updates?.status === 'ready' ? updates.value.unread : 0}
        countKey="myLeaves.updatesUnread"
        onPress={() => {
          panel.open(PANEL_IDS.notifications)
        }}
      >
        <Bell aria-hidden size={SHELL.cornerIconPx} />
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

/**
 * A page's one heading. It can take the keyboard: a page that opens over a destination starts on it (`opens`), and
 * the keyboard lands on it when the control that held it is gone.
 */
export function PageHeading({ opens = false, className, children }: { readonly opens?: boolean; readonly className: string; readonly children: ReactNode }) {
  const { bindHeading } = useShellChrome()
  const bind = useCallback(
    (element: HTMLHeadingElement | null) => {
      bindHeading(element)
      if (opens) element?.focus()
    },
    [bindHeading, opens],
  )
  return (
    <h1 ref={bind} tabIndex={-1} className={`${className} outline-none`}>
      {children}
    </h1>
  )
}

/** The first line of a page: it keeps clear of the corner circle. */
export function PageHead({ children }: { readonly children: ReactNode }) {
  return <header className="flex min-h-touch flex-col justify-center gap-2xs pe-action">{children}</header>
}
