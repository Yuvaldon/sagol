import { z } from 'zod'

// Closed vocabularies that code branches on. Each mirrors a CHECK list in
// docs/schema.sql (checked by the drift test). Anything users name, order or color is a
// row, never an enum.

export const UnitKind = z.enum(['standing', 'temporary'])
export type UnitKind = z.infer<typeof UnitKind>

export const SoldierStatus = z.enum(['active', 'inactive'])
export type SoldierStatus = z.infer<typeof SoldierStatus>

export const MembershipType = z.enum(['primary', 'attached'])
export type MembershipType = z.infer<typeof MembershipType>

/** `soldier_accounts.provider`. */
export const IdentityProvider = z.enum(['google', 'local'])
export type IdentityProvider = z.infer<typeof IdentityProvider>

export const AccountLinkRequestStatus = z.enum(['pending', 'approved', 'rejected', 'cancelled'])
export type AccountLinkRequestStatus = z.infer<typeof AccountLinkRequestStatus>

/** Scope anchor of rank bindings and access grants (D-028). */
export const ScopeAnchorType = z.enum([
  'self',
  'organization',
  'home_unit',
  'home_ancestor_steps',
  'home_ancestor_at_level',
  'unit',
  'soldier',
])
export type ScopeAnchorType = z.infer<typeof ScopeAnchorType>

/** Anchors whose scope is a unit, so `include_descendants` may be set. */
export const UNIT_SCOPE_ANCHORS = [
  'home_unit',
  'home_ancestor_steps',
  'home_ancestor_at_level',
  'unit',
] as const satisfies readonly ScopeAnchorType[]

/** Compares the subject's EFFECTIVE seniority with the actor's (D-029). */
export const SubjectRankConstraint = z.enum(['any', 'junior', 'junior_or_equal'])
export type SubjectRankConstraint = z.infer<typeof SubjectRankConstraint>

export const TagSelectionMode = z.enum(['single', 'multiple'])
export type TagSelectionMode = z.infer<typeof TagSelectionMode>

/** How long a tag assignment holds: always, or for one rotation (D-260). */
export const TagLifetime = z.enum(['persistent', 'rotation'])
export type TagLifetime = z.infer<typeof TagLifetime>

export const AvailabilityEffect = z.enum(['unavailable', 'available'])
export type AvailabilityEffect = z.infer<typeof AvailabilityEffect>

export const LeaveStatus = z.enum(['pending', 'approved', 'rejected', 'cancelled'])
export type LeaveStatus = z.infer<typeof LeaveStatus>

export const LeaveEventType = z.enum([
  'created',
  'updated',
  'rescheduled',
  'approved',
  'rejected',
  'cancelled',
  'reopened',
])
export type LeaveEventType = z.infer<typeof LeaveEventType>

export const CommentVisibility = z.enum(['shared', 'internal'])
export type CommentVisibility = z.infer<typeof CommentVisibility>

export const RuleEnforcement = z.enum(['soft', 'hard'])
export type RuleEnforcement = z.infer<typeof RuleEnforcement>

export const RuleScopeMode = z.enum(['unit_tree', 'each_child', 'each_descendant_at_level'])
export type RuleScopeMode = z.infer<typeof RuleScopeMode>

export const RuleGroupBy = z.enum(['none', 'tag', 'command_rank'])
export type RuleGroupBy = z.infer<typeof RuleGroupBy>

export const RuleMetric = z.enum(['count', 'percent'])
export type RuleMetric = z.infer<typeof RuleMetric>

export const PropertyEntityType = z.enum(['soldier', 'unit', 'leave'])
export type PropertyEntityType = z.infer<typeof PropertyEntityType>

export const PropertyDataType = z.enum([
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multi_select',
  'soldier_ref',
  'unit_ref',
])
export type PropertyDataType = z.infer<typeof PropertyDataType>

/** Organization setting: what happens when an approved leave is moved (D-013, D-041). */
export const ReschedulePolicy = z.enum(['keep_if_can_approve', 'always_pending'])
export type ReschedulePolicy = z.infer<typeof ReschedulePolicy>

/** A module of the navigation panel that a soldier may pin to the bar (D-173). */
export const NavigationModule = z.enum([
  'units',
  'soldiers',
  'leave_types',
  'rules',
  'deployments',
  'tags',
  'properties',
  'roles',
  'access_grants',
  'account_links',
  'data_transfer',
])
export type NavigationModule = z.infer<typeof NavigationModule>

/** The color scheme the soldier chose: light (the default), dark, or the device's (D-181). */
export const Appearance = z.enum(['light', 'dark', 'system'])
export type Appearance = z.infer<typeof Appearance>
