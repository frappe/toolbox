import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { ToolboxPreferencesStore } from '@/composables/useToolboxPreferences'
import { SEARCH_DEBOUNCE_MS, useWeather } from './useWeather'
import { WEATHER_FORECAST_SNAPSHOT_KEY } from './forecastSnapshot'
import { getForecast, searchLocations } from './api'

vi.mock('./api', () => ({ searchLocations: vi.fn(), getForecast: vi.fn() }))

const place = { id: 1273294, name: 'Paris', latitude: 48.85, longitude: 2.35, country: 'France', countryCode: 'FR', admin1: 'Île-de-France', timezone: 'Europe/Paris' }
const forecast = {
  schemaVersion: 1, latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris',
  units: { temperature: '°C', apparentTemperature: '°C', precipitation: 'mm', windSpeed: 'km/h', windDirection: '°', relativeHumidity: '%' },
  current: { time: '2026-08-03T10:00', temperature: 21.4, apparentTemperature: 20.1, weatherCode: 2, relativeHumidity: 55, windSpeed: 12, windDirection: 200, precipitation: 0 },
  hourly: [{ time: '2026-08-03T10:00', temperature: 21.4, weatherCode: 2, precipitation: 0 }],
  daily: [{ date: '2026-08-03', temperatureMax: 24.5, temperatureMin: 15.2, weatherCode: 2, sunrise: '2026-08-03T06:20', sunset: '2026-08-03T21:30', precipitationProbabilityMax: 10 }],
  source: { name: 'MET Norway', url: 'https://www.met.no/en', license_name: 'CC BY 4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', attribution: 'Weather data from MET Norway' },
  providerCheckedAt: '2026-08-03T10:01:00Z', cacheStatus: 'live', forecastNotice: 'Weather forecasts are for general information only and may be delayed or inaccurate.',
}

function createWeather({ storage = null } = {}) {
  return useWeather({ preferences: new ToolboxPreferencesStore(null), storage })
}

afterEach(() => vi.useRealTimers())

describe('weather workspace search', () => {
  it('debounces the location search and calls the API once for a settled query', async () => {
    vi.useFakeTimers()
    searchLocations.mockResolvedValue({ schemaVersion: 1, results: [place], source: {} })
    const weather = createWeather()
    weather.query.value = 'pa'
    await nextTick()
    weather.query.value = 'par'
    await nextTick()
    expect(searchLocations).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS)
    expect(searchLocations).toHaveBeenCalledTimes(1)
    expect(searchLocations).toHaveBeenCalledWith('par')
    expect(weather.results.value).toEqual([place])
  })

  it('never searches a query shorter than the minimum length', async () => {
    vi.useFakeTimers()
    searchLocations.mockResolvedValue({ schemaVersion: 1, results: [place], source: {} })
    const weather = createWeather()
    weather.query.value = 'p'
    await nextTick()
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2)
    expect(searchLocations).not.toHaveBeenCalled()
    expect(weather.results.value).toEqual([])
  })
})

describe('weather workspace forecast', () => {
  it('selects a place and loads a live forecast', async () => {
    getForecast.mockResolvedValue(forecast)
    const weather = createWeather()
    expect(weather.loadState.value).toBe('idle')
    await weather.selectPlace(place)
    expect(getForecast).toHaveBeenCalledWith({ latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' })
    expect(weather.loadState.value).toBe('live')
    expect(weather.current.value.temperature).toBe(21.4)
    expect(weather.snapshotRefreshedAt.value).not.toBe('')
    expect(weather.query.value).toBe('')
  })

  it('reports server-cache and stale statuses honestly', async () => {
    getForecast.mockResolvedValue({ ...forecast, cacheStatus: 'cached' })
    const weather = createWeather()
    await weather.selectPlace(place)
    expect(weather.loadState.value).toBe('cached')
    getForecast.mockResolvedValue({ ...forecast, cacheStatus: 'stale' })
    await weather.refresh()
    expect(weather.loadState.value).toBe('stale')
  })

  it('falls back to the saved offline copy when a refresh fails', async () => {
    const stored = JSON.stringify({ version: 1, snapshotRefreshedAt: '2026-08-03T09:00:00Z', place, data: forecast })
    const storage = { getItem: () => stored, setItem() {} }
    getForecast.mockRejectedValue(new Error('offline'))
    const weather = createWeather({ storage })
    expect(weather.loadState.value).toBe('snapshot')
    expect(weather.forecast.value).not.toBeNull()
    await weather.refresh()
    expect(weather.loadState.value).toBe('offline')
    expect(weather.forecast.value).not.toBeNull()
    expect(weather.errorMessage.value).toContain('offline copy')
  })

  it('drops the forecast a visitor kept from before the move to the session', () => {
    globalThis.localStorage.setItem(WEATHER_FORECAST_SNAPSHOT_KEY, JSON.stringify({ version: 1, snapshotRefreshedAt: '2026-08-03T09:00:00Z', place, data: forecast }))

    createWeather()

    expect(globalThis.localStorage.getItem(WEATHER_FORECAST_SNAPSHOT_KEY)).toBeNull()
  })

  it('errors honestly when a new place has no data to fall back on', async () => {
    getForecast.mockRejectedValue(new Error('offline'))
    const weather = createWeather()
    await weather.selectPlace(place)
    expect(weather.loadState.value).toBe('error')
    expect(weather.forecast.value).toBeNull()
  })

  it('never trusts a malformed forecast payload', async () => {
    getForecast.mockResolvedValue({ schemaVersion: 2 })
    const weather = createWeather()
    await weather.selectPlace(place)
    expect(weather.loadState.value).toBe('error')
    expect(weather.forecast.value).toBeNull()
  })
})
