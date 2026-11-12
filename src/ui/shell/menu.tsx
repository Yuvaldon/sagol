import { Check } from 'lucide-react'
import { MenuItem } from 'react-aria-components'
import type { ReactNode } from 'react'
import { MENU_ITEM } from './menuStyles'

// A choice of the bars' menus (D-108, D-211, D-214): it shows a check while selected.

export interface MenuChoiceProps {
  readonly id: string
  readonly label: string
  readonly icon?: ReactNode
  /** A muted second part, such as a rotation's days. */
  readonly detail?: string
}

export function MenuChoice({ id, label, icon, detail }: MenuChoiceProps) {
  return (
    <MenuItem id={id} textValue={detail === undefined ? label : `${label} ${detail}`} className={MENU_ITEM}>
      {({ isSelected }) => (
        <>
          {icon}
          <span className="flex-1">{label}</span>
          {detail === undefined ? null : <span className="text-label text-text-muted tabular-nums">{detail}</span>}
          {isSelected ? <Check aria-hidden size={14} /> : null}
        </>
      )}
    </MenuItem>
  )
}
