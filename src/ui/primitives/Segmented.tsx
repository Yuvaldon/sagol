import { t, type I18nKey } from '@i18n'
import type { ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup, type Key } from 'react-aria-components'

// One of a few ways to show the same thing (D-318): pills in a track, like the drawer's sections, one always
// pressed. Arrow keys move between them.

export interface SegmentedOption<Id extends string> {
  readonly id: Id
  readonly labelKey: I18nKey
  readonly icon: ReactNode
}

export interface SegmentedProps<Id extends string> {
  readonly labelKey: I18nKey
  readonly options: readonly SegmentedOption<Id>[]
  readonly value: Id
  readonly onChange: (value: Id) => void
}

export function Segmented<Id extends string>({ labelKey, options, value, onChange }: SegmentedProps<Id>) {
  const choose = (keys: Set<Key>) => {
    const chosen = options.find((option) => keys.has(option.id))
    if (chosen !== undefined) onChange(chosen.id)
  }
  return (
    <ToggleButtonGroup
      aria-label={t(labelKey)}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[value]}
      onSelectionChange={choose}
      className="flex w-fit gap-xs rounded-pill bg-inner p-2xs"
    >
      {options.map((option) => (
        <ToggleButton
          key={option.id}
          id={option.id}
          className="flex min-h-touch cursor-pointer items-center justify-center gap-xs rounded-pill px-md text-control font-semibold text-text-muted outline-focus md:min-h-control data-focus-visible:outline-2 data-selected:bg-surface data-selected:text-text"
        >
          {option.icon}
          {t(option.labelKey)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
