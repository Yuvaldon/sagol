// Notifications (D-352, D-354): how far back the in-app updates reach, and how many pushes one command sends.

export const NOTIFICATIONS = {
  /** The "עדכונים" section shows the updates of this many days back (D-352). */
  updatesDays: 30,
  /** One command sends at most this many pushes, to stay inside the free plan's CPU per call (D-354). */
  maxPushesPerCommand: 150,
  /** A push the service could not deliver within this many seconds is dropped: a day-old update is in the app (D-411). */
  pushTtlSeconds: 86_400,
  /** RFC 8030 urgency: a leave update is shown to the soldier, so the service wakes the phone for it (D-411). */
  pushUrgency: 'high',
  /**
   * The VAPID token a push carries is valid this long (RFC 8292 allows at most a day). The server signs one per push, so
   * an hour covers any delivery delay without leaving a long-lived token in a push service's logs (D-435).
   */
  pushVapidTokenSeconds: 3_600,
  /**
   * Sign-out waits this long for the device's unsubscribe, then signs out anyway (D-358, D-433): a push service that
   * hangs never keeps a soldier signed in. The server row ends on the next 404 or 410, or on revoke.
   */
  signOutUnsubscribeTimeoutMs: 4_000,
} as const
