import { describe, expect, it } from 'vitest'
import { AuthMode, ColorKey, DataAdapterMode, IconKey } from '@contracts'
import {
  ADAPTER_OF_AUTH_MODE,
  BAR_COLOR_MODES,
  BREAKPOINTS_PX,
  BarColorMode,
  DATE_FORMATS,
  DATE_LOCALE,
  DEFAULT_BAR_COLOR_MODE,
  DEFAULT_VIEW_BY_DEVICE,
  FIRST_ROTATION_LEAVE_COLOR,
  LEAVE_TYPE_PALETTE_KEYS,
  ROTATION_LEAVE_PALETTE_KEYS,
  isLeaveTypePaletteKey,
  isRotationLeavePaletteKey,
  DARK_SCHEME_MEDIA_QUERY,
  DESKTOP_MEDIA_QUERY,
  SETUP_SECTIONS,
  WORK_SECTIONS,
  ENV_VARIABLES,
  ICON_KEYS,
  INDEXED_DB_NAME,
  LEAVE_BATCH,
  LEAVE_ROUNDS,
  LEAVE_SHEET,
  PALETTE_KEYS,
  PANEL_IDS,
  SETUP_STEPS,
  PanelId,
  PWA,
  SEARCH_PARAMS,
  STORAGE_KEYS,
  TIMELINE_DRAG,
  TIMELINE_LANES,
  TIMELINE_LANES_TOUCH,
  UNIT_TEMPLATES,
  TIMELINE_DENSITY,
  TIMELINE_LAYOUT,
  VIEW_IDS,
  ViewId,
  isIconKey,
  isPaletteKey,
  isStaging,
  parseEnv,
} from './index'

const LOCAL = {
  VITE_AUTH_MODE: 'local',
  VITE_DATA_ADAPTER: 'local',
  VITE_REMOTE_URL: '',
  VITE_REMOTE_ANON_KEY: '',
}
const REMOTE = {
  VITE_AUTH_MODE: 'google',
  VITE_DATA_ADAPTER: 'remote',
  VITE_REMOTE_URL: 'https://example.test',
  VITE_REMOTE_ANON_KEY: 'anon',
}
const DEV = { production: false }
const PROD = { production: true }

describe('env', () => {
  it('names every variable once, with the VITE_ prefix', () => {
    const names = Object.values(ENV_VARIABLES)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name.startsWith('VITE_')).toBe(true)
  })

  it('parses the local development environment', () => {
    expect(parseEnv(LOCAL, DEV)).toEqual({
      ok: true,
      value: { authMode: 'local', dataAdapter: 'local', remote: null },
    })
  })

  it('parses a remote environment', () => {
    expect(parseEnv(REMOTE, PROD)).toEqual({
      ok: true,
      value: {
        authMode: 'google',
        dataAdapter: 'remote',
        remote: { url: 'https://example.test', anonKey: 'anon' },
      },
    })
  })

  it('ignores remote values while the adapter is local', () => {
    const result = parseEnv(
      { ...LOCAL, VITE_REMOTE_URL: 'https://example.test', VITE_REMOTE_ANON_KEY: 'k' },
      DEV,
    )
    expect(result).toEqual({
      ok: true,
      value: { authMode: 'local', dataAdapter: 'local', remote: null },
    })
  })

  it('reports missing and invalid variables', () => {
    expect(parseEnv({}, DEV)).toEqual({
      ok: false,
      issues: [
        { variable: 'VITE_AUTH_MODE', code: 'missing' },
        { variable: 'VITE_DATA_ADAPTER', code: 'missing' },
      ],
    })
    expect(parseEnv({ ...LOCAL, VITE_AUTH_MODE: 'github' }, DEV)).toEqual({
      ok: false,
      issues: [{ variable: 'VITE_AUTH_MODE', code: 'invalid' }],
    })
    expect(parseEnv({ ...REMOTE, VITE_REMOTE_URL: 'not a url' }, PROD)).toEqual({
      ok: false,
      issues: [{ variable: 'VITE_REMOTE_URL', code: 'invalid' }],
    })
  })

  it('requires the remote variables for the remote adapter', () => {
    expect(
      parseEnv({ ...REMOTE, VITE_REMOTE_URL: '', VITE_REMOTE_ANON_KEY: '  ' }, PROD),
    ).toEqual({
      ok: false,
      issues: [
        { variable: 'VITE_REMOTE_URL', code: 'required_for_remote' },
        { variable: 'VITE_REMOTE_ANON_KEY', code: 'required_for_remote' },
      ],
    })
  })

  it('marks staging only for its exact stage name (D-300)', () => {
    expect(isStaging({ ...REMOTE, VITE_APP_ENV: 'staging' })).toBe(true)
    expect(isStaging(REMOTE)).toBe(false)
    expect(isStaging({ ...REMOTE, VITE_APP_ENV: 'Staging' })).toBe(false)
    expect(parseEnv({ ...REMOTE, VITE_APP_ENV: 'staging' }, PROD).ok).toBe(true)
    expect(parseEnv({ ...REMOTE, VITE_APP_ENV: '' }, PROD).ok).toBe(true)
    expect(parseEnv({ ...REMOTE, VITE_APP_ENV: 'prod' }, PROD)).toEqual({
      ok: false,
      issues: [{ variable: 'VITE_APP_ENV', code: 'invalid' }],
    })
  })

  it('refuses a development-only auth mode in production only', () => {
    expect(parseEnv(LOCAL, DEV).ok).toBe(true)
    expect(parseEnv(LOCAL, PROD)).toEqual({
      ok: false,
      issues: [{ variable: 'VITE_AUTH_MODE', code: 'development_only' }],
    })
  })

  it('accepts each auth mode with its own adapter only (D-207)', () => {
    for (const authMode of AuthMode.options) {
      for (const dataAdapter of DataAdapterMode.options) {
        const result = parseEnv(
          { ...REMOTE, VITE_AUTH_MODE: authMode, VITE_DATA_ADAPTER: dataAdapter },
          DEV,
        )
        expect(result).toEqual(
          ADAPTER_OF_AUTH_MODE[authMode] === dataAdapter
            ? expect.objectContaining({ ok: true })
            : { ok: false, issues: [{ variable: 'VITE_DATA_ADAPTER', code: 'unpaired' }] },
        )
      }
    }
  })
})

