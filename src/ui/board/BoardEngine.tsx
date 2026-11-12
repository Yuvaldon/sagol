import { PANEL_IDS, type BarColorMode } from '@config'
import type { CalendarDate, FilterExpression } from '@contracts'
import { t } from '@i18n'
import {
  hasLeaveConditions,
  useBarColors,
  useBoard,
  useBoardSort,
  useDateWindow,
  useLeaveConditions,
  useModuleAccess,
  useOnlyMissing,
  usePanel,
  usePresenceDay,
  useSetupUnfinished,
  useViewFilter,
  type BoardConditions,
  type BoardModel,
  type DateWindow,
  type ReadFilter,
} from '@logic'
import { ListChecks } from 'lucide-react'
import { useCallback, useMemo, type ReactNode } from 'react'
import { EmptyNotice, FailureNotice, LoadingNotice } from '../patterns/Notices'
import { Button } from '../primitives/Button'
import { useOpenUnitSetup } from '../shell/navigationPanelState'

// What every engine shares around the board model (D-174): the window, the filter and the board's own conditions from
// the URL (D-103, D-104, D-131 to D-133), the states of an empty or loading board, and how a soldier or a leave opens.
// An engine draws only the board it is handed, so the views never disagree on who is in view.

/** What an engine draws from. */
export interface BoardFrame {
  readonly model: BoardModel
  readonly window: DateWindow
  readonly filter: FilterExpression | null
  readonly colors: BarColorMode
  /** Opens a soldier's record. NULL when the actor may not open the soldiers module. */
  readonly openSoldier: ((soldierId: string) => void) | null
  /** Opens a leave's details: every leave on the board is a control (D-119). */
  readonly openLeave: (leaveId: string) => void
  /** Opens the day report on a day (D-193). NULL when the actor may not open the soldiers module; the day's own NULL
   *  when the scope has no rotation on it. */
  readonly openDay: ((day: CalendarDate) => (() => void) | null) | null
}

/** A state of the board, in the middle of the viewport, clear of the bars. */
export function Centered({ children }: { readonly children: ReactNode }) {
  return <div className="flex h-full items-center justify-center px-lg">{children}</div>
}

/** Why the board is empty when soldiers exist: what the bar asks for, or the unit and the window (D-131 to D-133). */
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

type Draw = (frame: BoardFrame) => ReactNode

function Board({
  model,
  board,
  read,
  window,
  filter,
  draw,
}: {
  readonly model: BoardModel
  readonly board: BoardConditions
  readonly read: ReadFilter
  readonly window: DateWindow
  readonly filter: FilterExpression | null
  readonly draw: Draw
}) {
  const access = useModuleAccess()
  const canSetUp = useSetupUnfinished()
  // The setup's checklist is in "הגדרות היחידה" (D-297).
  const openUnitSetup = useOpenUnitSetup()
  const panel = usePanel()
  const { mode } = useBarColors()
  const { open } = panel
  const openSoldier = useCallback(
    (soldierId: string) => {
      open(PANEL_IDS.soldiers, { entity: soldierId })
    },
    [open],
  )
  const openLeave = useCallback(
    (leaveId: string) => {
      open(PANEL_IDS.leaves, { entity: leaveId })
    },
    [open],
  )
  const { reportable, openOn } = usePresenceDay()
  const openDay = useCallback(
    (day: CalendarDate) =>
      reportable(day)
        ? () => {
            openOn(day)
          }
        : null,
    [reportable, openOn],
  )

  if (model.rosterCount === 0) {
    return (
      <Centered>
        <EmptyNotice titleKey="timeline.emptyRosterTitle" bodyKey="timeline.emptyRosterBody" headingLevel={2}>
          {canSetUp ? (
            <Button
              variant="primary"
              onPress={openUnitSetup}
            >
              <ListChecks aria-hidden size={14} />
              {t('navigation.setupTitle')}
            </Button>
          ) : null}
        </EmptyNotice>
      </Centered>
    )
  }
  if (model.soldierCount === 0) {
    const empty = emptyKeys(board, read)
    return (
      <Centered>
        <EmptyNotice titleKey={empty.titleKey} bodyKey={empty.bodyKey} headingLevel={2} />
      </Centered>
    )
  }
  return draw({ model, window, filter, colors: mode, openSoldier: access.soldiers ? openSoldier : null, openLeave, openDay: access.soldiers ? openDay : null })
}

function BoardData({
  window,
  today,
  draw,
}: {
  readonly window: DateWindow
  readonly today: CalendarDate
  readonly draw: Draw
}) {
  const { filter, read } = useViewFilter()
  const { conditions } = useLeaveConditions()
  const missing = useOnlyMissing()
  const { board: sort } = useBoardSort()
  const board = useMemo(
    (): BoardConditions => ({ leaves: conditions, onlyMissing: missing.on, sort }),
    [conditions, missing.on, sort],
  )
  const model = useBoard(window, today, filter, board)
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
  return <Board model={model.value} board={board} read={read} window={window} filter={filter} draw={draw} />
}

/** The frame of every engine. The viewport shows it only once today is known. */
export function BoardEngine({ children }: { readonly children: Draw }) {
  const { window, today } = useDateWindow()
  if (window === null || today === null) return null
  return <BoardData window={window} today={today} draw={children} />
}
