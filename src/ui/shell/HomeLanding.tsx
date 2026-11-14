import { PANEL_IDS } from '@config'
import { useHome, usePanel, useRotationScope, useStartView, useWorkspaceSearch } from '@logic'
import { useEffect, useRef, useState } from 'react'

/**
 * Where the app opens (D-265): on "mine" for whoever's home it is, once the answers have arrived. Only an address
 * that names nothing lands there; a link that names a panel or a view still wins. A bare open that lands on the board
 * starts on the soldier's start view, once their preferences are read (D-386).
 */
export function HomeLanding() {
  const home = useHome()
  const panel = usePanel()
  const search = useWorkspaceSearch()
  const scope = useRotationScope()
  // Read once, as the workspace first renders: a later change of the address is the soldier's own move.
  const isBare = Object.values(search).every((value) => value === undefined)
  const [bare] = useState(isBare)
  const landed = useRef(false)
  const { settled: startSettled, open: openStart } = useStartView()
  const { open } = panel
  useEffect(() => {
    if (!bare || landed.current || !home.ready || !scope.ready || !startSettled) return
    landed.current = true
    // Whatever the soldier opened while the answers were on their way stays open. "Mine" is a destination only while
    // a rotation a request can be about is (D-218), as its tab is.
    if (!isBare) return
    if (home.mine && scope.requests) open(PANEL_IDS.myLeaves)
    else openStart()
  }, [bare, isBare, home.ready, home.mine, scope.ready, scope.requests, open, startSettled, openStart])
  return null
}
