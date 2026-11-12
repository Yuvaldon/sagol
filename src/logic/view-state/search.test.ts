import { NEW_ENTITY, QUICK_ENTRY, SEARCH_PARAMS } from '@config'
import { describe, expect, it } from 'vitest'
import { WorkspaceSearch } from './search'

// Sample values, test data only.
const ROW = '00000000-0000-4000-8000-000000000001'

describe('the entity in the URL', () => {
  it('keeps a row, a new form and the quick entry, and drops anything else', () => {
    const entityOf = (value: string) => WorkspaceSearch.parse({ [SEARCH_PARAMS.entity]: value })[SEARCH_PARAMS.entity]
    expect(entityOf(ROW)).toBe(ROW)
    expect(entityOf(NEW_ENTITY)).toBe(NEW_ENTITY)
    expect(entityOf(QUICK_ENTRY)).toBe(QUICK_ENTRY)
    expect(entityOf('anything')).toBeUndefined()
  })
})
