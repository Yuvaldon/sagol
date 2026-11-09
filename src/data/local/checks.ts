import type Dexie from 'dexie'
import { isIconKey, isPaletteKey } from '@config'
import { IssueCode, type Issue, type PropertyEntityType, type PropertyValues } from '@contracts'
import { propertyValueIssues } from '@domain'
import { tableOf } from './database'
import { parsedRow } from './failure'
import type { ActorScope } from './actor'

// Row checks that several tables share. Paths are relative to the row.

/** A new `color_key` must be in the closed palette (D-074, OI-011). */
export function colorKeyIssues(before: string | null | undefined, after: string | null): Issue[] {
  if (after === null || after === before || isPaletteKey(after)) return []
  return [{ path: ['color_key'], code: IssueCode.enum.invalid_value }]
}

/** A new `icon_key` must be in the closed list (D-113), as a color key is. */
export function iconKeyIssues(before: string | null | undefined, after: string | null): Issue[] {
  if (after === null || after === before || isIconKey(after)) return []
  return [{ path: ['icon_key'], code: IssueCode.enum.invalid_value }]
}

/** Custom property values against their definitions (D-065, OI-023 b). */
export async function propertiesIssues(
  database: Dexie,
  scope: ActorScope,
  entityType: PropertyEntityType,
  before: PropertyValues | null,
  after: PropertyValues,
): Promise<Issue[]> {
  const stored = await tableOf(database, 'property_definitions')
    .where('organization_id')
    .equals(scope.organization_id)
    .toArray()
  const definitions = stored.map((row) => parsedRow('property_definitions', row))
  return propertyValueIssues(definitions, { entity_type: entityType, before, after })
}
