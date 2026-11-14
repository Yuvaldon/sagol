import type { Session } from '@contracts'
import { QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { QUERY_KEYS, createQueryClient, forgetIdentityData, invalidateChanged } from '../queries/client'
import type { LogicPorts } from '../ports'
import { resendThisDevice } from '../shell/push'
import { PortsContext } from './context'

function authUserOf(session: Session | undefined): string | null {
  return session === undefined || session.status === 'signed_out' ? null : session.identity.auth_user_id
}

function linkedUserOf(session: Session): string | null {
  return session.status === 'linked' ? session.identity.auth_user_id : null
}

/** Connects the ports to the query cache: one live source of truth across views and tabs. */
export function LogicProvider({ ports, children }: { ports: LogicPorts; children: ReactNode }) {
  const [client] = useState(createQueryClient)

  useEffect(() => {
    // Once per linked sign-in, the browser's install is sent again (D-434): the session is read wherever it comes from,
    // the start's read or a later change. The observer never asks for it itself.
    let resentFor: string | null = null
    const sessions = new QueryObserver<Session>(client, { queryKey: QUERY_KEYS.session, enabled: false })
    const stopResend = sessions.subscribe(({ data }) => {
      const linked = data === undefined ? null : linkedUserOf(data)
      if (linked !== null && linked !== resentFor) void resendThisDevice(ports.push, ports.data)
      resentFor = linked
    })
    const stopChanges = ports.data.changes.subscribe((changes) => {
      invalidateChanged(client, changes)
    })
    const stopSession = ports.data.session.subscribe((session) => {
      const previous = client.getQueryData<Session>(QUERY_KEYS.session)
      if (authUserOf(previous) !== authUserOf(session)) forgetIdentityData(client)
      client.setQueryData(QUERY_KEYS.session, session)
      void client.invalidateQueries({ queryKey: QUERY_KEYS.identities })
      void client.invalidateQueries({ queryKey: QUERY_KEYS.onboarding })
    })
    return () => {
      stopChanges()
      stopSession()
      stopResend()
    }
  }, [client, ports])

  return (
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PortsContext.Provider>
  )
}
