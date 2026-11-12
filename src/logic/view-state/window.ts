import { DATE_WINDOW, DEFAULT_RANGE_KIND, FIRST_DAY_OF_WEEK, type RangeKind } from '@config'
import type { CalendarDate, Deployment, DeploymentId, Unit, UnitId } from '@contracts'
import {
  addDays,
  addMonths,
  ancestorsOf,
  buildUnitTree,
  compareDates,
  daysBetween,
  descendantsOf,
  eachDay,
  endOfMonth,
  startOfMonth,
  startOfWeek,
} from '@domain'
import { useCallback, useMemo } from 'react'
import { isDeploymentActive, liveDeployments } from '../deployments/deployments'
import { useDeployments } from '../deployments/hooks'
import { useUnits } from '../units/hooks'
import { useToday } from '../session/today'
import { filterUnitOf } from './filter'
import { useChangeSearch, useWorkspaceSearch } from './search'

// The date window of the views (D-103, D-211, D-217). Its kind lives in the URL: a day, a week, a month or a whole
// rotation, anchored on `from`; without `from` a day, a week or a month holds today and follows the clock. An older
// link's `from`..`to` with no kind is a free window. A URL with none of them opens on the rotation in scope that runs
// today, else the next one, else today's week. Pure parts first, then the hook.

/** A window's kind: one the range picker offers, or a free window from an older link. */
export type WindowKind = RangeKind | 'custom'

export interface DateWindow {
  readonly kind: WindowKind
  readonly from: CalendarDate
  readonly to: CalendarDate
  /** Every day of the window, in order. */
  readonly days: readonly CalendarDate[]
  /** The rotation a `rotation` window shows. NULL otherwise. */
  readonly rotationId: DeploymentId | null
  /** True when the URL holds no anchor, so the window moves with today. */
  readonly followsToday: boolean
  readonly holdsToday: boolean
}

/** What a rotation window reads of a deployment. */
export type RotationSpan = Pick<Deployment, 'id' | 'start_date' | 'end_date'>

export interface WindowParams {
  readonly from?: CalendarDate | undefined
  readonly to?: CalendarDate | undefined
  readonly range?: RangeKind | undefined
  readonly rotation?: DeploymentId | undefined
}

/** A free pair from an older link, or NULL when it is missing a side, inverted or too long. */
function linkedWindow({ from, to }: WindowParams): { from: CalendarDate; to: CalendarDate } | null {
  if (from === undefined || to === undefined) return null
  const span = daysBetween(from, to) + 1
  return span >= 1 && span <= DATE_WINDOW.maxDays ? { from, to } : null
}

/** A rotation's days, its first `maxDays` when it is longer or has no end yet (D-211). */
export function rotationDays(rotation: Pick<RotationSpan, 'start_date' | 'end_date'>): { from: CalendarDate; to: CalendarDate } {
  const cap = addDays(rotation.start_date, DATE_WINDOW.maxDays - 1)
  const end = rotation.end_date === null || compareDates(rotation.end_date, cap) > 0 ? cap : rotation.end_date
  return { from: rotation.start_date, to: end }
}

function spanOf(kind: Exclude<RangeKind, 'rotation'>, anchor: CalendarDate): { from: CalendarDate; to: CalendarDate } {
  switch (kind) {
    case 'day':
      return { from: anchor, to: anchor }
    case 'week': {
      const from = startOfWeek(anchor, FIRST_DAY_OF_WEEK)
      return { from, to: addDays(from, DATE_WINDOW.days - 1) }
    }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
  }
}

function windowOf(
  kind: WindowKind,
  span: { from: CalendarDate; to: CalendarDate },
  today: CalendarDate,
  followsToday: boolean,
  rotationId: DeploymentId | null = null,
): DateWindow {
  return {
    kind,
    ...span,
    days: eachDay({ start_date: span.from, end_date: span.to }),
    rotationId,
    followsToday,
    holdsToday: daysBetween(span.from, today) >= 0 && daysBetween(today, span.to) >= 0,
  }
}

// Track A's V22 reads a date against the rotation in scope with `rotationOn` and `scopeRotation`.

/** The first rotation, by start, whose dates hold `date`; NULL when none does. */
export function rotationOn<Rotation extends Pick<Deployment, 'start_date' | 'end_date'>>(
  rotations: readonly Rotation[],
  date: CalendarDate,
): Rotation | null {
  return rotations.find((rotation) => isDeploymentActive(rotation, date)) ?? null
}

