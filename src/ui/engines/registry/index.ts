import { VIEW_IDS, type ViewId } from '@config'
import type { I18nKey } from '@i18n'
import { CalendarDays, GanttChart, List, Table, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { CalendarEngine } from '../calendar'
import { ListEngine } from '../list'
import { TableEngine } from '../table'
import { TimelineEngine } from '../timeline'

// The registry maps view ids to engines (ARCHITECTURE "View engines"). The view switcher lists what is
// here and nothing else, so it grows with the engines (D-076). Each engine reads the window and the filter
// from the URL through `logic`, so every engine shows the same state (D-023).

export interface EngineEntry {
  readonly labelKey: I18nKey
  readonly Icon: LucideIcon
  readonly Engine: ComponentType
}

const TIMELINE: EngineEntry = { labelKey: 'workspace.views.timeline', Icon: GanttChart, Engine: TimelineEngine }

// Every engine draws the one board model, in the colors the switcher sets (D-174).
const ENGINES: Record<ViewId, EngineEntry> = {
  timeline: TIMELINE,
  calendar: { labelKey: 'workspace.views.calendar', Icon: CalendarDays, Engine: CalendarEngine },
  list: { labelKey: 'workspace.views.list', Icon: List, Engine: ListEngine },
  table: { labelKey: 'workspace.views.table', Icon: Table, Engine: TableEngine },
}

/** The views that exist, in the order of `VIEW_IDS`. */
export const AVAILABLE_VIEWS: readonly ViewId[] = VIEW_IDS

export function engineOf(view: ViewId): EngineEntry {
  return ENGINES[view]
}
