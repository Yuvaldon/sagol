import { PALETTE_KEYS } from '@config'
import { t, type I18nKey } from '@i18n'
import { Check, Slash } from 'lucide-react'
import { Label, Radio, RadioGroup, Text } from 'react-aria-components'
import { PALETTE_SWATCHES } from '../theme/palette'

// Pick one key of the closed palette, or none (D-074). Each swatch carries its name for screen
// readers, and the selected one carries a check, so color is never the only signal.

const NO_COLOR = 'none'

const SWATCH =
  'relative flex size-touch cursor-pointer items-center justify-center rounded-pill outline-focus outline-offset-2 md:size-control data-focus-visible:outline-2'

export interface ColorFieldProps {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly error: I18nKey | null
}

export function ColorField({ labelKey, name, value, onChange, error }: ColorFieldProps) {
  return (
    <RadioGroup
      name={name}
      value={value ?? NO_COLOR}
      onChange={(next) => {
        onChange(next === NO_COLOR ? null : next)
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      orientation="horizontal"
      className="flex flex-col gap-xs"
    >
      <Label className="text-label font-semibold text-text-muted">{t(labelKey)}</Label>
      <div className="flex flex-wrap gap-xs">
        <Radio value={NO_COLOR} aria-label={t('palette.none')} className={`${SWATCH} border border-line bg-surface text-text-muted`}>
          <Slash aria-hidden size={14} />
        </Radio>
        {PALETTE_KEYS.map((key) => (
          <Radio
            key={key}
            value={key}
            aria-label={t(PALETTE_SWATCHES[key].labelKey)}
            className={`${SWATCH} ${PALETTE_SWATCHES[key].className} text-on-action`}
          >
            {({ isSelected }) => (isSelected ? <Check aria-hidden size={16} /> : null)}
          </Radio>
        ))}
      </div>
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
    </RadioGroup>
  )
}