describe('palette', () => {
  it('has 12 unique keys that satisfy the contract', () => {
    expect(PALETTE_KEYS).toHaveLength(12)
    expect(new Set(PALETTE_KEYS).size).toBe(12)
    for (const key of PALETTE_KEYS) expect(ColorKey.safeParse(key).success).toBe(true)
  })

  it('tells members from other strings', () => {
    expect(isPaletteKey('teal')).toBe(true)
    expect(isPaletteKey('Teal')).toBe(false)
    expect(isPaletteKey('')).toBe(false)
  })

  it('gives every template leave type a key a leave type may take (D-290)', () => {
    for (const template of Object.values(UNIT_TEMPLATES))
      for (const group of template.leaveGroups) for (const type of group.types) expect(isLeaveTypePaletteKey(type.color)).toBe(true)
  })
})

describe('icons (D-113)', () => {
  it('has unique keys that satisfy the contract', () => {
    expect(new Set(ICON_KEYS).size).toBe(ICON_KEYS.length)
    for (const key of ICON_KEYS) expect(IconKey.safeParse(key).success).toBe(true)
  })

  it('tells members from other strings', () => {
    expect(isIconKey('exam')).toBe(true)
    expect(isIconKey('Exam')).toBe(false)
    expect(isIconKey('')).toBe(false)
  })
})

