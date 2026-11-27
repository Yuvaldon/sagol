import type { PresenceWithMe, PresentSoldier } from '@contracts'
import { PRESENCE_VIEW } from '@domain'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useActor } from '../leaves/workflowHooks'
import { checkOn } from '../permissions/checks'
import { useCanAnswers } from '../permissions/hooks'
import { QUERY_KEYS } from '../queries/client'
import { loaded, type Loaded } from '../queries/loaded'
import { unwrap } from '../queries/results'
import { usePorts } from '../runtime/context'
import { byName } from '../roster/roster'
import { useToday } from '../session/today'

// "איתך היום" (D-478): who of the actor's own unit is on base today, by name. The server answers the names; nothing
// here reads a leave.

/** The names in Hebrew order (D-094). */
export function presentByName(answer: PresenceWithMe): readonly PresentSoldier[] {
  return answer.soldiers.toSorted(byName)
}

/**
 * Who is on base with the actor today, for who holds `presence:view` on themself; NULL for anyone else, for a holder
 * with no unit today, and for an answer about another day than the screen's (D-479): the server answers in the
 * organization's zone, and a screen that cannot read the organization counts days in the device's (D-160). Asked
 * again on a new day.
 */
export function usePresentWithMe(): Loaded<readonly PresentSoldier[] | null> {
  const { data } = usePorts()
  const actor = useActor()
  const today = useToday()
  const checks = useMemo(() => (actor === null ? [] : [checkOn(PRESENCE_VIEW, actor.soldier_id)]), [actor])
  const answers = useCanAnswers(checks)
  const [check] = checks
  const holds = check !== undefined && answers.known(check) && answers.can(check)
  const query = useQuery({
    queryKey: [...QUERY_KEYS.presentWithMe, today],
    queryFn: () => unwrap(data.repositories.soldiers.presentWithMe()),
    enabled: holds && today !== null,
  })
  const answer = loaded(query)
  return useMemo((): Loaded<readonly PresentSoldier[] | null> => {
    if (check === undefined) return { status: 'ready', value: null }
    if (!answers.known(check)) return { status: 'loading' }
    if (!holds) return { status: 'ready', value: null }
    if (answer.status !== 'ready') return answer
    if (answer.value === null || answer.value.date !== today) return { status: 'ready', value: null }
    return { status: 'ready', value: presentByName(answer.value) }
  }, [check, answers, holds, answer, today])
}
