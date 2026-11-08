import { describe, expect, it } from 'vitest'
import { AuthMode, ColorKey, DataAdapterMode } from '@contracts'
import {
  BREAKPOINTS_PX,
  DATE_FORMATS,
  DATE_LOCALE,
  DEFAULT_VIEW_ID,
  DESKTOP_MEDIA_QUERY,
  ENV_VARIABLES,
  INDEXED_DB_NAME,
  PALETTE_KEYS,
  PANEL_IDS,
  PanelId,
  SEARCH_PARAMS,
  STORAGE_KEYS,
  VIEW_IDS,
  ViewId,
  isPaletteKey,
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

  it('refuses a development-only auth mode in production only', () => {
    expect(parseEnv(LOCAL, DEV).ok).toBe(true)
    expect(parseEnv(LOCAL, PROD)).toEqual({
      ok: false,
      issues: [{ variable: 'VITE_AUTH_MODE', code: 'development_only' }],
    })
  })

  it('accepts exactly the contract vocabularies', () => {
    for (const authMode of AuthMode.options) {
      for (const dataAdapter of DataAdapterMode.options) {
        const result = parseEnv(
          { ...REMOTE, VITE_AUTH_MODE: authMode, VITE_DATA_ADAPTER: dataAdapter },
          DEV,
        )
        expect(result.ok).toBe(true)
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
})

describe('views, url, storage, breakpoints, dates', () => {
  it('has a default view that is a view id', () => {
    expect(VIEW_IDS).toContain(DEFAULT_VIEW_ID)
    expect(ViewId.safeParse('gantt').success).toBe(false)
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
    expect(DESKTOP_MEDIA_QUERY).toBe('(min-width: 768px)')
  })

  it('builds a formatter for every date format in the locale', () => {
    for (const options of Object.values(DATE_FORMATS)) {
      const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options)
      expect(formatter.resolvedOptions().locale).toBe(DATE_LOCALE)
    }
  })
})

describe('panels (D-092)', () => {
  it('lists every panel id in the schema', () => {
    expect([...PanelId.options].sort()).toEqual(Object.values(PANEL_IDS).sort())
    expect(PanelId.safeParse('nothing').success).toBe(false)
  })
})
