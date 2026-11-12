import { PANEL_IDS } from '@config'
import { RulesRowPlacement, type CalendarDate, type FilterExpression } from '@contracts'
import { t } from '@i18n'
import {
  filterUnitOf,
  hasLeaveConditions,
  useBarColors,
  useDateWindow,
  useHeatRow,
  useLeaveConditions,
  useModuleAccess,
  useNavigationPreferences,
  useOnlyMissing,
  usePanel,
  useRulesDay,
  useTimeline,
  useViewFilter,
  type BoardConditions,
  type DateWindow,
  type ReadFilter,
  type TimelineModel,
} from '@logic'
import { Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../../../patterns/Notices'
import { Button } from '../../../primitives/Button'
import { TimelineGrid } from '../view/TimelineGrid'
import { useBoardDrag } from './boardDrag'
import { DragOverlay } from './DragOverlay'
import { dayCells, heatCells, timelineRows } from './model'

// The timeline as the viewport shows it. The adapter is the only part that meets the domain (model.ts).
// Window, filter and the board's own conditions come from the URL through
// `logic`, the same state every engine reads (D-103, D-104, D-131 to D-133).

/** A state of the board, in the middle of the viewport, clear of the bars. */
function Centered({ children }: { readonly children: ReactNode }) {
  return <div className="flex h-full items-center justify-center px-lg">{children}</div>
}

/** Why the board is empty when soldiers exist: what the bar asks for, or the unit and the week (D-131 to D-133). */
function emptyKeys(board: BoardConditions, read: ReadFilter) {
  if (board.onlyMissing) return { titleKey: 'timeline.emptyMissingTitle', bodyKey: 'timeline.emptyMissingBody' } as const
  const chips =
    read.kind === 'other' ||
    read.conditions.tagSets.length > 0 ||
    read.conditions.rankIds.length > 0 ||
    read.conditions.statuses.length > 0 ||
    hasLeaveConditions(board.leaves)
  if (chips) return { titleKey: 'timeline.emptyFilterTitle', bodyKey: 'timeline.emptyFilterBody' } as const
  return { titleKey: 'timeline.emptyScopeTitle', bodyKey: 'timeline.emptyScopeBody' } as const
}

function Board({
  model,
  empty,
  window,
  filter,
}: {
  readonly model: TimelineModel
  readonly empty: ReturnType<typeof emptyKeys>
  readonly window: DateWindow
  readonly filter: FilterExpression | null
}) {
  const access = useModuleAccess()
  const panel = usePanel()
  const { mode } = useBarColors()
  const rulesDay = useRulesDay()
  const unit = filterUnitOf(filter)
  const heat = useHeatRow(window, unit.kind === 'unit' ? unit.unitId : null)
  const { rulesRow } = useNavigationPreferences()
  const soldiers = useMemo(() => model.items.flatMap((item) => (item.kind === 'soldier' ? [item.soldier] : [])), [model.items])
  const drag = useBoardDrag(window, soldiers)
  const open = access.soldiers
    ? (soldierId: string) => {
        panel.open(PANEL_IDS.soldiers, { entity: soldierId })
      }
    : null

  if (model.rosterCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="timeline.emptyRosterTitle" bodyKey="timeline.emptyRosterBody" headingLevel={2}>
        {access.soldiers ? (
          <Button
            onPress={() => {
              panel.open(PANEL_IDS.soldiers)
            }}
          >
            <Users aria-hidden size={14} />
            {t('soldiers.open')}
          </Button>
        ) : null}
        </EmptyNotice>
      </Centered>
    )
  }
  if (model.soldierCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey={empty.titleKey} bodyKey={empty.bodyKey} headingLevel={2} />
      </Centered>
    )
  }
  const openLeave = (leaveId: string) => {
    panel.open(PANEL_IDS.leaves, { entity: leaveId })
  }
  return (
    <>
      <TimelineGrid
        days={dayCells(model.days, model.today)}
        rows={timelineRows(model.items, model.days, open, {
          leaves: model.leaves,
          colors: mode,
          openLeave,
          movable: drag.movable,
          creatable: drag.creatable,
        })}
        heat={heat.status === 'ready' && heat.value !== null ? heatCells(heat.value, rulesDay.openOn) : null}
        heatOnTop={rulesRow === RulesRowPlacement.enum.above}
        drag={drag.props}
      />
      <DragOverlay drag={drag} />
    </>
  )
}

function TimelineData({
  window,
  today,
  filter,
  read,
  board,
}: {
  readonly window: DateWindow
  readonly today: CalendarDate
  readonly filter: FilterExpression | null
  readonly read: ReadFilter
  readonly board: BoardConditions
}) {
  const model = useTimeline(window, today, filter, board)
  if (model.status === 'loading') {
    return (
      <Centered>
        <LoadingNotice />
      </Centered>
    )
  }
  if (model.status === 'failed') {
    return (
      <Centered>
        <FailureNotice error={model.error} />
      </Centered>
    )
  }
  return <Board model={model.value} empty={emptyKeys(board, read)} window={window} filter={filter} />
}

/** The timeline engine. The viewport shows it only once today is known. */
export function TimelineEngine() {
  const { window, today } = useDateWindow()
  const { filter, read } = useViewFilter()
  const { conditions } = useLeaveConditions()
  const missing = useOnlyMissing()
  const board = useMemo((): BoardConditions => ({ leaves: conditions, onlyMissing: missing.on }), [conditions, missing.on])
  if (window === null || today === null) return null
  return <TimelineData window={window} today={today} filter={filter} read={read} board={board} />
}
