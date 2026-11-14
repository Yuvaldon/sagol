import type { CalendarDate } from '@contracts'
import { millisecondsUntil, millisecondsUntilNextDay, startOfHour, todayIn } from '@domain'
import { useEffect, useState } from 'react'
import { usePorts } from '../runtime/context'
import { useCurrentOrganization } from './hooks'

/** The device's time zone: the day of who may not view the organization (D-160). */
function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * The time zone the screens count days in: the organization's (D-083), or the device's for who may not view the
 * organization (D-160). NULL while it loads or when it fails.
 */
export function useTimezone(): string | null {
  const organization = useCurrentOrganization()
  if (organization.status !== 'ready') return null
  return organization.value === null ? deviceTimezone() : organization.value.timezone
}

/**
 * Today in the screens' time zone, and it moves at midnight with the screen open (D-107). NULL while it loads. A
 * timer that fires early sets the next one, so the day never turns late or twice.
 */
export function useToday(): CalendarDate | null {
  const { time } = usePorts()
  const timezone = useTimezone()
  const [turns, setTurns] = useState(0)

  useEffect(() => {
    if (timezone === null) return undefined
    const timer = setTimeout(() => {
      setTurns((count) => count + 1)
    }, millisecondsUntilNextDay(timezone, time.now()))
    return () => {
      clearTimeout(timer)
    }
  }, [timezone, time, turns])

  return timezone === null ? null : todayIn(timezone, time.now())
}

/**
 * Whether the clock has passed `hour` o'clock today in the screens' time zone, and it turns at that hour with the screen
 * open, then back at midnight (D-443). NULL while today loads. A timer that fires early sets the next one.
 */
export function usePastHour(hour: number): boolean | null {
  const { time } = usePorts()
  const timezone = useTimezone()
  const today = useToday()
  const [turns, setTurns] = useState(0)
  const due = timezone === null || today === null ? null : startOfHour(today, hour, timezone)

  useEffect(() => {
    if (due === null) return undefined
    const left = millisecondsUntil(time.now(), due)
    if (left <= 0) return undefined
    const timer = setTimeout(() => {
      setTurns((count) => count + 1)
    }, left)
    return () => {
      clearTimeout(timer)
    }
  }, [due, time, turns])

  return due === null ? null : millisecondsUntil(time.now(), due) <= 0
}
