// Notifications (D-350, D-352): how far back the in-app updates reach, and how many pushes one command sends.

export const NOTIFICATIONS = {
  /** The "עדכונים" section shows the updates of this many days back (D-350). */
  updatesDays: 30,
  /** One command sends at most this many pushes, to stay inside the free plan's CPU per call (D-352). */
  maxPushesPerCommand: 150,
} as const
