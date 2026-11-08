import { t, type I18nKey } from '@i18n'
import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { IconButton } from '../primitives/Button'

// The actions of one row. Only what the actor may do arrives here, and a row with nothing to do shows
// no menu at all (D-076).

export interface RowAction {
  readonly id: string
  readonly labelKey: I18nKey
  readonly icon: ReactNode
  readonly onAction: () => void
}

export function ActionMenu({ labelKey, actions }: { readonly labelKey: I18nKey; readonly actions: readonly RowAction[] }) {
  if (actions.length === 0) return null
  return (
    <MenuTrigger>
      <IconButton labelKey={labelKey}>
        <MoreHorizontal aria-hidden size={16} />
      </IconButton>
      <Popover className="glass-menu min-w-trigger rounded-panel p-xs">
        <Menu className="flex max-w-menu flex-col gap-2xs outline-none">
          {actions.map((action) => (
            <MenuItem
              key={action.id}
              id={action.id}
              textValue={t(action.labelKey)}
              onAction={action.onAction}
              className="flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-md text-control whitespace-nowrap outline-none md:min-h-control data-focused:bg-inner"
            >
              {action.icon}
              {t(action.labelKey)}
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}
