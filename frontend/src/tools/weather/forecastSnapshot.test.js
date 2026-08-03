import { describe, expect, it } from 'vitest'
import { loadForecastSnapshot, saveForecastSnapshot, validateForecastSnapshot, validForecastData } from './forecastSnapshot'

const place = { id: 1273294, name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'France', countryCode: 'FR', admin1: 'Île-de-France', timezone: 'Europe/Paris' }
const data = {
  schemaVersion: 1, latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris', timezoneAbbreviation: 'CEST', utcOffsetSeconds: 7200, elevation: 42,
  units: { temperature: '°C', apparentTemperature: '°C', precipitation: 'mm', windSpeed: 'km/h', windDirection: '°', relativeHumidity: '%' },
  current: { time: '2026-08-03T10:00', temperature: 21.4, apparentTemperature: 20.1, weatherCode: 2, relativeHumidity: 55, windSpeed: 12, windDirection: 200, precipitation: 0 },
  hourly: [{ time: '2026-08-03T10:00', temperature: 21.4, weatherCode: 2, precipitation: 0 }, { time: '2026-08-03T11:00', temperature: 22.1, weatherCode: 3, precipitation: null }],
  daily: [{ date: '2026-08-03', temperatureMax: 24.5, temperatureMin: 15.2, weatherCode: 2, sunrise: '2026-08-03T06:20', sunset: '2026-08-03T21:30', precipitationProbabilityMax: 10 }],
  source: { name: 'Open-Meteo', url: 'https://open-meteo.com/', license_name: 'CC BY 4.0', license_url: 'https://open-meteo.com/en/license', attribution: 'Weather data by Open-Meteo.com' },
  providerCheckedAt: '2026-08-03T10:01:00Z', cacheStatus: 'live', forecastNotice: 'Weather forecasts are for general information only and may be delayed or inaccurate.',
}

describe('offline forecast snapshots', () => {
  it('round trips a valid per-place snapshot', () => {
    const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }
    expect(saveForecastSnapshot(place, data, storage, () => Date.UTC(2026, 7, 3))).toMatchObject({ version: 1, place, data })
    expect(loadForecastSnapshot(storage)).toMatchObject({ place, data })
  })

  it('accepts nullable optional readings from the provider', () => {
    const nulled = { ...data, current: { ...data.current, relativeHumidity: null, windDirection: null, precipitation: null }, daily: [{ ...data.daily[0], precipitationProbabilityMax: null }] }
    expect(validForecastData(nulled)).toBe(true)
  })

  it('rejects malformed, stale-schema, or unsafe forecast data', () => {
    expect(validateForecastSnapshot({ version: 2, snapshotRefreshedAt: '2026-08-03T10:00:00Z', place, data })).toBeNull()
    expect(validateForecastSnapshot({ version: 1, snapshotRefreshedAt: 'bad', place, data })).toBeNull()
    expect(validateForecastSnapshot({ version: 1, snapshotRefreshedAt: '2026-08-03T10:00:00Z', place: { name: 'Nowhere' }, data })).toBeNull()
    expect(loadForecastSnapshot({ getItem: () => '{bad' })).toBeNull()
    expect(validForecastData({ ...data, schemaVersion: 2 })).toBe(false)
    expect(validForecastData({ ...data, current: { ...data.current, weatherCode: 120 } })).toBe(false)
    expect(validForecastData({ ...data, current: { ...data.current, temperature: Infinity } })).toBe(false)
    expect(validForecastData({ ...data, source: { ...data.source, attribution: 'Made up' } })).toBe(false)
    expect(validForecastData({ ...data, source: { ...data.source, url: 'javascript:alert(1)' } })).toBe(false)
    expect(saveForecastSnapshot(place, { ...data, hourly: [] }, { setItem() {} })).toBeNull()
  })
})
