import type { CalendarDate } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { parseDate } from '@internationalized/date'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Button as AriaButton,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Text,
} from 'react-aria-components'
import { Popover } from './overlays'
import { fieldLabel, type FieldLabel } from './label'

// One calendar day, typed or picked. The value is the ISO string the contracts hold (D-042), and '' while
// the field is empty. Like every field here it knows nothing about forms.

const NAV =
  'flex size-touch cursor-pointer items-center justify-center rounded-pill text-text-muted outline-focus md:size-control data-focus-visible:outline-2 data-hovered:bg-inner'

export interface DateFieldProps {
  readonly labelKey: FieldLabel
  readonly name: string
  readonly value: CalendarDate | ''
  readonly onChange: (value: CalendarDate | '') => void
  readonly error: I18nKey | null
  /** The name is read aloud only, where a row already shows what the date is of. */
  readonly hideLabel?: boolean
}

export function DateField({ labelKey, name, value, onChange, error, hideLabel = false }: DateFieldProps) {
  return (
    <DatePicker
      name={name}
      value={value === '' ? null : parseDate(value)}
      onChange={(next) => {
        onChange(next === null ? '' : next.toString())
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      className="flex flex-col gap-xs"
    >
      <Label className={hideLabel ? 'sr-only' : 'text-label font-semibold text-text-muted'}>{fieldLabel(labelKey)}</Label>
      <Group className="flex min-h-touch w-full items-center justify-between gap-sm rounded-control border border-line bg-surface ps-md text-input text-text outline-focus outline-offset-1 md:min-h-control md:text-control data-focus-within:outline-2 data-invalid:border-status-rejected">
        <DateInput dir="ltr" className="flex">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded-bar px-2xs tabular-nums outline-none data-focused:bg-inner data-placeholder:text-text-muted"
            />
          )}
        </DateInput>
        <AriaButton
          aria-label={t('common.openCalendar')}
          className="flex min-h-touch min-w-touch shrink-0 cursor-pointer items-center justify-center text-text-muted outline-focus md:min-h-control md:min-w-control data-focus-visible:outline-2"
        >
          <CalendarIcon aria-hidden size={14} />
        </AriaButton>
      </Group>
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
      <Popover className="glass-menu rounded-panel p-md">
        <Dialog className="outline-none">
          <Calendar className="flex flex-col gap-sm">
            <header className="flex items-center justify-between gap-sm">
              <AriaButton slot="previous" className={NAV}>
                <ChevronRight aria-hidden size={16} />
              </AriaButton>
              <Heading className="text-control font-semibold" />
              <AriaButton slot="next" className={NAV}>
                <ChevronLeft aria-hidden size={16} />
              </AriaButton>
            </header>
            <CalendarGrid className="border-collapse text-control">
              {(date) => (
                <CalendarCell
                  date={date}
                  className="flex size-touch cursor-pointer items-center justify-center rounded-pill tabular-nums outline-focus md:size-control data-focus-visible:outline-2 data-hovered:bg-inner data-outside-month:text-text-muted data-selected:bg-action-solid data-selected:text-on-action"
                />
              )}
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  )
}
