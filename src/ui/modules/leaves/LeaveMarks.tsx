import type { LeaveStatus, LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { glyphOf } from '../../theme/icons'
import { swatchClassOf } from '../../theme/palette'

// The two small signs of a leave in a list: its status and its type (D-119, D-120).

const STATUS_KEYS: Record<LeaveStatus, I18nKey> = {
  pending: 'leaves.statusPending',
  approved: 'leaves.statusApproved',
  rejected: 'leaves.statusRejected',
  cancelled: 'leaves.statusCancelled',
}

/** Status by form as well as color (D-111): a solid fill, a dashed edge, or a quiet edge for a closed leave. */
const STATUS_CHIPS: Record<LeaveStatus, string> = {
  pending: 'border-dashed border-status-pending text-status-pending-text',
  approved: 'border-status-approved bg-status-approved text-on-action',
  rejected: 'border-status-rejected text-status-rejected',
  cancelled: 'border-line text-text-muted',
}

export function StatusChip({ status }: { readonly status: LeaveStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-pill border px-sm py-2xs text-label font-semibold ${STATUS_CHIPS[status]}`}>
      {t(STATUS_KEYS[status])}
    </span>
  )
}

/** The type's color and icon, beside its name. Decoration: the name carries the meaning. */
export function TypeMark({ type }: { readonly type: LeaveType | null }) {
  const Icon = glyphOf(type?.icon_key ?? null)?.Icon ?? null
  const swatch = swatchClassOf(type?.color_key ?? null)
  return (
    <span aria-hidden className={`flex size-icon shrink-0 items-center justify-center rounded-pill text-on-action ${swatch ?? 'bg-absence'}`}>
      {Icon === null ? null : <Icon size={10} strokeWidth={2.6} />}
    </span>
  )
}
