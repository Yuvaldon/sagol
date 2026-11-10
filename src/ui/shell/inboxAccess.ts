import { useLeaveCreation, useSoldiers } from '@logic'

const NO_SOLDIERS: readonly never[] = []

/**
 * Whether the requests inbox, and the "approve now" default, are for this actor: who may approve at least one
 * soldier they see (D-120, D-121). A hint: what is inside is filtered again.
 */
export function useInboxAccess(): boolean {
  const soldiers = useSoldiers()
  return useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS).approvesAny
}
