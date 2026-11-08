import type { Session } from '@contracts'
import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { QUERY_KEYS, createQueryClient, forgetIdentityData, invalidateChanged } from '../queries/client'
import type { LogicPorts } from '../ports'
import { PortsContext } from './context'

function authUserOf(session: Session | undefined): string | null {
  return session === undefined || session.status === 'signed_out' ? null : session.identity.auth_user_id
}

/** Connects the ports to the query cache: one live source of truth across views and tabs. */
export function LogicProvider({ ports, children }: { ports: LogicPorts; children: ReactNode }) {
  const [client] = useState(createQueryClient)

  useEffect(() => {
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
    }
  }, [client, ports])

  return (
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PortsContext.Provider>
  )
}
