import { describe, expect, it } from 'vitest'

import { convertTemperature, formatTemperature } from './temperature'

describe('showing a forecast in the unit a visitor chose', () => {
  it('leaves Celsius alone', () => {
    expect(convertTemperature(21.4, 'celsius')).toBe(21.4)
    expect(formatTemperature(21.4, 'celsius')).toBe('21°C')
  })

  it('converts to Fahrenheit', () => {
    expect(convertTemperature(0, 'fahrenheit')).toBe(32)
    expect(convertTemperature(100, 'fahrenheit')).toBe(212)
    expect(convertTemperature(-40, 'fahrenheit')).toBe(-40)
    expect(formatTemperature(37, 'fahrenheit')).toBe('99°F')
  })

  it('rounds after converting, not before', () => {
    // 36.6 °C is 97.88 °F. Rounding the Celsius first would show 97.
    expect(formatTemperature(36.6, 'fahrenheit')).toBe('98°F')
  })

  it('falls back to Celsius for a unit it does not know', () => {
    expect(formatTemperature(21, 'kelvin')).toBe('21°C')
    expect(formatTemperature(21, undefined)).toBe('21°C')
  })

  it('shows a dash where the forecast has no number', () => {
    // A provider can leave a field out, and the polar sunrise nulls proved it does.
    expect(formatTemperature(null, 'celsius')).toBe('—')
    expect(formatTemperature(undefined, 'fahrenheit')).toBe('—')
    expect(convertTemperature(Number.NaN, 'celsius')).toBeNull()
  })
})
