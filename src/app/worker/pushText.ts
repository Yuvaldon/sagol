import { DATE_FORMATS, DATE_LOCALE, PANEL_IDS, ROUTES, SEARCH_PARAMS } from '@config'
import { NotificationKind, type CalendarDate, type PushOutcome, type PushPayload } from '@contracts'
import { t, type I18nKey } from '@i18n'
import { DateFormatter, parseDate } from '@internationalized/date'

// One push as the notification the phone shows (D-357, D-359). The payload holds facts only; the words come from
// `i18n`. Days are written absolutely (the leave's own days), never "tomorrow": a notification may be read days later.
// The worker cannot load `ui`, so it formats the days itself, with the same formats as `ui/patterns/dates.ts`.

const NEUTRAL_ZONE = 'UTC'
const LINE_SEPARATOR = ' · '
const WORD_SEPARATOR = ' '
/** The tag of the one "requests await you" notification, so a second one replaces the first. */
const AWAITING_TAG = NotificationKind.enum.awaiting_me

const ONE: Readonly<Record<PushOutcome, I18nKey>> = {
  created: 'notifications.push.created',
  approved: 'notifications.push.approved',
  rejected: 'notifications.push.rejected',
  cancelled: 'notifications.push.cancelled',
  rescheduled: 'notifications.push.rescheduled',
  reopened: 'notifications.push.reopened',
  comment: 'notifications.push.comment',
}
const MANY: Readonly<Record<PushOutcome, I18nKey>> = {
  created: 'notifications.push.createdMany',
  approved: 'notifications.push.approvedMany',
  rejected: 'notifications.push.rejectedMany',
  cancelled: 'notifications.push.cancelledMany',
  rescheduled: 'notifications.push.rescheduledMany',
  reopened: 'notifications.push.reopenedMany',
  comment: 'notifications.push.commentMany',
}

export interface PushNotice {
  readonly title: string
  readonly body: string
  /** One notification per leave: a later push about it replaces the earlier. */
  readonly tag: string
  /** Where a tap opens the app. */
  readonly url: string
}

const dayOf = (date: CalendarDate) => parseDate(date).toDate(NEUTRAL_ZONE)

/** The leave's days the way `ui` writes them: one day, or a range (`8–14 בנוב׳`). */
export function daysText(start: CalendarDate, end: CalendarDate): string {
  const formatter = new DateFormatter(DATE_LOCALE, { ...DATE_FORMATS.dayMonth, timeZone: NEUTRAL_ZONE })
  return start === end ? formatter.format(dayOf(start)) : formatter.formatRange(dayOf(start), dayOf(end))
}

function urlOf(panel: string, entity: string | null): string {
  const search = new URLSearchParams({ [SEARCH_PARAMS.panel]: panel })
  if (entity !== null) search.set(SEARCH_PARAMS.entity, entity)
  return `${ROUTES.workspace}?${search.toString()}`
}

export function pushNotice(payload: PushPayload, staging: boolean): PushNotice {
  const title = t(staging ? 'app.stagingName' : 'app.name')
  const days = daysText(payload.start_date, payload.end_date)
  const many = payload.count > 1
  if (payload.kind === NotificationKind.enum.my_request) {
    return {
      title,
      body: many ? [String(payload.count), t(MANY[payload.outcome])].join(WORD_SEPARATOR) : [t(ONE[payload.outcome]), days].join(LINE_SEPARATOR),
      tag: payload.leave_id,
      url: urlOf(PANEL_IDS.leaves, payload.leave_id),
    }
  }
  if (many) {
    return {
      title,
      body: [String(payload.count), t('notifications.push.awaitingMany')].join(WORD_SEPARATOR),
      tag: AWAITING_TAG,
      url: urlOf(PANEL_IDS.leaveInbox, null),
    }
  }
  return {
    title,
    body: [t('notifications.push.awaitingOne') + payload.soldier_name, days].join(LINE_SEPARATOR),
    tag: payload.leave_id,
    url: urlOf(PANEL_IDS.leaves, payload.leave_id),
  }
}
