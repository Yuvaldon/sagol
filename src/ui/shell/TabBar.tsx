import { t } from '@i18n'
import { useDateWindow, usePanel } from '@logic'
import { CalendarDays } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'
import { EntryCount } from './EntryCount'
import { useDailyEntries, type ModuleEntry } from './moduleEntries'
import { NavigationPanel } from './NavigationPanel'
import { TAB, TAB_COLOR } from './tabStyle'

// The bottom strip's destinations (D-252), on every screen. The board first, then the soldier's own requests and
// the inbox, then "ניהול" (D-254). Each tab is an icon over a short name; nothing toggles here, and the only
// number is what waits on a destination.

function Tab({ entry }: { readonly entry: ModuleEntry }) {
  return (
    <AriaButton onPress={entry.onPress} className={`${TAB} ${TAB_COLOR.other}`}>
      <entry.Icon aria-hidden size={18} />
      <span className="max-w-full truncate">{t(entry.labelKey)}</span>
      <EntryCount entry={entry} floating />
    </AriaButton>
  )
}

/** The board: current while no panel is open. A press closes what is open and brings today back into sight. */
function BoardTab() {
  const panel = usePanel()
  const { window, goToToday } = useDateWindow()
  const current = panel.panel === null
  return (
    <AriaButton
      aria-current={current ? 'page' : false}
      onPress={() => {
        panel.close()
        if (window !== null && !window.holdsToday) goToToday()
      }}
      className={`${TAB} ${current ? TAB_COLOR.current : TAB_COLOR.other}`}
    >
      <CalendarDays aria-hidden size={18} />
      <span className="max-w-full truncate">{t('workspace.board')}</span>
    </AriaButton>
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
