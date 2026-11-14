import { SEARCH_PARAMS, type SearchParamName, type ViewId } from '@config'
import { IssueCode, SavedView, SavedViewParam, type SavedViewId, type SavedViewQuery } from '@contracts'
import { formIssues } from '../forms/issues'
import { hasLeaveConditions } from './conditions'
import { readRules } from './filter'
import { WorkspaceSearch } from './search'

// A saved view is the board's state as a link would hold it, without its day (D-384): each kept param's value,
// serialized. Applying it goes through `WorkspaceSearch`, the one parser of the URL (D-023, D-385).

const PARAM_OF = {
  view: SEARCH_PARAMS.view,
  filter: SEARCH_PARAMS.filter,
  sorts: SEARCH_PARAMS.sorts,
  sort: SEARCH_PARAMS.sort,
  order: SEARCH_PARAMS.order,
  leaves: SEARCH_PARAMS.leaves,
  missing: SEARCH_PARAMS.missing,
  colors: SEARCH_PARAMS.colors,
  range: SEARCH_PARAMS.range,
} as const satisfies Record<SavedViewParam, SearchParamName>

/** The table's own sort is kept only with the table (D-384). */
const TABLE_ONLY: readonly SavedViewParam[] = [SavedViewParam.enum.sort, SavedViewParam.enum.order]
const TABLE: ViewId = 'table'

/** The view-state params a saved view does not keep: applying one clears them, so nothing of the board before it stays (D-385). */
const ANCHORS = [SEARCH_PARAMS.from, SEARCH_PARAMS.to, SEARCH_PARAMS.rotation] as const satisfies readonly SearchParamName[]
const CLEARED: Partial<Record<SearchParamName, undefined>> = Object.fromEntries(
  [...ANCHORS, ...Object.values(PARAM_OF)].map((name) => [name, undefined]),
)

function kept(param: SavedViewParam, view: ViewId | undefined): boolean {
  return !TABLE_ONLY.includes(param) || view === TABLE
}

/** The board's state as a saved view keeps it: `view` is the view shown, the device's default included. */
export function captureView(search: WorkspaceSearch, view: ViewId): SavedViewQuery {
  const query: SavedViewQuery = {}
  for (const param of SavedViewParam.options) {
    const value = param === SavedViewParam.enum.view ? view : search[PARAM_OF[param]]
    if (value !== undefined && kept(param, view)) query[param] = JSON.stringify(value)
  }
  return query
}

function parsedValue(raw: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    const value: unknown = JSON.parse(raw)
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}

export interface AppliedView {
  /** The board's whole view state: the view's params, everything else absent. */
  readonly search: WorkspaceSearch
  /** TRUE when a stored part no longer reads and was left out (D-385). */
  readonly dropped: boolean
  /** The view's query without the parts that were left out, to save it so. */
  readonly cleaned: SavedViewQuery
}

/** The board state a saved view opens on (D-385). */
export function applyView(query: SavedViewQuery): AppliedView {
  const raw: Partial<Record<SearchParamName, unknown>> = {}
  let dropped = false
  for (const param of SavedViewParam.options) {
    const stored = query[param]
    if (stored === undefined) continue
    const parsed = parsedValue(stored)
    if (parsed.ok) raw[PARAM_OF[param]] = parsed.value
    else dropped = true
  }
  const read = WorkspaceSearch.parse(raw)
  const search: Partial<Record<SearchParamName, unknown>> = {}
  const cleaned: SavedViewQuery = {}
  for (const param of SavedViewParam.options) {
    const name = PARAM_OF[param]
    if (!(name in raw)) continue
    const value = read[name]
    if (value === undefined || !kept(param, read.view)) {
      dropped = true
      continue
    }
    search[name] = value
    cleaned[param] = JSON.stringify(value)
  }
  return { search: { ...CLEARED, ...WorkspaceSearch.parse(search) }, dropped, cleaned }
}

/** One serialization of a value, whatever the order of its keys. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  )
}

function keyOf(query: SavedViewQuery): string {
  return canonical(applyView(query).cleaned)
}

/** The saved view the board shows now, if any (D-385): compared as parsed values, so `from` and order never matter. */
export function matchingView(views: readonly SavedView[], search: WorkspaceSearch, view: ViewId): SavedView | null {
  const current = keyOf(captureView(search, view))
  return views.find((saved) => keyOf(saved.query) === current) ?? null
}

/** What a saved view's card says of it: its range kind and how many conditions it holds (D-387). */
export function savedViewSummary(query: SavedViewQuery): { readonly range: WorkspaceSearch['range']; readonly conditions: number } {
  const { search } = applyView(query)
  const rules = readRules(search.filter ?? null)
  const filterConditions = rules.kind === 'rules' ? rules.filter.rules.length : 1
  const leaveConditions = search.leaves === undefined || !hasLeaveConditions(search.leaves) ? 0 : 1
  return { range: search.range, conditions: filterConditions + leaveConditions + (search.missing === true ? 1 : 0) }
}

/** What is wrong with a name for a saved view, or NULL (D-384): the codes the adapter answers, before it is asked. */
export function savedViewNameIssue(views: readonly SavedView[], name: string, except: SavedViewId | null): IssueCode | null {
  const issue = formIssues(SavedView.shape.name, name)[0]
  if (issue !== undefined) return issue.code
  const trimmed = name.trim()
  return views.some((view) => view.id !== except && view.name === trimmed) ? IssueCode.enum.duplicate_item : null
}
