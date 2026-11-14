import { SEARCH_PARAMS } from '@config'
import { SavedView, type SavedViewQuery } from '@contracts'
import { describe, expect, it } from 'vitest'
import { applyView, captureView, matchingView, savedViewSummary } from './savedViews'
import { WorkspaceSearch } from './search'

// Sample values, test data only.
// TAG stands for a tag since archived: nothing here knows, as nothing reading a link does.
const TAG = '00000000-0000-4000-8000-000000000001'
const ROTATION = '00000000-0000-4000-8000-000000000003'
const TAG_FILTER = { where: { kind: 'tag', match: 'any', tag_ids: [TAG] } }

const board = (search: Record<string, unknown>) => WorkspaceSearch.parse(search)
const saved = (name: string, query: SavedViewQuery) =>
  SavedView.parse({ id: `0a1b2c3d-2222-4aaa-8aaa-${String(name.length).padStart(12, '0')}`, name, query })

describe('captureView (D-384)', () => {
  it('keeps the view state and never a day, a rotation or a panel', () => {
    const query = captureView(
      board({
        [SEARCH_PARAMS.filter]: TAG_FILTER,
        [SEARCH_PARAMS.range]: 'week',
        [SEARCH_PARAMS.from]: '2026-11-01',
        [SEARCH_PARAMS.rotation]: ROTATION,
        [SEARCH_PARAMS.missing]: true,
        [SEARCH_PARAMS.panel]: 'presence',
      }),
      'list',
    )
    expect(Object.keys(query).sort()).toEqual(['filter', 'missing', 'range', 'view'])
    expect(query.view).toBe(JSON.stringify('list'))
  })
  it('keeps the table sort only with the table', () => {
    const search = board({ [SEARCH_PARAMS.sort]: 'days', [SEARCH_PARAMS.order]: 'desc' })
    expect(captureView(search, 'table')).toMatchObject({ sort: '"days"', order: '"desc"' })
    expect(captureView(search, 'timeline').sort).toBeUndefined()
  })
})

describe('applyView (D-385)', () => {
  it('round-trips with captureView and clears every other view-state param', () => {
    const search = board({ [SEARCH_PARAMS.filter]: TAG_FILTER, [SEARCH_PARAMS.range]: 'month', [SEARCH_PARAMS.sorts]: [{ key: 'unit', order: 'asc' }] })
    const applied = applyView(captureView(search, 'calendar'))
    expect(applied.dropped).toBe(false)
    expect(applied.search).toMatchObject({ view: 'calendar', range: 'month', filter: TAG_FILTER, sorts: [{ key: 'unit', order: 'asc' }] })
    for (const name of [SEARCH_PARAMS.from, SEARCH_PARAMS.to, SEARCH_PARAMS.rotation, SEARCH_PARAMS.missing, SEARCH_PARAMS.colors]) {
      expect(name in applied.search).toBe(true)
      expect(applied.search[name]).toBeUndefined()
    }
  })
  it('drops a value that no longer reads, and says so', () => {
    const applied = applyView({ view: '"list"', range: '"fortnight-ish"', missing: 'not json' })
    expect(applied.dropped).toBe(true)
    expect(applied.cleaned).toEqual({ view: '"list"' })
    expect(applied.search.range).toBeUndefined()
  })
  it('keeps a rule that names something archived: the board shows it like a link (D-326)', () => {
    expect(applyView({ filter: JSON.stringify(TAG_FILTER) }).dropped).toBe(false)
  })
  it('drops the table sort stored with another view', () => {
    expect(applyView({ view: '"list"', sort: '"days"' })).toMatchObject({ dropped: true, cleaned: { view: '"list"' } })
  })
})

describe('matchingView (D-385)', () => {
  const morning = saved('morning', { view: '"list"', filter: JSON.stringify(TAG_FILTER), range: '"week"' })
  it('finds the view the board shows, whatever the day and the order of keys', () => {
    const search = board({ [SEARCH_PARAMS.range]: 'week', [SEARCH_PARAMS.from]: '2026-11-09', [SEARCH_PARAMS.filter]: TAG_FILTER })
    expect(matchingView([morning], search, 'list')).toBe(morning)
    const reordered = saved('reordered', { range: '"week"', filter: '{"where":{"tag_ids":["' + TAG + '"],"match":"any","kind":"tag"}}', view: '"list"' })
    expect(matchingView([reordered], search, 'list')).toBe(reordered)
  })
  it('finds nothing once a condition or the view changes', () => {
    const search = board({ [SEARCH_PARAMS.range]: 'week', [SEARCH_PARAMS.filter]: TAG_FILTER })
    expect(matchingView([morning], { ...search, missing: true }, 'list')).toBeNull()
    expect(matchingView([morning], search, 'timeline')).toBeNull()
  })
})

describe('savedViewSummary (D-387)', () => {
  it('counts the rules and the board conditions', () => {
    expect(savedViewSummary({ view: '"list"' })).toEqual({ range: undefined, conditions: 0 })
    expect(savedViewSummary({ filter: JSON.stringify(TAG_FILTER), missing: 'true', range: '"week"' })).toEqual({ range: 'week', conditions: 2 })
  })
})