/** The rotation that runs today, else the next one to start (D-217). `rotations` are by start. */
export function scopeRotation<Rotation extends Pick<Deployment, 'start_date' | 'end_date'>>(
  rotations: readonly Rotation[],
  today: CalendarDate,
): Rotation | null {
  return rotationOn(rotations, today) ?? rotations.find((rotation) => compareDates(rotation.start_date, today) > 0) ?? null
}

/** Whether a URL names no window at all, so the workspace opens on its rotation (D-217). */
function isBareWindow(params: WindowParams): boolean {
  return params.range === undefined && params.from === undefined && params.to === undefined
}

/**
 * The window a URL asks for. A rotation the actor does not see, or one that is gone, falls back to the week of the
 * anchor, so a link never breaks the workspace (D-023). `rotations` are the live ones in scope, by start.
 */
export function dateWindowOf(params: WindowParams, today: CalendarDate, rotations: readonly RotationSpan[] = []): DateWindow {
  if (params.range === 'rotation') {
    const rotation = rotations.find((candidate) => candidate.id === params.rotation)
    if (rotation !== undefined) return windowOf('rotation', rotationDays(rotation), today, false, rotation.id)
  }
  if (isBareWindow(params)) {
    const rotation = scopeRotation(rotations, today)
    if (rotation !== null) return windowOf('rotation', rotationDays(rotation), today, false, rotation.id)
  }
  if (params.range === undefined) {
    const linked = linkedWindow(params)
    if (linked !== null) return windowOf('custom', linked, today, false)
  }
  const kind = params.range === undefined || params.range === 'rotation' ? DEFAULT_RANGE_KIND : params.range
  return windowOf(kind, spanOf(kind, params.from ?? today), today, params.from === undefined)
}

/** The window moved by its own length, back (-1) or forward (1). */
export function shiftedWindow(window: Pick<DateWindow, 'from' | 'to'>, step: -1 | 1): { from: CalendarDate; to: CalendarDate } {
  const length = (daysBetween(window.from, window.to) + 1) * step
  return { from: addDays(window.from, length), to: addDays(window.to, length) }
}

/** The anchor one step away for a day, a week or a month (D-211). */
export function shiftedAnchor(kind: Exclude<RangeKind, 'rotation'>, from: CalendarDate, step: -1 | 1): CalendarDate {
  switch (kind) {
    case 'day':
      return addDays(from, step)
    case 'week':
      return addDays(from, DATE_WINDOW.days * step)
    case 'month':
      return addMonths(startOfMonth(from), step)
  }
}

/**
 * The live rotations of the selected unit, of the units above it and of those below it, by start (D-211): what the
 * soldiers in view take part in. With the whole organization in view, every live rotation.
 */
export function scopeRotations(
  deployments: readonly Deployment[],
  units: readonly Pick<Unit, 'id' | 'parent_id' | 'unit_level_id'>[],
  scopeUnitId: UnitId | null,
): Deployment[] {
  const live = liveDeployments(deployments)
  const related =
    scopeUnitId === null
      ? null
      : (() => {
          const tree = buildUnitTree(units)
          return new Set<UnitId>([scopeUnitId, ...ancestorsOf(tree, scopeUnitId), ...descendantsOf(tree, scopeUnitId)])
        })()
  return live
    .filter((deployment) => related === null || related.has(deployment.unit_id))
    .sort((a, b) => compareDates(a.start_date, b.start_date) || a.name.localeCompare(b.name))
}

/** The rotations the range picker offers: those running or still to come (D-211). */
export function pickableRotations(rotations: readonly Deployment[], today: CalendarDate): Deployment[] {
  return rotations.filter((rotation) => rotation.end_date === null || compareDates(rotation.end_date, today) >= 0)
}