describe('views, url, storage, breakpoints, dates', () => {
  it('has a default bar color mode that is a mode (D-112)', () => {
    expect(BAR_COLOR_MODES).toContain(DEFAULT_BAR_COLOR_MODE)
    expect(BarColorMode.safeParse('rainbow').success).toBe(false)
  })

  it('fits a lane step around a bar (D-111)', () => {
    expect(TIMELINE_LANES.laneStepPx).toBeGreaterThan(TIMELINE_LANES.barPx)
    expect(TIMELINE_LAYOUT.rowPx).toBeGreaterThan(TIMELINE_LANES.barPx)
  })

  it('makes every bar a 44 px touch target on a phone, and a row of one lane its own height (D-144)', () => {
    expect(TIMELINE_LANES_TOUCH.laneStepPx).toBe(TIMELINE_LAYOUT.rowTouchPx)
    expect(TIMELINE_LANES_TOUCH.laneStepPx).toBeGreaterThan(TIMELINE_LANES_TOUCH.barPx)
    // The hit area grows by the same amount above and below a bar, in whole pixels.
    expect((TIMELINE_LANES_TOUCH.laneStepPx - TIMELINE_LANES_TOUCH.barPx) % 2).toBe(0)
  })

  it('keeps the handles of a bar apart from its body (D-143)', () => {
    // A one-day bar of a week keeps its handles apart; a narrower day shrinks them (drag.ts).
    expect(TIMELINE_DRAG.handlePx * 3).toBeLessThan(TIMELINE_DENSITY.bands[0].minDayPx)
    expect(TIMELINE_DRAG.holdTolerancePx).toBeGreaterThan(0)
  })

  it('has a default view per device that is a view id (D-290)', () => {
    expect(VIEW_IDS).toContain(DEFAULT_VIEW_BY_DEVICE.desktop)
    expect(VIEW_IDS).toContain(DEFAULT_VIEW_BY_DEVICE.phone)
    expect(ViewId.safeParse('gantt').success).toBe(false)
  })

  it('offers a leave type no green, so green never means away (D-268, D-290)', () => {
    expect(LEAVE_TYPE_PALETTE_KEYS).not.toContain('green')
    expect(LEAVE_TYPE_PALETTE_KEYS).not.toContain('lime')
    expect(LEAVE_TYPE_PALETTE_KEYS).toContain('red')
    expect(isLeaveTypePaletteKey('green')).toBe(false)
    expect(isLeaveTypePaletteKey('blue')).toBe(true)
    expect(isLeaveTypePaletteKey('nope')).toBe(false)
  })

  it('offers the built-in group calm leave colors only, blue first (D-346)', () => {
    expect(ROTATION_LEAVE_PALETTE_KEYS[0]).toBe(FIRST_ROTATION_LEAVE_COLOR)
    for (const key of ROTATION_LEAVE_PALETTE_KEYS) expect(isLeaveTypePaletteKey(key)).toBe(true)
    expect(isRotationLeavePaletteKey('cyan')).toBe(true)
    expect(isRotationLeavePaletteKey('red')).toBe(false)
    expect(isRotationLeavePaletteKey('nope')).toBe(false)
  })

  it('has unique URL parameter names', () => {
    const names = Object.values(SEARCH_PARAMS)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has unique, namespaced storage keys', () => {
    const keys = Object.values(STORAGE_KEYS)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key.startsWith(`${INDEXED_DB_NAME}.`)).toBe(true)
  })

  it('orders breakpoints and derives the desktop query', () => {
    const widths = Object.values(BREAKPOINTS_PX)
    expect([...widths].sort((a, b) => a - b)).toEqual(widths)
    expect(DESKTOP_MEDIA_QUERY).toBe('(min-width: 768px) and (min-height: 512px)')
    expect(DARK_SCHEME_MEDIA_QUERY).toBe('(prefers-color-scheme: dark)')
  })

  it('builds a formatter for every date format in the locale', () => {
    for (const options of Object.values(DATE_FORMATS)) {
      const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options)
      expect(formatter.resolvedOptions().locale).toBe(DATE_LOCALE)
    }
  })
})

describe('leave rounds (D-316)', () => {
  it('starts at a rhythm the planner accepts, and plans no more than a sheet allows per soldier', () => {
    for (const days of [LEAVE_ROUNDS.defaultDaysIn, LEAVE_ROUNDS.defaultDaysHome]) {
      expect(Number.isInteger(days)).toBe(true)
      expect(days).toBeGreaterThanOrEqual(1)
      expect(days).toBeLessThanOrEqual(LEAVE_ROUNDS.maxDays)
    }
    expect(LEAVE_ROUNDS.maxLeaves).toBeGreaterThanOrEqual(LEAVE_SHEET.maxLeaves)
  })

  it('plans no more than one batch creates (D-302)', () => {
    expect(LEAVE_ROUNDS.maxLeaves).toBeLessThanOrEqual(LEAVE_BATCH.maxLeaves)
  })
})

describe('panels (D-092)', () => {
  it('lists every panel id in the schema', () => {
    expect([...PanelId.options].sort()).toEqual(Object.values(PANEL_IDS).sort())
    expect(PanelId.safeParse('nothing').success).toBe(false)
  })

  it('places each panel once, across work and setup (D-285, OI-252)', () => {
    const work: readonly PanelId[] = WORK_SECTIONS.flatMap((section) => section.modules)
    const setup: readonly PanelId[] = SETUP_SECTIONS.flatMap((section) => section.panels)
    const placed = [...work, ...setup]
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('gives each setup step its own panel (D-180)', () => {
    expect(new Set(SETUP_STEPS.map((step) => step.id)).size).toBe(SETUP_STEPS.length)
    expect(new Set(SETUP_STEPS.map((step) => step.panel)).size).toBe(SETUP_STEPS.length)
  })

  it('keeps the command gateway and auth out of the worker (D-183)', () => {
    expect(PWA.networkOnlyPaths).toEqual(['/functions/v1/commands', '/auth/v1'])
    expect(PWA.iosUserAgent.test('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true)
    expect(PWA.iosUserAgent.test('Mozilla/5.0 (Linux; Android 15; Pixel 7)')).toBe(false)
  })
})
