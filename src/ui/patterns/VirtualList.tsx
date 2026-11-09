import { VIRTUAL_LIST } from '@config'
import { t, type I18nKey } from '@i18n'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useDrawerScroll } from './drawerScroll'

// A long list in a drawer: only the rows in sight exist in the page. It scrolls with the drawer's body, so
// a bottom sheet keeps one scroll and a screen reader still hears each row's place in the whole list.

export interface VirtualListProps<T> {
  readonly labelKey: I18nKey
  readonly items: readonly T[]
  readonly keyOf: (item: T) => string
  readonly renderRow: (item: T) => ReactNode
}

export function VirtualList<T>({ labelKey, items, keyOf, renderRow }: VirtualListProps<T>) {
  const scroller = useDrawerScroll()
  const list = useRef<HTMLUListElement>(null)
  const [offset, setOffset] = useState(0)

  // Where the list starts inside what scrolls, such as below a search box.
  useLayoutEffect(() => {
    if (scroller === null || list.current === null) return
    const top = list.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    setOffset(top)
  }, [scroller])

  // TanStack Virtual hands out new functions each render, and nothing here memoizes them.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller,
    estimateSize: () => VIRTUAL_LIST.estimatedRowPx,
    overscan: VIRTUAL_LIST.overscanRows,
    scrollMargin: offset,
    getItemKey: (index) => {
      const item = items[index]
      return item === undefined ? index : keyOf(item)
    },
  })

  return (
    <ul ref={list} aria-label={t(labelKey)} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index]
        if (item === undefined) return null
        return (
          <li
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            aria-setsize={items.length}
            aria-posinset={row.index + 1}
            className="absolute inset-x-none top-none"
            style={{ transform: `translateY(${String(row.start - offset)}px)` }}
          >
            {renderRow(item)}
          </li>
        )
      })}
    </ul>
  )
}
