import { computed, ref, watch } from 'vue'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getForecast, searchLocations } from './api'
import { forgetStoredForecast, loadForecastSnapshot, saveForecastSnapshot, validForecastData } from './forecastSnapshot'

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_DEBOUNCE_MS = 300

export function useWeather({ preferences = useToolboxPreferences(), storage, searchApi = searchLocations, forecastApi = getForecast, now } = {}) {
  const snapshot = loadForecastSnapshot(storage)
  // The forecast lived in localStorage until it moved to the session. Drop what that left behind
  // on a returning visitor's machine.
  forgetStoredForecast()
  const query = ref('')
  const results = ref([])
  const searching = ref(false)
  const searchError = ref('')
  const selectedPlace = ref(snapshot?.place ?? firstSelectablePlace(preferences.savedWeatherLocations.value))
  const forecast = ref(snapshot?.data ?? null)
  const snapshotRefreshedAt = ref(snapshot?.snapshotRefreshedAt ?? '')
  const loadState = ref(snapshot ? 'snapshot' : 'idle')
  const errorMessage = ref('')
  const current = computed(() => forecast.value?.current ?? null)
  const hourly = computed(() => forecast.value?.hourly ?? [])
  const daily = computed(() => forecast.value?.daily ?? [])
  const units = computed(() => forecast.value?.units ?? {})
  const source = computed(() => forecast.value?.source ?? null)
  let searchTimer = null
  let searchToken = 0
  let forecastToken = 0

  // Debounce search so a name is looked up once the user pauses, never per keystroke.
  watch(query, (value) => {
    clearTimeout(searchTimer)
    searchError.value = ''
    const text = value.trim()
    if (text.length < SEARCH_MIN_LENGTH) { results.value = []; searching.value = false; return }
    searching.value = true
    searchTimer = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS)
  })

  async function runSearch(text) {
    const token = ++searchToken
    try {
      const response = await searchApi(text)
      if (token !== searchToken) return
      results.value = Array.isArray(response?.results) ? response.results : []
    } catch {
      if (token !== searchToken) return
      results.value = []
      searchError.value = 'Location search is unavailable. Check your connection and try again.'
    } finally {
      if (token === searchToken) searching.value = false
    }
  }

  async function selectPlace(place) {
    if (!isSelectablePlace(place)) return
    clearTimeout(searchTimer)
    // A different place must not inherit the previous forecast, so a failure reads as an honest error.
    if (!samePlace(place, selectedPlace.value)) { forecast.value = null; snapshotRefreshedAt.value = '' }
    selectedPlace.value = place
    query.value = ''
    results.value = []
    searching.value = false
    await loadForecast()
  }

  async function loadForecast() {
    const place = selectedPlace.value
    if (!place) return
    loadState.value = forecast.value ? 'refreshing' : 'loading'
    errorMessage.value = ''
    const token = ++forecastToken
    try {
      const data = await forecastApi({ latitude: place.latitude, longitude: place.longitude, timezone: place.timezone })
      if (token !== forecastToken) return
      if (!validForecastData(data)) throw new Error('Invalid forecast data')
      forecast.value = data
      const saved = saveForecastSnapshot(place, data, storage, now)
      snapshotRefreshedAt.value = saved?.snapshotRefreshedAt ?? ''
      loadState.value = data.cacheStatus
    } catch {
      if (token !== forecastToken) return
      if (forecast.value) {
        loadState.value = 'offline'
        errorMessage.value = 'The latest forecast could not be checked. Showing the saved offline copy.'
      } else {
        loadState.value = 'error'
        errorMessage.value = 'This forecast is unavailable. Connect to the internet and try again.'
      }
    }
  }

  function refresh() { return loadForecast() }

  return {
    query, results, searching, searchError,
    selectedPlace, forecast, current, hourly, daily, units, source,
    snapshotRefreshedAt, loadState, errorMessage,
    savedPlaces: preferences.savedWeatherLocations,
    selectPlace, refresh,
  }
}

function samePlace(a, b) {
  if (!a || !b) return false
  if (a.id != null && b.id != null) return a.id === b.id
  return round2(a.latitude) === round2(b.latitude) && round2(a.longitude) === round2(b.longitude)
}

function firstSelectablePlace(places) {
  return Array.isArray(places) ? (places.find(isSelectablePlace) ?? null) : null
}

function isSelectablePlace(place) {
  return isObject(place) && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
}

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function round2(value) { return Math.round(Number(value) * 100) / 100 }
