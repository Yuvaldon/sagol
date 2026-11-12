import { VIRTUAL_LIST } from '@config'
import { t } from '@i18n'
import { fullName, type BoardItem } from '@logic'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button as AriaButton } from 'react-aria-components'
import { BoardEngine, type BoardFrame } from '../../../board/BoardEngine'
import { EngineScroller } from '../../../board/EngineScroller'
import { groupLabel } from '../../../board/labels'
import { LeaveChip } from '../../../board/LeaveChip'

// The list view (D-174): the timeline's rows, soldiers under their groups, each with its leaves in the window as chips
// with their days. Nothing is drawn per day, so it reads on a phone. Long rosters are virtualized, as on the timeline.

function ListRow({ item, frame }: { readonly item: BoardItem; readonly frame: BoardFrame }) {
  if (item.kind === 'group') {
    return (
      <h2 className="flex items-baseline gap-sm px-lg pt-lg pb-xs text-name font-bold text-text">
        <span className="truncate">{groupLabel(item.label)}</span>
        <span className="text-label font-normal text-text-muted tabular-nums">{item.size}</span>
      </h2>
    )
  }
  const name = fullName(item.soldier)
  const rank = item.rank?.short_title ?? item.rank?.title ?? null
  const leaves = frame.model.leaves.get(item.soldier.id) ?? []
  const { openSoldier } = frame
  return (
    <div className="flex flex-col gap-xs border-b border-line px-lg py-sm md:flex-row md:items-start md:gap-lg">
      <div className="flex min-w-none items-baseline gap-sm md:w-list md:shrink-0">
        {openSoldier === null ? (
          <span className="truncate text-name font-medium">{name}</span>
        ) : (
          <AriaButton
            onPress={() => {
              openSoldier(item.soldier.id)
            }}
            className="min-h-touch cursor-pointer truncate text-start text-name font-medium outline-focus outline-offset-1 md:min-h-control data-focus-visible:outline-2 data-hovered:underline"
          >
            {name}
          </AriaButton>
        )}
        {rank === null ? null : <span className="shrink-0 text-label text-text-muted">{rank}</span>}
      </div>
      {leaves.length === 0 ? (
        <p className="text-label text-text-muted md:self-center">{t('engines.noLeaves')}</p>
      ) : (
        <ul className="flex flex-wrap gap-xs" aria-label={name}>
          {leaves.map((leave) => (
            <li key={leave.id} className="max-w-full">
              <LeaveChip leave={leave} colors={frame.colors} onOpen={frame.openLeave} dates />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function List({ frame, scroller }: { readonly frame: BoardFrame; readonly scroller: HTMLElement | null }) {
  const { items } = frame.model
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    // Chips wrap, so each row is measured; the estimate is only where it starts.
    estimateSize: () => VIRTUAL_LIST.estimatedRowPx,
    overscan: VIRTUAL_LIST.overscanRows,
    getItemKey: (index) => items[index]?.key ?? index,
  })
  return (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index]
        if (item === undefined) return null
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            className="absolute inset-x-none top-none"
            style={{ transform: `translateY(${String(row.start)}px)` }}
          >
            <ListRow item={item} frame={frame} />
          </div>
        )
      })}
    </div>
  )
}

/** The list engine. */
export function ListEngine() {
  return (
    <BoardEngine>
      {(frame) => <EngineScroller labelKey="engines.listLabel">{(scroller) => <List frame={frame} scroller={scroller} />}</EngineScroller>}
    </BoardEngine>
  )
}
