import { createContext, useContext } from 'react'
import type { LogicPorts } from '../ports'

export const PortsContext = createContext<LogicPorts | null>(null)

/** The ports `app` provided. A hook used outside `LogicProvider` is a programming error. */
export function usePorts(): LogicPorts {
  const ports = useContext(PortsContext)
  if (ports === null) throw new Error('logic/provider_missing')
  return ports
}
