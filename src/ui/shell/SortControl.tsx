import { BOARD_SORT_KEYS, SORT_ORDERS, type BoardSortKey, type SortOrder } from '@config'
import { t, type I18nKey } from '@i18n'
import { useBoardSort } from '@logic'
import { ArrowDownUp } from 'lucide-react'
import { Button as AriaButton, Header, Menu, MenuSection, MenuTrigger, Popover } from 'react-aria-components'
import { useIsDesktop } from '../patterns/media'
import { BAR_CONTROL, PRESS } from './FilterBar'
import { MenuChoice } from './menu'
import { MENU_HEADER, MENU_LIST, MENU_POPOVER, onlyKey } from './menuStyles'

// The order of the board's rows, for every engine (D-214): a key and a direction, both in the URL. The table's own
// column keys share the state, so a key set from a column header shows here as no board key.

const KEY_LABELS: Record<BoardSortKey, I18nKey> = {
  name: 'workspace.sortKeys.name',
  rank: 'workspace.sortKeys.rank',
  seniority: 'workspace.sortKeys.seniority',
  unit: 'workspace.sortKeys.unit',
  absent: 'workspace.sortKeys.absent',
}
const ORDER_LABELS: Record<SortOrder, I18nKey> = {
  asc: 'workspace.sortOrders.asc',
  desc: 'workspace.sortOrders.desc',
}

export function SortControl() {
  const sort = useBoardSort()
  const isDesktop = useIsDesktop()
  // A table-only key selects no board key here, and the direction shown is the one the board's rows follow.
  const boardKey = BOARD_SORT_KEYS.find((key) => key === (sort.key ?? sort.board.key))
  const order = boardKey === undefined ? sort.board.order : sort.order
  return (
    <MenuTrigger>
      <AriaButton aria-label={t('workspace.sort')} className={`${BAR_CONTROL} ${PRESS}`}>
        <ArrowDownUp aria-hidden size={isDesktop ? 14 : 18} className="text-text-muted md:text-text" />
        <span aria-hidden className={isDesktop ? '' : 'sr-only'}>
          {t('workspace.sort')}
        </span>
      </AriaButton>
      <Popover className={MENU_POPOVER}>
        <Menu aria-label={t('workspace.sort')} className={MENU_LIST}>
          <MenuSection
            selectionMode="single"
            selectedKeys={boardKey === undefined ? [] : [boardKey]}
            onSelectionChange={(selection) => {
              const next = BOARD_SORT_KEYS.find((key) => key === onlyKey(selection))
              if (next !== undefined) sort.set(next)
            }}
          >
            <Header className={MENU_HEADER}>{t('workspace.sortBy')}</Header>
            {BOARD_SORT_KEYS.map((key) => (
              <MenuChoice key={key} id={key} label={t(KEY_LABELS[key])} />
            ))}
          </MenuSection>
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[order]}
            onSelectionChange={(selection) => {
              const next = SORT_ORDERS.find((order) => order === onlyKey(selection))
              if (next !== undefined) sort.set(boardKey ?? sort.board.key, next)
            }}
          >
            <Header className={MENU_HEADER}>{t('workspace.sortOrder')}</Header>
            {SORT_ORDERS.map((order) => (
              <MenuChoice key={order} id={order} label={t(ORDER_LABELS[order])} />
            ))}
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
