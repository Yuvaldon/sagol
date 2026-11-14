import { z } from 'zod'
import { LeaveId } from '../common/ids'
import { CalendarDate } from '../common/scalars'
import { NotificationKind, PushOutcome } from '../enums'

// What the server sends a browser in one push (D-357). The worker turns it into a notification's text, so the payload
// holds facts only, never words: the texts live in `i18n` and the worker has no other source. Encrypted end to end;
// the push service sees its size only.

const PushCommon = {
  leave_id: LeaveId,
  /** How many leaves the one command touched for this recipient; the payload describes `leave_id`, the first (D-355). */
  count: z.number().int().min(1),
  start_date: CalendarDate,
  end_date: CalendarDate,
}

export const PushPayload = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal(NotificationKind.enum.my_request), outcome: PushOutcome, ...PushCommon }),
  /** The soldier's name only to who approves them, who sees it anyway (D-357). */
  z.strictObject({ kind: z.literal(NotificationKind.enum.awaiting_me), soldier_name: z.string().min(1).max(101), ...PushCommon }),
])
export type PushPayload = z.infer<typeof PushPayload>
