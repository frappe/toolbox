import { describe, expect, it } from 'vitest'

import { describeZonedTime, parseDateTimeLocal, zonedWallTimeToInstant } from './timeZone'

// The rule for a written page is that every number in a worked example is computed by the tool.
// This holds the page to it: `toolbox/content/time-zone-converter.md` states these times, and
// without a test they would go quietly wrong the day the conversion or the IANA data changed.
// A page that states a wrong time is worse than a page that states nothing.
function readAt(wall, sourceZone, targetZone) {
  const instant = zonedWallTimeToInstant(parseDateTimeLocal(wall), sourceZone)
  const d = describeZonedTime(instant, targetZone, sourceZone)
  return {
    time: `${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`,
    day: d.dayDifference,
    date: `${d.day}/${d.month}`,
    offset: d.offsetLabel,
    dst: d.daylightSaving,
  }
}

describe('the worked examples on the Time Zone Converter page', () => {
  it('reads a 09:30 New York meeting in January', () => {
    expect(readAt('2026-01-14T09:30', 'America/New_York', 'Europe/London').time).toBe('14:30')
    expect(readAt('2026-01-14T09:30', 'America/New_York', 'Asia/Kolkata').time).toBe('20:00')
    const sydney = readAt('2026-01-14T09:30', 'America/New_York', 'Australia/Sydney')
    expect(sydney.time).toBe('01:30')
    expect(sydney.day).toBe(1)
    expect(sydney.date).toBe('15/1')
  })

  it('reads the same meeting in July', () => {
    expect(readAt('2026-07-14T09:30', 'America/New_York', 'Europe/London').time).toBe('14:30')
    expect(readAt('2026-07-14T09:30', 'America/New_York', 'Asia/Kolkata').time).toBe('19:00')
    const sydney = readAt('2026-07-14T09:30', 'America/New_York', 'Australia/Sydney')
    expect(sydney.time).toBe('23:30')
    expect(sydney.day).toBe(0)
  })

  it('reads the three weeks when London and New York are four hours apart', () => {
    expect(readAt('2026-03-01T12:00', 'Europe/London', 'America/New_York').time).toBe('07:00')
    expect(readAt('2026-03-10T12:00', 'Europe/London', 'America/New_York').time).toBe('08:00')
    expect(readAt('2026-04-01T12:00', 'Europe/London', 'America/New_York').time).toBe('07:00')
  })

  it('reads Sydney on daylight saving in January and standard in July', () => {
    expect(readAt('2026-01-14T12:00', 'Asia/Kolkata', 'Australia/Sydney').offset).toBe('UTC+11:00')
    expect(readAt('2026-01-14T12:00', 'Asia/Kolkata', 'Australia/Sydney').dst).toBe(true)
    expect(readAt('2026-07-14T12:00', 'Asia/Kolkata', 'Australia/Sydney').offset).toBe('UTC+10:00')
    expect(readAt('2026-07-14T12:00', 'Asia/Kolkata', 'Australia/Sydney').dst).toBe(false)
  })

  it('reads London as UTC in January and UTC+01:00 in July', () => {
    expect(readAt('2026-01-14T12:00', 'Asia/Kolkata', 'Europe/London').offset).toBe('UTC')
    expect(readAt('2026-07-14T12:00', 'Asia/Kolkata', 'Europe/London').offset).toBe('UTC+01:00')
  })
})
