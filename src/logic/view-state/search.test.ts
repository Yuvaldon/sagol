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

describe('a link to the old pending tab (D-474)', () => {
  it('is read as the page of requests, and names no panel', () => {
    expect(WorkspaceSearch.parse({ panel: 'leave_inbox' })).toEqual({ page: 'requests' })
    expect(WorkspaceSearch.parse({ panel: 'leave_inbox', view: 'table' })).toEqual({ page: 'requests', view: 'table' })
  })

  it('leaves every other panel as it is', () => {
    expect(WorkspaceSearch.parse({ panel: 'leave_closed' })).toEqual({ panel: 'leave_closed' })
    expect(WorkspaceSearch.parse({ panel: 'nothing' })).toEqual({})
  })
})

describe('the sort in the URL (OI-264)', () => {
  const parse = (search: Record<string, unknown>) => WorkspaceSearch.parse(search)
  it('keeps a leave column of the table', () => {
    expect(parse({ [SEARCH_PARAMS.sort]: 'days', [SEARCH_PARAMS.order]: 'desc' })).toMatchObject({ sort: 'days', order: 'desc' })
  })
  it('reads a board key from before D-313 as the sort rules', () => {
    const read = parse({ [SEARCH_PARAMS.sort]: 'name' })
    expect(read.sorts).toEqual([{ key: 'name', order: 'asc' }])
    expect(read.sort).toBeUndefined()
    expect(parse({ [SEARCH_PARAMS.sort]: 'rank', [SEARCH_PARAMS.order]: 'asc' }).sorts).toEqual([{ key: 'rank', order: 'asc' }])
  })
  it('leaves the default order out, and lets the sort rules win', () => {
    expect(parse({ [SEARCH_PARAMS.sort]: 'seniority' }).sorts).toBeUndefined()
    const both = parse({ [SEARCH_PARAMS.sort]: 'name', [SEARCH_PARAMS.sorts]: [{ key: 'unit', order: 'asc' }] })
    expect(both.sorts).toEqual([{ key: 'unit', order: 'asc' }])
    expect(both.sort).toBeUndefined()
  })
})
