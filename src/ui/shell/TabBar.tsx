import { t } from '@i18n'
import { useActiveView, useHome, usePanel } from '@logic'
import { useState } from 'react'
import { Button as AriaButton } from 'react-aria-components'
import { AVAILABLE_VIEWS, engineOf } from '../engines/registry'
import { useViewDevice } from '../patterns/media'
import { useBoardShown } from './boardShown'
import { useFocusMode } from './focusMode'
import { EntryCount } from './EntryCount'
import { useDailyEntries, type ModuleEntry } from './moduleEntries'
import { NavigationPanel } from './NavigationPanel'
import { TAB, TAB_COLOR } from './tabStyle'
import { ViewSheet } from './ViewSheet'

// The bottom strip's destinations (D-252), on every screen. The board first, then "mine" and the inbox, then
// "ניהול" (D-254). Each tab is an icon over a short name; nothing toggles here, and the only number is what waits on
// a destination.

function Tab({ entry }: { readonly entry: ModuleEntry }) {
  return (
    <AriaButton
      aria-current={entry.current ? 'page' : false}
      onPress={entry.onPress}
      className={`${TAB} ${entry.current ? TAB_COLOR.current : TAB_COLOR.other}`}
    >
      <entry.Icon aria-hidden size={18} />
      <span className="max-w-full truncate">{t(entry.labelKey)}</span>
      <EntryCount entry={entry} floating />
    </AriaButton>
  )
}

/**
 * The board, with the icon of its current view (D-311). From another destination a press closes what is open, keeps
 * the range, and makes it home (D-265); on the board itself it opens the view picker.
 */
function BoardTab() {
  const panel = usePanel()
  const { choose } = useHome()
  const { view } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const boardShown = useBoardShown()
  const [picking, setPicking] = useState(false)
  const focusMode = useFocusMode()
  const current = panel.panel === null
  const { Icon } = engineOf(view)
  return (
    <>
      {/* Focus returns here when focus mode ends (D-301): the view sheet it was entered from opens from this tab. */}
      <AriaButton
        ref={focusMode.bind('control')}
        aria-current={current ? 'page' : false}
        onPress={() => {
          if (current && boardShown) {
            setPicking(true)
            return
          }
          panel.close()
          choose(false)
        }}
        className={`${TAB} ${current ? TAB_COLOR.current : TAB_COLOR.other}`}
      >
        <Icon aria-hidden size={18} />
        <span className="max-w-full truncate">{t('workspace.board')}</span>
      </AriaButton>
      {picking ? (
        <ViewSheet
          onClose={() => {
            setPicking(false)
          }}
        />
      ) : null}
    </>
  )
}

export function TabBar() {
  const daily = useDailyEntries()
  return (
    <>
      {/* A narrow screen scrolls the tabs sideways rather than widen the page (D-155); "ניהול" stays in place. */}
      <div className="-m-xs flex min-w-none items-center gap-2xs overflow-x-auto p-xs">
        <BoardTab />
        {daily.map((entry) => (
          <Tab key={entry.id} entry={entry} />
        ))}
      </div>
      <NavigationPanel />
    </>
  )
}
