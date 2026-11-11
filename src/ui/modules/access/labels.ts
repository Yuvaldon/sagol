import type { PermissionAction, PermissionResource, ScopeAnchorType, SubjectRankConstraint } from '@contracts'
import type { I18nKey } from '@i18n'
import type { GrantState } from '@logic'

// The names of the access vocabularies, written out so every key is checked (check-i18n).

export const RESOURCE_KEYS: Record<PermissionResource, I18nKey> = {
  organization: 'permissionLabels.resources.organization',
  unit_levels: 'permissionLabels.resources.unit_levels',
  units: 'permissionLabels.resources.units',
  command_ranks: 'permissionLabels.resources.command_ranks',
  seniority_overrides: 'permissionLabels.resources.seniority_overrides',
  soldiers: 'permissionLabels.resources.soldiers',
  soldier_private: 'permissionLabels.resources.soldier_private',
  memberships: 'permissionLabels.resources.memberships',
  tags: 'permissionLabels.resources.tags',
  leave_types: 'permissionLabels.resources.leave_types',
  leaves: 'permissionLabels.resources.leaves',
  leave_comments: 'permissionLabels.resources.leave_comments',
  internal_comments: 'permissionLabels.resources.internal_comments',
  deployments: 'permissionLabels.resources.deployments',
  availability_rules: 'permissionLabels.resources.availability_rules',
  properties: 'permissionLabels.resources.properties',
  roles: 'permissionLabels.resources.roles',
  access_grants: 'permissionLabels.resources.access_grants',
  accounts: 'permissionLabels.resources.accounts',
  data_transfer: 'permissionLabels.resources.data_transfer',
}

export const ACTION_KEYS: Record<PermissionAction, I18nKey> = {
  view: 'permissionLabels.actions.view',
  create: 'permissionLabels.actions.create',
  update: 'permissionLabels.actions.update',
  delete: 'permissionLabels.actions.delete',
  duplicate: 'permissionLabels.actions.duplicate',
  approve: 'permissionLabels.actions.approve',
  export: 'permissionLabels.actions.export',
  import: 'permissionLabels.actions.import',
}

export const ANCHOR_KEYS: Record<ScopeAnchorType, I18nKey> = {
  self: 'scope.anchors.self',
  organization: 'scope.anchors.organization',
  unit: 'scope.anchors.unit',
  soldier: 'scope.anchors.soldier',
  home_unit: 'scope.anchors.home_unit',
  home_ancestor_at_level: 'scope.anchors.home_ancestor_at_level',
  home_ancestor_steps: 'scope.anchors.home_ancestor_steps',
}

export const RANK_CONSTRAINT_KEYS: Record<SubjectRankConstraint, I18nKey> = {
  any: 'scope.ranks.any',
  junior: 'scope.ranks.junior',
  junior_or_equal: 'scope.ranks.junior_or_equal',
}

export const GRANT_STATE_KEYS: Record<GrantState, I18nKey> = {
  active: 'grants.states.active',
  scheduled: 'grants.states.scheduled',
  expired: 'grants.states.expired',
  revoked: 'grants.states.revoked',
}
