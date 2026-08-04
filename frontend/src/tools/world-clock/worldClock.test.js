import { describe, expect, it } from 'vitest'

import {
  availableTimeZones,
  describeZonedTime,
  formatUtcOffset,
  isWithinWorkingHours,
  parseDateTimeLocal,
  searchTimeZones,
  selectedInstant,
  zonedWallTimeToInstant,
} from './worldClock'
import { canonicalizeZone } from './worldClockCities'

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
    expect(searchTimeZones('kolkata')[0].zone).toBe('Asia/Kolkata')
    expect(searchTimeZones('america new york')[0].zone).toBe('America/New_York')
  })

  it('finds curated cities that do not have their own IANA zone', () => {
    const mumbai = searchTimeZones('mumbai')[0]
    expect(mumbai).toMatchObject({ zone: 'Asia/Kolkata', label: 'Mumbai' })
    expect(mumbai.id).toBeTruthy()
    expect(searchTimeZones('pune')[0]).toMatchObject({ zone: 'Asia/Kolkata', label: 'Pune' })
    // Both cities share a zone but stay distinct entries.
    expect(searchTimeZones('mumbai')[0].id).not.toBe(searchTimeZones('pune')[0].id)
  })

  it('collapses alias zones so a city is never listed twice', () => {
    expect(canonicalizeZone('Asia/Calcutta')).toBe('Asia/Kolkata')

    const results = searchTimeZones('calcutta')
    expect(results.every((result) => result.zone === 'Asia/Kolkata')).toBe(true)
    expect(results.some((result) => result.label === 'Kolkata')).toBe(true)
  })

  it('keeps alias identifiers out of the canonical zone pool', () => {
    const zones = availableTimeZones()
    expect(zones).toContain('Asia/Kolkata')
    expect(zones).not.toContain('Asia/Calcutta')
  })

  it('formats whole-hour and fractional UTC offsets', () => {
    expect(formatUtcOffset(0)).toBe('UTC')
    expect(formatUtcOffset(330)).toBe('UTC+05:30')
    expect(formatUtcOffset(-240)).toBe('UTC−04:00')
  })

  it('converts a wall-clock time in a zone to the correct UTC instant', () => {
    // 15:30 on 2026-08-04 in Asia/Kolkata (UTC+05:30) is 10:00 UTC.
    expect(
      zonedWallTimeToInstant({ year: 2026, month: 8, day: 4, hour: 15, minute: 30 }, 'Asia/Kolkata').toISOString(),
    ).toBe('2026-08-04T10:00:00.000Z')
  })

  it('resolves the offset through a daylight-saving zone', () => {
    // 12:00 on 2026-07-01 in America/New_York (EDT, UTC−04:00) is 16:00 UTC.
    expect(
      zonedWallTimeToInstant({ year: 2026, month: 7, day: 1, hour: 12, minute: 0 }, 'America/New_York').toISOString(),
    ).toBe('2026-07-01T16:00:00.000Z')
  })

  it('parses a datetime-local string', () => {
    expect(parseDateTimeLocal('2026-08-04T15:30')).toEqual({
      year: 2026,
      month: 8,
      day: 4,
      hour: 15,
      minute: 30,
    })
    expect(parseDateTimeLocal('')).toBeNull()
  })
})
