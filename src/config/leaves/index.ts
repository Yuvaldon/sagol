// The request sheet (D-275): one soldier's rows, and the recurring row that repeats its days.

export const LEAVE_SHEET = {
  /** A recurring row starts at the rhythm soldiers ask for most: 8 in, 6 home, so every 14 days. */
  defaultEveryDays: 14,
  /** The shortest repetition: the next leave starts a day after the last one began. */
  minEveryDays: 1,
  /** The longest repetition, a year. */
  maxEveryDays: 365,
  /** The most leaves one sheet creates, its rows and their repetitions together. */
  maxLeaves: 60,
} as const

// A batch of leaves (D-302): a collective leave, a leave's copies, or a plan of rounds, each created in one command.

export const LEAVE_BATCH = {
  /** The most leaves one command creates for many soldiers: a battalion's soldiers, once each. */
  maxLeaves: 500,
} as const

// The leave-round planner (D-270, D-316): a rhythm of days in and days home, for groups of soldiers in a rotation.

export const LEAVE_ROUNDS = {
  /** A plan starts at the routine rhythm: 8 days in, then 6 home. */
  defaultDaysIn: 8,
  defaultDaysHome: 6,
  /** Each part of the rhythm is at least a day and at most this many. */
  maxDays: 90,
  /** The most leaves one plan creates, every group's soldiers and rounds together; within a batch's bound (D-302). */
  maxLeaves: 300,
} as const
