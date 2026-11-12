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
