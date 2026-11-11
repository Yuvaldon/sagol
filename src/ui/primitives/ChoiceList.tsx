import { t, type I18nKey } from '@i18n'
import { Check } from 'lucide-react'
import { Checkbox, CheckboxGroup, Label, Radio, RadioGroup } from 'react-aria-components'

// A short list of named choices: many at once (checkboxes) or one (radios, with "none"). A choice's name comes from
// the data or the dictionary, and a dot of its color and a quiet note may follow it. The box carries a check, so the
// state is never color alone.

export type ChoiceText = { readonly text: string } | { readonly key: I18nKey }

export interface Choice {
  readonly key: string
  readonly label: ChoiceText
  /** A color class for a small dot beside the name. */
  readonly dot?: string | null
  /** A quiet word after the name, such as "archived". */
  readonly note?: I18nKey | null
}

const textOf = (label: ChoiceText) => ('text' in label ? label.text : t(label.key))

const ROW =
  'group flex min-h-touch cursor-pointer items-center gap-sm rounded-control px-xs text-control outline-none md:min-h-control data-hovered:bg-inner'
const BOX =
  'flex size-icon shrink-0 items-center justify-center rounded-bar border border-line bg-surface outline-focus outline-offset-2 group-data-focus-visible:outline-2 group-data-selected:border-action-solid group-data-selected:bg-action-solid group-data-selected:text-on-action'

function ChoiceName({ choice }: { readonly choice: Choice }) {
  return (
    <>
      {choice.dot === undefined || choice.dot === null ? null : (
        <span aria-hidden className={`size-dot shrink-0 rounded-pill ${choice.dot}`} />
      )}
      <span className="min-w-none truncate">{textOf(choice.label)}</span>
      {choice.note === undefined || choice.note === null ? null : (
        <span className="text-micro text-text-muted">{t(choice.note)}</span>
      )}
    </>
  )
}

export interface CheckListProps {
  readonly label: ChoiceText
  readonly choices: readonly Choice[]
  readonly selected: readonly string[]
  readonly onChange: (keys: string[]) => void
  readonly autoFocus?: boolean
  /** The choices side by side, wrapping, for short names such as the actions of the permission grid. */
  readonly inline?: boolean
}

export function CheckList({ label, choices, selected, onChange, autoFocus = false, inline = false }: CheckListProps) {
  return (
    <CheckboxGroup value={[...selected]} onChange={onChange} className="flex flex-col gap-2xs">
      <Label className="text-label font-semibold text-text-muted">{textOf(label)}</Label>
      <div className={inline ? 'flex flex-wrap gap-x-sm' : 'contents'}>
      {choices.map((choice, index) => (
        <Checkbox key={choice.key} value={choice.key} autoFocus={autoFocus && index === 0} className={ROW}>
          {({ isSelected }) => (
            <>
              <span aria-hidden className={BOX}>
                {isSelected ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <ChoiceName choice={choice} />
            </>
          )}
        </Checkbox>
      ))}
      </div>
    </CheckboxGroup>
  )
}

const NONE = '__none__'

export interface RadioListProps {
  readonly label: ChoiceText
  readonly choices: readonly Choice[]
  readonly selected: string | null
  readonly noneKey: I18nKey
  readonly onChange: (key: string | null) => void
}

export function RadioList({ label, choices, selected, noneKey, onChange }: RadioListProps) {
  return (
    <RadioGroup
      value={selected ?? NONE}
      onChange={(key) => {
        onChange(key === NONE ? null : key)
      }}
      className="flex flex-col gap-2xs"
    >
      <Label className="text-label font-semibold text-text-muted">{textOf(label)}</Label>
      {[{ key: NONE, label: { key: noneKey } }, ...choices].map((choice) => (
        <Radio key={choice.key} value={choice.key} className={ROW}>
          {({ isSelected }) => (
            <>
              <span aria-hidden className={`${BOX} rounded-pill`}>
                {isSelected ? <span className="size-dot rounded-pill bg-on-action" /> : null}
              </span>
              <ChoiceName choice={choice} />
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  )
}
