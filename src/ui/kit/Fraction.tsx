import { t } from '@i18n'

// How many of how many (D-454): the numerator at display size and bold, the denominator small and gray. Below the
// threshold the numerator turns amber, and the words read aloud say so.

const WORD = ' '
const SLASH = '/'

export interface FractionProps {
  readonly value: number
  readonly of: number
  /** Below what a rule asks for. */
  readonly low: boolean
}

export function Fraction({ value, of, low }: FractionProps) {
  const spoken = [String(value), t('kit.fractionOf'), String(of), ...(low ? [t('kit.fractionLow')] : [])].join(WORD)
  return (
    <p className="flex items-baseline">
      <span className="sr-only">{spoken}</span>
      {/* Digits read left to right also inside a right-to-left line. */}
      <span aria-hidden dir="ltr" className="flex items-baseline tabular-nums">
        <span className={`text-display font-bold tracking-tight ${low ? 'text-status-pending-text' : 'text-text'}`}>{value}</span>
        <span className="text-heading font-semibold text-text-muted">{[SLASH, String(of)].join('')}</span>
      </span>
    </p>
  )
}
