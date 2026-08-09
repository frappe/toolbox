import { describe, expect, it } from 'vitest'
import { describeWeatherCode, windCompass } from './weatherCodes'

const KNOWN_CODES = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 68, 69, 71, 73, 75, 77, 80, 81, 82, 83, 84, 85, 86, 95, 96, 99]

describe('weather code descriptions', () => {
  it('maps representative codes to a stable label and lucide icon', () => {
    expect(describeWeatherCode(0)).toEqual({ label: 'Clear sky', icon: 'lucide-sun' })
    expect(describeWeatherCode(3)).toEqual({ label: 'Overcast', icon: 'lucide-cloud' })
    expect(describeWeatherCode(45)).toEqual({ label: 'Fog', icon: 'lucide-cloud-fog' })
    expect(describeWeatherCode(53)).toEqual({ label: 'Moderate drizzle', icon: 'lucide-cloud-drizzle' })
    expect(describeWeatherCode(65)).toEqual({ label: 'Heavy rain', icon: 'lucide-cloud-rain' })
    expect(describeWeatherCode(75)).toEqual({ label: 'Heavy snowfall', icon: 'lucide-cloud-snow' })
    expect(describeWeatherCode(95)).toEqual({ label: 'Thunderstorm', icon: 'lucide-cloud-lightning' })
    expect(describeWeatherCode(96)).toEqual({ label: 'Thunderstorm with slight hail', icon: 'lucide-cloud-lightning' })
  })

  it('describes the sleet codes MET Norway reports', () => {
    expect(describeWeatherCode(68)).toEqual({ label: 'Slight sleet', icon: 'lucide-cloud-hail' })
    expect(describeWeatherCode(69)).toEqual({ label: 'Heavy sleet', icon: 'lucide-cloud-hail' })
    expect(describeWeatherCode(83)).toEqual({ label: 'Slight sleet showers', icon: 'lucide-cloud-hail' })
    expect(describeWeatherCode(84)).toEqual({ label: 'Heavy sleet showers', icon: 'lucide-cloud-hail' })
  })

  it('covers every documented code with a real lucide icon', () => {
    for (const code of KNOWN_CODES) {
      const description = describeWeatherCode(code)
      expect(description.label).not.toBe('Unknown')
      expect(description.icon).toMatch(/^lucide-/)
    }
  })

  it('returns a safe fallback for unmapped or missing codes', () => {
    expect(describeWeatherCode(4)).toEqual({ label: 'Unknown', icon: 'lucide-cloud' })
    expect(describeWeatherCode(100)).toEqual({ label: 'Unknown', icon: 'lucide-cloud' })
    expect(describeWeatherCode(undefined)).toEqual({ label: 'Unknown', icon: 'lucide-cloud' })
  })
})

describe('wind compass', () => {
  it('rounds a bearing to the nearest of eight points', () => {
    expect(windCompass(0)).toBe('N')
    expect(windCompass(45)).toBe('NE')
    expect(windCompass(90)).toBe('E')
    expect(windCompass(180)).toBe('S')
    expect(windCompass(270)).toBe('W')
    expect(windCompass(315)).toBe('NW')
    expect(windCompass(359)).toBe('N')
  })

  it('normalizes out-of-range bearings and rejects non-finite input', () => {
    expect(windCompass(360)).toBe('N')
    expect(windCompass(-45)).toBe('NW')
    expect(windCompass(Number.NaN)).toBe('')
    expect(windCompass(null)).toBe('')
  })
})
