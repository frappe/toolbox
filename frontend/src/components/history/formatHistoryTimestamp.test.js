import { describe, expect, it } from 'vitest'

import { formatHistoryTimestamp } from './formatHistoryTimestamp'

describe('formatHistoryTimestamp', () => {
  const now = Date.UTC(2026, 7, 4, 12, 0, 0)

  it('labels very recent entries as "Just now"', () => {
    expect(formatHistoryTimestamp(now, now)).toBe('Just now')
    expect(formatHistoryTimestamp(now - 30_000, now)).toBe('Just now')
    // Clock skew (entry in the near future) still reads sensibly.
    expect(formatHistoryTimestamp(now + 5_000, now)).toBe('Just now')
  })

  it('labels minutes and hours', () => {
    expect(formatHistoryTimestamp(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(formatHistoryTimestamp(now - 3 * 3_600_000, now)).toBe('3 hr ago')
  })

  it('labels days up to a week, then falls back to a date', () => {
    expect(formatHistoryTimestamp(now - 24 * 3_600_000, now)).toBe('1 day ago')
    expect(formatHistoryTimestamp(now - 3 * 24 * 3_600_000, now)).toBe('3 days ago')

    const older = formatHistoryTimestamp(now - 30 * 24 * 3_600_000, now)
    expect(older).not.toContain('ago')
    expect(older).not.toBe('')
  })

  it('returns an empty label for invalid timestamps', () => {
    expect(formatHistoryTimestamp(undefined, now)).toBe('')
    expect(formatHistoryTimestamp(Number.NaN, now)).toBe('')
  })
})
