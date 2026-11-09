import { ICON_KEYS } from '@config'
import { t, type I18nKey } from '@i18n'
import { Slash } from 'lucide-react'
import { Label, Radio, RadioGroup, Text } from 'react-aria-components'
import { ICON_GLYPHS } from '../theme/icons'

// Pick one key of the closed icon list, or none (D-113). Each icon carries its name for screen readers, and
// the selected one is filled, so the choice never rests on the shape alone.

const NO_ICON = 'none'

const TILE =
  'flex size-touch cursor-pointer items-center justify-center rounded-pill border border-line bg-surface text-text-muted outline-focus outline-offset-2 md:size-control data-focus-visible:outline-2 data-selected:border-action-solid data-selected:bg-action-solid data-selected:text-on-action'

export interface IconFieldProps {
  readonly labelKey: I18nKey
  readonly name: string
  readonly value: string | null
  readonly onChange: (value: string | null) => void
  readonly error: I18nKey | null
}

export function IconField({ labelKey, name, value, onChange, error }: IconFieldProps) {
  return (
    <RadioGroup
      name={name}
      value={value ?? NO_ICON}
      onChange={(next) => {
        onChange(next === NO_ICON ? null : next)
      }}
      isInvalid={error !== null}
      validationBehavior="aria"
      orientation="horizontal"
      className="flex flex-col gap-xs"
    >
      <Label className="text-label font-semibold text-text-muted">{t(labelKey)}</Label>
      <div className="flex flex-wrap gap-xs">
        <Radio value={NO_ICON} aria-label={t('icons.none')} className={TILE}>
          <Slash aria-hidden size={14} />
        </Radio>
        {ICON_KEYS.map((key) => {
          const { Icon, labelKey: iconLabel } = ICON_GLYPHS[key]
          return (
            <Radio key={key} value={key} aria-label={t(iconLabel)} className={TILE}>
              <Icon aria-hidden size={15} />
            </Radio>
          )
        })}
      </div>
      {error === null ? null : (
        <Text slot="errorMessage" className="text-label text-status-rejected">
          {t(error)}
        </Text>
      )}
    </RadioGroup>
  )
}
