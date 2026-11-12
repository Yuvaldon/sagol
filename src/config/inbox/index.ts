// How far the requests inbox reaches (D-205, OI-065).

export const INBOX = {
  /** The closed section shows rejected and cancelled leaves whose dates reach this many days back from today... */
  closedPastDays: 60,
  /** ...up to this many days ahead. A closed leave outside the span stays on the soldier's own list. */
  closedFutureDays: 365,
} as const

// "Mine" (D-265): the soldier's own next days, in or out.

export const MINE = {
  /** How many days, from today, "my next days" shows. */
  nextDays: 7,
} as const
