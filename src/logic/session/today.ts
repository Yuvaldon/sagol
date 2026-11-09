import type { CalendarDate } from '@contracts'
import { millisecondsUntilNextDay, todayIn } from '@domain'
import { useEffect, useState } from 'react'
import { usePorts } from '../runtime/context'
import { useCurrentOrganization } from './hooks'

/**
 * Today in the organization's time zone (D-083), and it moves at midnight with the screen open (D-107).
 * NULL while it loads, or for who may not view the organization. A timer that fires early sets the next
 * one, so the day never turns late or twice.
 */
export function useToday(): CalendarDate | null {
  const { time } = usePorts()
  const organization = useCurrentOrganization()
  const timezone = organization.status === 'ready' && organization.value !== null ? organization.value.timezone : null
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
