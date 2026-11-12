import { Switch } from 'react-aria-components'
import { fieldLabel, type FieldLabel } from './label'

// An on and off choice. The track moves and fills, so the state is not carried by color alone.

export interface SwitchFieldProps {
  readonly labelKey: FieldLabel
  readonly name: string
  readonly value: boolean
  readonly onChange: (value: boolean) => void
}

export function SwitchField({ labelKey, name, value, onChange }: SwitchFieldProps) {
  return (
    <Switch
      name={name}
      isSelected={value}
      onChange={onChange}
      className="group flex min-h-touch cursor-pointer items-center gap-sm text-control font-semibold text-text outline-none md:min-h-control"
    >
      <span className="flex h-icon w-control shrink-0 items-center rounded-pill border border-line bg-inner p-2xs outline-focus outline-offset-2 group-data-focus-visible:outline-2 group-data-selected:border-action-solid group-data-selected:bg-action-solid">
        <span className="size-dot rounded-pill bg-text-muted group-data-selected:ms-auto group-data-selected:bg-on-action" />
      </span>
      {fieldLabel(labelKey)}
    </Switch>
  )
}
