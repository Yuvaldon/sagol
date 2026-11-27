import { VIEW_IDS, type ViewId } from '@config'
import type { ComponentType } from 'react'
import { viewMeta, type ViewMeta } from '../../board/views'
import { CalendarEngine } from '../calendar'
import { ListEngine } from '../list'
import { TableEngine } from '../table'
import { TimelineEngine } from '../timeline'

// The registry maps view ids to engines (ARCHITECTURE "View engines"). The view switcher lists the views of
// `ui/board/views` and nothing else (D-076). Each engine reads the window and the filter from the URL through `logic`,
// so every engine shows the same state (D-023).

export interface EngineEntry extends ViewMeta {
  readonly Engine: ComponentType
}

const ENGINES: Record<ViewId, ComponentType> = {
  calendar: CalendarEngine,
  timeline: TimelineEngine,
  list: ListEngine,
  table: TableEngine,
}

/** Every view that exists, in the order of `VIEW_IDS`. */
export const AVAILABLE_VIEWS: readonly ViewId[] = VIEW_IDS

export function engineOf(view: ViewId): EngineEntry {
  return { ...viewMeta(view), Engine: ENGINES[view] }
}
