import { useSavedViews } from '@logic'
import { useState } from 'react'
import { useBoardView } from '../board/views'
import { Drawer } from '../patterns/Drawer'
import { ManageSavedViews, SaveViewAction, SavedViewCards } from './SavedViewsSection'

// The saved views (D-384 … D-388): held on the view switcher, or "תצוגות שמורות" in the options menu (D-458, D-480).
// The cards once one is saved, saving the board as it is, and the manage list in place of the sheet's body.

export function SavedViewsSheet({ onClose }: { readonly onClose: () => void }) {
  const { view } = useBoardView()
  const saved = useSavedViews(view)
  const [managing, setManaging] = useState(false)
  const manage = () => {
    setManaging(true)
  }
  if (managing && saved.available && saved.views.length > 0) {
    return (
      <Drawer titleKey="workspace.savedViews.manage" onClose={onClose}>
        <ManageSavedViews
          saved={saved}
          onBack={() => {
            setManaging(false)
          }}
        />
      </Drawer>
    )
  }
  return (
    <Drawer titleKey="board.savedViews" onClose={onClose}>
      <div className="flex flex-col gap-xl">
        <SavedViewCards saved={saved} shown={view} onManage={manage} onClose={onClose} />
        <SaveViewAction saved={saved} shown={view} onManage={manage} />
      </div>
    </Drawer>
  )
}
