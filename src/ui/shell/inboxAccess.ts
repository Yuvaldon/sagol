import { useGrantModuleAccess, useLeaveCreation, useSoldiers } from '@logic'

const NO_SOLDIERS: readonly never[] = []

/**
 * Whether the requests inbox is for this actor: who may approve at least one soldier they see other than themselves
 * (D-120, D-299). A hint: what is inside is filtered again.
 */
export function useInboxAccess(): boolean {
  const soldiers = useSoldiers()
  return useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS).approvesOthers
}

/** Whether the grants module is for this actor: who may view the grants of at least one soldier they see (D-165). */
export function useGrantsAccess(): boolean {
  const soldiers = useSoldiers()
  return useGrantModuleAccess(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
}
