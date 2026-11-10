import type { Permission, PermissionCheck, PolicyTarget, SoldierId } from '@contracts'
import { soldierTarget } from '@domain'

// The "can I?" questions the hooks ask (D-091), built one way everywhere.

export function checkOf(permission: Permission, target: PolicyTarget): PermissionCheck {
  return { permission, target }
}

/** A permission over one soldier (D-053). */
export function checkOn(permission: Permission, soldierId: SoldierId): PermissionCheck {
  return checkOf(permission, soldierTarget(soldierId))
}
