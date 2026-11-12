import { PANEL_IDS } from '@config'
import { useHome, usePanel, useWorkspaceSearch } from '@logic'
import { useEffect, useRef, useState } from 'react'

/**
 * Where the app opens (D-265): on "mine" for whoever's home it is, once the answers have arrived. Only an address
 * that names nothing lands there; a link that names a panel or a view still wins.
 */
export function HomeLanding() {
  const home = useHome()
  const panel = usePanel()
  const search = useWorkspaceSearch()
  // Read once, as the workspace first renders: a later change of the address is the soldier's own move.
  const isBare = Object.values(search).every((value) => value === undefined)
  const [bare] = useState(isBare)
  const landed = useRef(false)
  const { open } = panel
  useEffect(() => {
    if (!bare || landed.current || !home.ready) return
    landed.current = true
    // Whatever the soldier opened while the answers were on their way stays open.
    if (home.mine && isBare) open(PANEL_IDS.myLeaves)
  }, [bare, isBare, home.ready, home.mine, open])
  return null
}
