import { TOOLTIP } from '@config'
import { t, type I18nKey } from '@i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Button as AriaButton, Dialog, DialogTrigger, Radio, RadioGroup, TooltipTrigger } from 'react-aria-components'
import { NameTooltip } from '../primitives/Button'
import { Popover } from '../primitives/overlays'

// The options menu of the new interface (the handoff's board spec, §1.12; OI-386): one floating glass menu for every
// view option of a list or a view. Each row shows its current value ("מיון · ותק ›"); a row opens its choices inside the
// same menu, with a back arrow. A value other than the default is bold, and the trigger carries a night-blue dot. After a
// divider come the actions that are not values (focus mode). A tap outside closes it.

const SEPARATOR = ' · '
const FOCUS = 'outline-focus -outline-offset-2 data-focus-visible:outline-2'
const ROW = `flex min-h-touch w-full cursor-pointer items-center gap-sm rounded-control px-md text-start text-body text-text data-hovered:bg-inner ${FOCUS}`

/** A choice of a row: its key, its words, and a quiet line under them. */
export interface OptionChoice {
  readonly key: string
  readonly label: string
  readonly detail?: string | undefined
}

/** An action inside a row's level, or after the divider: it closes the menu unless it says otherwise. */
export interface OptionAction {
  readonly key: string
  readonly label: string
  readonly detail?: string | undefined
  readonly icon?: ReactNode
  readonly onPress: () => void
  /** Keeps the menu open after the press, as removing one condition among several does. */
  readonly stays?: boolean
}

export interface OptionRow {
  readonly key: string
  readonly labelKey: I18nKey
  /** The current value, in words. */
  readonly value: string
  /** Not the default: the value is bold, and the trigger has its dot. */
  readonly changed: boolean
  /** The choices of the value; a pick returns to the rows. */
  readonly choices?: {
    readonly selected: string | null
    readonly options: readonly OptionChoice[]
    readonly onChange: (key: string) => void
  }
  /** What the level offers besides its choices. */
  readonly actions?: readonly OptionAction[]
}

export interface OptionsMenuProps {
  readonly labelKey: I18nKey
  readonly icon: ReactNode
  readonly rows: readonly OptionRow[]
  readonly footer: readonly OptionAction[]
}

function ActionButton({ action, close, stayed }: { readonly action: OptionAction; readonly close: () => void; readonly stayed?: () => void }) {
  return (
    <AriaButton
      onPress={() => {
        action.onPress()
        if (action.stays !== true) close()
        // The pressed row may leave with what it acted on: the keyboard goes back to the level's start.
        else stayed?.()
      }}
      className={ROW}
    >
      {action.icon}
      <span className="flex min-w-none flex-1 flex-col">
        <span className="truncate">{action.label}</span>
        {action.detail === undefined ? null : <span className="truncate text-small text-text-muted">{action.detail}</span>}
      </span>
    </AriaButton>
  )
}

function Level({ row, onBack, close }: { readonly row: OptionRow; readonly onBack: () => void; readonly close: () => void }) {
  const title = t(row.labelKey)
  const { choices } = row
  const back = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex flex-col gap-2xs">
      <div className="flex items-center gap-xs">
        <AriaButton
          ref={back}
          // The row pressed is gone with the rows: the keyboard lands on the way back.
          autoFocus
          aria-label={t('kit.optionsBack')}
          onPress={onBack}
          className={`inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted ${FOCUS}`}
        >
          <ChevronRight aria-hidden size={18} />
        </AriaButton>
        {/* The menu keeps its own name; the level's title is what its back arrow leaves. */}
        <p className="text-body font-bold">{title}</p>
      </div>
      {choices === undefined ? null : (
        <RadioGroup
          aria-label={title}
          value={choices.selected}
          onChange={(key) => {
            choices.onChange(key)
            onBack()
          }}
          className="flex flex-col"
        >
          {choices.options.map((option) => (
            <Radio
              key={option.key}
              value={option.key}
              className={`${ROW} data-selected:font-bold data-selected:text-action-solid`}
            >
              <span className="flex min-w-none flex-1 flex-col">
                <span className="truncate">{option.label}</span>
                {option.detail === undefined ? null : <span className="truncate text-small font-normal text-text-muted">{option.detail}</span>}
              </span>
            </Radio>
          ))}
        </RadioGroup>
      )}
      {row.actions === undefined || row.actions.length === 0 ? null : (
        <div className={`flex flex-col ${choices === undefined ? '' : 'border-t border-divider-strong pt-2xs'}`}>
          {row.actions.map((action) => (
            <ActionButton
              key={action.key}
              action={action}
              close={close}
              stayed={() => {
                back.current?.focus()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OptionsMenu({ labelKey, icon, rows, footer }: OptionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<string | null>(null)
  /** The row a level was left for, which takes the keyboard again on the way back. */
  const [left, setLeft] = useState<string | null>(null)
  const label = t(labelKey)
  const changed = rows.some((row) => row.changed)
  const shown = rows.find((row) => row.key === level) ?? null
  const close = () => {
    setOpen(false)
    setLevel(null)
    setLeft(null)
  }
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setLevel(null)
          setLeft(null)
        }
      }}
    >
      <TooltipTrigger delay={TOOLTIP.delayMs} closeDelay={TOOLTIP.closeDelayMs}>
        <AriaButton
          aria-label={changed ? [label, t('kit.optionsChanged')].join(SEPARATOR) : label}
          className="relative inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full text-text outline-focus outline-offset-2 data-focus-visible:outline-2"
        >
          {icon}
          {changed ? <span aria-hidden className="absolute end-xs top-xs size-dot rounded-full border border-surface bg-action-solid" /> : null}
        </AriaButton>
        <NameTooltip>{label}</NameTooltip>
      </TooltipTrigger>
      <Popover placement="bottom end" offset={8} className="glass-regular w-menu max-w-full rounded-card p-xs shadow-menu">
        <Dialog aria-label={label} className="max-h-sheet-height overflow-y-auto outline-none">
          {shown === null ? (
            <div className="flex flex-col">
              {rows.map((row) => (
                <AriaButton
                  key={row.key}
                  autoFocus={row.key === left}
                  aria-label={[t(row.labelKey), row.value].join(SEPARATOR)}
                  onPress={() => {
                    setLeft(row.key)
                    setLevel(row.key)
                  }}
                  className={ROW}
                >
                  <span className="shrink-0">{t(row.labelKey)}</span>
                  <span aria-hidden className="text-text-muted">
                    {SEPARATOR.trim()}
                  </span>
                  <span className={`min-w-none flex-1 truncate ${row.changed ? 'font-bold text-text' : 'text-text-muted'}`}>{row.value}</span>
                  <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-muted" />
                </AriaButton>
              ))}
              {footer.length === 0 ? null : (
                <div className="mt-2xs flex flex-col border-t border-divider-strong pt-2xs">
                  {footer.map((action) => (
                    <ActionButton key={action.key} action={action} close={close} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Level
              row={shown}
              onBack={() => {
                setLevel(null)
              }}
              close={close}
            />
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
