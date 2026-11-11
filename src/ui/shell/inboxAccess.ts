import { useGrantModuleAccess, useLeaveCreation, useSoldiers } from '@logic'

const NO_SOLDIERS: readonly never[] = []

/**
 * Whether the requests inbox, and the "approve now" default, are for this actor: who may approve at least one
 * soldier they see (D-120, D-121). A hint: what is inside is filtered again.
 */
export function useInboxAccess(): boolean {
  const soldiers = useSoldiers()
  return useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS).approvesAny
}

/** Whether the grants module is for this actor: who may view the grants of at least one soldier they see (D-165). */
export function useGrantsAccess(): boolean {
  const soldiers = useSoldiers()
  return useGrantModuleAccess(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
}
