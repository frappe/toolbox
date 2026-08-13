export const WEATHER_FORECAST_SNAPSHOT_KEY = 'toolbox:weather-forecast:v1'
const WEATHER_ATTRIBUTION = 'Weather data from MET Norway'

// `sessionStorage`, because this snapshot is keyed by the place it is for. The rate snapshot next
// door caches public numbers and names nobody, so it stays in `localStorage` and keeps the
// converter working on a first offline visit. A forecast records where somebody looked, which is
// usually where they live, and that is a record of the visitor rather than of the data (#206).
function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function loadForecastSnapshot(storage = defaultStorage()) {
  try { return validateForecastSnapshot(JSON.parse(storage?.getItem(WEATHER_FORECAST_SNAPSHOT_KEY))) } catch { return null }
}

export function saveForecastSnapshot(place, data, storage = defaultStorage(), now = () => Date.now()) {
  try {
    const snapshot = validateForecastSnapshot({ version: 1, snapshotRefreshedAt: new Date(now()).toISOString(), place, data })
    if (!snapshot) return null
    storage?.setItem(WEATHER_FORECAST_SNAPSHOT_KEY, JSON.stringify(snapshot))
    return snapshot
  } catch { return null }
}

// A visitor who looked up the weather before this moved carries the old key on their machine, and
// nothing would ever read it again. Clearing it keeps the promise the site makes about what it
// stores, and it is the record of a place that the promise is about.
export function forgetStoredForecast(storage = safeLocalStorage()) {
  try {
    storage?.removeItem(WEATHER_FORECAST_SNAPSHOT_KEY)
    return true
  } catch {
    return false
  }
}

export function validateForecastSnapshot(value) {
  if (!isObject(value) || value.version !== 1 || !validIso(value.snapshotRefreshedAt)) return null
  if (!validPlace(value.place) || !validForecastData(value.data)) return null
  return value
}

export function validForecastData(value) {
  if (!isObject(value) || value.schemaVersion !== 1) return false
  if (!validCoordinate(value.latitude, 90) || !validCoordinate(value.longitude, 180)) return false
  if (typeof value.timezone !== 'string' || !value.timezone) return false
  if (!isObject(value.units) || !validCurrent(value.current)) return false
  if (!validSeries(value.hourly, 192, validHourly) || !validSeries(value.daily, 32, validDaily)) return false
  if (!validIso(value.providerCheckedAt) || !['live', 'cached', 'stale'].includes(value.cacheStatus)) return false
  return validSource(value.source)
}

export function validPlace(value) {
  return isObject(value) && typeof value.name === 'string' && value.name.length > 0 && validCoordinate(value.latitude, 90) && validCoordinate(value.longitude, 180)
}

function validCurrent(value) {
  if (!isObject(value)) return false
  return validIso(value.time) && validNumber(value.temperature) && validNumber(value.apparentTemperature) && validCode(value.weatherCode)
    && validOptionalNumber(value.relativeHumidity) && validNumber(value.windSpeed) && validOptionalNumber(value.windDirection) && validOptionalNumber(value.precipitation)
}

function validHourly(value) {
  return isObject(value) && validIso(value.time) && validNumber(value.temperature) && validCode(value.weatherCode) && validOptionalNumber(value.precipitation)
}

// Sunrise and sunset are absent above the polar circles, where the sun neither rises nor sets
// that day. That is data, not a gap, so it must not reject the whole forecast.
function validDaily(value) {
  if (!isObject(value)) return false
  return validDate(value.date) && validNumber(value.temperatureMax) && validNumber(value.temperatureMin) && validCode(value.weatherCode)
    && validOptionalIso(value.sunrise) && validOptionalIso(value.sunset) && validOptionalNumber(value.precipitationProbabilityMax)
}

function validSource(value) {
  return isObject(value) && typeof value.name === 'string' && /^https:\/\//.test(value.url ?? '') && value.attribution === WEATHER_ATTRIBUTION
}

function validSeries(value, maximum, validItem) {
  return Array.isArray(value) && value.length > 0 && value.length <= maximum && value.every(validItem)
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function validNumber(value) { return Number.isFinite(value) }
function validOptionalNumber(value) { return value === null || Number.isFinite(value) }
function validCode(value) { return Number.isInteger(value) && value >= 0 && value <= 99 }
function validCoordinate(value, max) { return Number.isFinite(value) && value >= -max && value <= max }
function validIso(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) }
function validOptionalIso(value) { return value === null || value === undefined || validIso(value) }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value) }
