import type { LeaveStatus, LeaveType } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { Badge, type BadgeTone } from '../../kit/Badge'
import { glyphOf } from '../../theme/icons'
import { leaveTypeToneOf } from '../../theme/palette'

// The two small signs of a leave in a list: its status, as the new interface's badge, and its type (D-119, D-120, D-454).

const BADGES: Record<LeaveStatus, { readonly tone: BadgeTone; readonly labelKey: I18nKey }> = {
  pending: { tone: 'pending', labelKey: 'leaves.badgePending' },
  approved: { tone: 'ok', labelKey: 'leaves.badgeApproved' },
  rejected: { tone: 'rejected', labelKey: 'leaves.badgeRejected' },
  cancelled: { tone: 'neutral', labelKey: 'leaves.badgeCancelled' },
}

/** A request's status as the new interface's badge (D-454): the word on a tinted ground. */
export function LeaveBadge({ status }: { readonly status: LeaveStatus }) {
  const { tone, labelKey } = BADGES[status]
  return <Badge tone={tone}>{t(labelKey)}</Badge>
}

/** The type's color and icon, beside its name. Decoration: the name carries the meaning. */
export function TypeMark({ type }: { readonly type: LeaveType | null }) {
  const Icon = glyphOf(type?.icon_key ?? null)?.Icon ?? null
  // Green never means away (D-290): a type stored green shows the absence tone, as on the board.
  const swatch = leaveTypeToneOf(type?.color_key ?? null).fill
  return (
    <span aria-hidden className={`flex size-icon shrink-0 items-center justify-center rounded-pill text-on-action ${swatch}`}>
      {Icon === null ? null : <Icon size={10} strokeWidth={2.6} />}
    </span>
  )
}
