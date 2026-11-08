import type { TimeSource } from '@contracts'

/** The only code that reads the system clock (D-083). */
export const systemTime: TimeSource = {
  now: () => new Date().toISOString(),
}
