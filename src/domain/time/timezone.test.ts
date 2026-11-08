import { describe, expect, it } from 'vitest'
import { clockAt, isKnownTimeZone, timeZoneIssues } from './index'

const NOW = '2026-11-08T22:30:00Z'

describe('organization time zone (D-084)', () => {
  it.each(['Asia/Jerusalem', 'UTC', 'America/New_York'])('accepts %s', (timezone) => {
    expect(isKnownTimeZone(timezone)).toBe(true)
    expect(timeZoneIssues(timezone)).toEqual([])
    expect(() => clockAt(timezone, NOW)).not.toThrow()
  })

  it.each(['Asia/Jerusalemm', 'Mars/Olympus', 'not a zone', ''])('refuses %j', (timezone) => {
    expect(isKnownTimeZone(timezone)).toBe(false)
    expect(timeZoneIssues(timezone)).toEqual([{ path: ['timezone'], code: 'invalid_value' }])
  })

  it('derives today in the zone, not in UTC', () => {
    expect(clockAt('Asia/Jerusalem', NOW).today).toBe('2026-11-09')
    expect(clockAt('UTC', NOW).today).toBe('2026-11-08')
  })
})