export interface DateWindowState {
  /** NULL until today is known: no organization yet, or no `organization:view`; or while a rotation loads. */
  readonly window: DateWindow | null
  readonly today: CalendarDate | null
  /** The live rotations in scope, by start (D-211). */
  readonly rotations: readonly Deployment[]
  /** False while the rotations load: until then `rotations` is empty. */
  readonly rotationsReady: boolean
  /** Whether a step back (-1) or forward (1) leads anywhere: a rotation window stops at the first and last. */
  canShift(step: -1 | 1): boolean
  shift(step: -1 | 1): void
  /** Today: the same kind on today, or the rotation that runs today, else this week (D-211). */
  goToToday(): void
  /** Another kind on the same days: a rotation by its id (D-211). */
  setRange(kind: Exclude<RangeKind, 'rotation'>): void
  showRotation(rotationId: DeploymentId): void
}

const NO_ROTATIONS: readonly Deployment[] = []

export function useDateWindow(): DateWindowState {
  const search = useWorkspaceSearch()
  const change = useChangeSearch()
  const today = useToday()
  const deployments = useDeployments()
  const units = useUnits()
  const { from, to, range, rotation, filter } = search
  const scope = filterUnitOf(filter ?? null)
  const scopeUnitId = scope.kind === 'unit' ? scope.unitId : null
  const rotations = useMemo(
    () =>
      deployments.status === 'ready' && units.status === 'ready'
        ? scopeRotations(deployments.value, units.value, scopeUnitId)
        : NO_ROTATIONS,
    [deployments, units, scopeUnitId],
  )
  // A rotation link, and a bare one that opens on the rotation, wait for the rotations, so they do not show a week first.
  const rotationsReady = deployments.status !== 'loading' && units.status !== 'loading'
  const waiting = (range === 'rotation' || isBareWindow({ from, to, range })) && !rotationsReady
  const window = useMemo(
    () => (today === null || waiting ? null : dateWindowOf({ from, to, range, rotation }, today, rotations)),
    [from, to, range, rotation, today, rotations, waiting],
  )
  const rotationIndex = window?.kind === 'rotation' ? rotations.findIndex((candidate) => candidate.id === window.rotationId) : -1

  const canShift = useCallback(
    (step: -1 | 1) => {
      if (window === null) return false
      if (window.kind !== 'rotation') return true
      return rotations[rotationIndex + step] !== undefined
    },
    [window, rotations, rotationIndex],
  )
  const shift = useCallback(
    (step: -1 | 1) => {
      if (window === null) return
      if (window.kind === 'custom') {
        change(shiftedWindow(window, step))
        return
      }
      if (window.kind === 'rotation') {
        const next = rotations[rotationIndex + step]
        if (next !== undefined) change({ rotation: next.id })
        return
      }
      // The kind is written back, so a rotation that fell out of scope leaves no stale rotation in the URL, and a bare
      // URL, which opens on the rotation, is never what a day, a week or a month leaves behind (D-217).
      change({
        range: window.kind,
        rotation: undefined,
        from: shiftedAnchor(window.kind, window.from, step),
        to: undefined,
      })
    },
    [change, window, rotations, rotationIndex],
  )
  const goToToday = useCallback(() => {
    if (window?.kind === 'rotation' && today !== null) {
      const running = rotations.find((candidate) => candidate.start_date <= today && (candidate.end_date ?? today) >= today)
      // A rotation past its capped days runs today but cannot show it: today's week then.
      const shown = running !== undefined && running.id === window.rotationId
      change(
        running === undefined || shown
          ? { range: DEFAULT_RANGE_KIND, rotation: undefined, from: undefined, to: undefined }
          : { rotation: running.id, from: undefined, to: undefined },
      )
      return
    }
    change({
      range: window === null || window.kind === 'custom' ? DEFAULT_RANGE_KIND : window.kind,
      rotation: undefined,
      from: undefined,
      to: undefined,
    })
  }, [change, window, rotations, today])
  const setRange = useCallback(
    (kind: Exclude<RangeKind, 'rotation'>) => {
      // The new kind holds the window's middle day, or follows today when the window held it: a week across two months
      // becomes the month most of it lies in.
      const anchor =
        window === null || window.holdsToday ? undefined : addDays(window.from, Math.floor(daysBetween(window.from, window.to) / 2))
      change({ range: kind, rotation: undefined, from: anchor, to: undefined })
    },
    [change, window],
  )
  const showRotation = useCallback(
    (rotationId: DeploymentId) => {
      change({ range: 'rotation', rotation: rotationId, from: undefined, to: undefined })
    },
    [change],
  )

  return { window, today, rotations, rotationsReady, canShift, shift, goToToday, setRange, showRotation }
}
