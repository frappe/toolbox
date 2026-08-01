import { describe, expect, it } from 'vitest'

import {
  describeZonedTime,
  formatUtcOffset,
  isWithinWorkingHours,
  searchTimeZones,
  selectedInstant,
} from './worldClock'

describe('world clock time-zone calculations', () => {
  it('uses IANA daylight-saving transitions', () => {
    const before = describeZonedTime(
      new Date('2026-03-08T06:30:00Z'),
      'America/New_York',
      'UTC',
    )
    const after = describeZonedTime(
      new Date('2026-03-08T07:30:00Z'),
      'America/New_York',
      'UTC',
    )

    expect(before).toMatchObject({ hour: 1, offsetMinutes: -300, daylightSaving: false })
    expect(after).toMatchObject({ hour: 3, offsetMinutes: -240, daylightSaving: true })
  })

  it('reports previous and next local dates relative to the reference zone', () => {
    const instant = new Date('2026-01-01T01:00:00Z')

    expect(describeZonedTime(instant, 'America/Los_Angeles', 'UTC').dayDifference).toBe(-1)
    expect(describeZonedTime(instant, 'Asia/Kolkata', 'America/Los_Angeles').dayDifference).toBe(1)
  })

  it('updates every zone from one selected-time offset', () => {
    const now = new Date('2026-08-01T12:00:00Z')
    const selected = selectedInstant(now, 4)

    expect(selected.toISOString()).toBe('2026-08-01T16:00:00.000Z')
    expect(describeZonedTime(selected, 'Asia/Kolkata', 'UTC').hour).toBe(21)
  })

  it('checks shared working-hour boundaries in local time', () => {
    const description = describeZonedTime(new Date('2026-08-01T10:30:00Z'), 'Europe/London')

    expect(isWithinWorkingHours(description, 9, 17)).toBe(true)
    expect(isWithinWorkingHours({ ...description, hour: 17, minute: 0 }, 9, 17)).toBe(false)
  })

  it('searches by city label and full IANA identifier', () => {
    const zones = ['Asia/Kolkata', 'Europe/London', 'America/New_York']

    expect(searchTimeZones('kolkata', zones)[0].zone).toBe('Asia/Kolkata')
    expect(searchTimeZones('america new york', zones)[0].zone).toBe('America/New_York')
  })

  it('formats whole-hour and fractional UTC offsets', () => {
    expect(formatUtcOffset(0)).toBe('UTC')
    expect(formatUtcOffset(330)).toBe('UTC+05:30')
    expect(formatUtcOffset(-240)).toBe('UTC−04:00')
  })
})
