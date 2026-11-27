import { DESKTOP_ONLY_VIEWS, VIEW_IDS, type ViewId } from '@config'
import type { I18nKey } from '@i18n'
import { useActiveView, type ActiveViewState } from '@logic'
import { CalendarDays, ChartNoAxesGantt, List, Table, type LucideIcon } from 'lucide-react'
import { useViewDevice } from '../patterns/media'

// The board's views as the switcher names them (the handoff's board spec, §4; D-463, D-480): their words and icons, and
// the views each device offers. The registry pairs each with its engine; what draws around the engines reads this.

export interface ViewMeta {
  readonly labelKey: I18nKey
  readonly Icon: LucideIcon
}

const META: Readonly<Record<ViewId, ViewMeta>> = {
  calendar: { labelKey: 'workspace.views.calendar', Icon: CalendarDays },
  timeline: { labelKey: 'workspace.views.timeline', Icon: ChartNoAxesGantt },
  list: { labelKey: 'workspace.views.list', Icon: List },
  table: { labelKey: 'workspace.views.table', Icon: Table },
}

export function viewMeta(view: ViewId): ViewMeta {
  return META[view]
}

const DESKTOP_ONLY: ReadonlySet<ViewId> = new Set(DESKTOP_ONLY_VIEWS)
const PHONE_VIEWS: readonly ViewId[] = VIEW_IDS.filter((id) => !DESKTOP_ONLY.has(id))

export interface BoardView extends ActiveViewState {
  /** The views this device offers, in the switcher's order. */
  readonly views: readonly ViewId[]
  readonly phone: boolean
}

/** The view the board shows on this device, and the views it offers (D-290, D-463). */
export function useBoardView(): BoardView {
  const device = useViewDevice()
  const views = device === 'phone' ? PHONE_VIEWS : VIEW_IDS
  const active = useActiveView(views, device)
  return { ...active, views, phone: device === 'phone' }
}
