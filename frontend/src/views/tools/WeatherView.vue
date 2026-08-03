<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"><Icon name="lucide-cloud-sun" class="size-6 text-ink-gray-7" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Information</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Weather</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Search a place for current conditions and a public forecast.</p>
      </div>
      <Button class="h-11" variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <div class="pt-8">
      <label for="weather-search" class="block text-sm font-medium text-ink-gray-7">Search a city or place</label>
      <div class="relative mt-2 max-w-xl">
        <input id="weather-search" v-model="weather.query.value" class="h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9" type="search" autocomplete="off" placeholder="Bengaluru, London, New York" role="combobox" aria-controls="weather-results" :aria-expanded="weather.results.value.length > 0" />
        <ul v-if="weather.results.value.length" id="weather-results" class="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-gray-2 bg-surface-base p-2 shadow-lg" aria-label="Location search results">
          <li v-for="place in weather.results.value" :key="placeKey(place)">
            <button type="button" class="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-surface-gray-2" @click="weather.selectPlace(place)"><span class="min-w-0"><span class="block truncate font-medium text-ink-gray-8">{{ place.name }}</span><span class="block truncate text-sm text-ink-gray-5">{{ placeRegion(place) }}</span></span><span class="shrink-0 text-xs font-medium text-ink-gray-5">{{ place.countryCode }}</span></button>
          </li>
        </ul>
      </div>
      <p v-if="weather.searchError.value" class="mt-2 max-w-xl rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-3" role="alert">{{ weather.searchError.value }}</p>
      <p v-else-if="weather.searching.value" class="mt-2 text-sm text-ink-gray-5">Searching…</p>
    </div>

    <div v-if="weather.savedPlaces.value.length" class="pt-5">
      <h2 class="text-sm font-medium text-ink-gray-8">Saved places</h2>
      <div class="flex flex-wrap gap-2 pt-2">
        <button v-for="saved in weather.savedPlaces.value" :key="placeKey(saved)" type="button" class="rounded-lg bg-surface-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-3" @click="weather.selectPlace(saved)">{{ saved.name }}</button>
      </div>
    </div>

    <div v-if="weather.forecast.value && weather.selectedPlace.value" class="pt-8">
      <section class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-labelledby="weather-current-heading">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h2 id="weather-current-heading" class="text-lg font-semibold text-ink-gray-9">{{ weather.selectedPlace.value.name }}</h2>
            <p class="pt-1 text-sm text-ink-gray-6">{{ placeRegion(weather.selectedPlace.value) }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button :label="isPlaceSaved ? 'Saved' : 'Save place'" variant="subtle" :icon="isPlaceSaved ? 'lucide-bookmark-check' : 'lucide-bookmark'" @click="toggleSavedPlace" />
            <Button label="Refresh" variant="ghost" icon="lucide-refresh-cw" :loading="['loading', 'refreshing'].includes(weather.loadState.value)" @click="weather.refresh" />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-5 pt-5">
          <Icon :name="currentCondition.icon" class="size-12 text-ink-gray-7" />
          <div>
            <p class="text-4xl font-semibold tracking-tight text-ink-gray-9">{{ formatValue(weather.current.value.temperature) }}{{ unit('temperature') }}</p>
            <p class="pt-1 text-sm text-ink-gray-6">{{ currentCondition.label }} · Feels like {{ formatValue(weather.current.value.apparentTemperature) }}{{ unit('apparentTemperature') }}</p>
          </div>
        </div>
        <dl class="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3">
          <div class="rounded-xl bg-surface-base p-3"><dt class="text-xs text-ink-gray-5">Humidity</dt><dd class="pt-1 text-base font-medium text-ink-gray-9">{{ formatValue(weather.current.value.relativeHumidity) }}{{ unit('relativeHumidity') }}</dd></div>
          <div class="rounded-xl bg-surface-base p-3"><dt class="text-xs text-ink-gray-5">Wind</dt><dd class="pt-1 text-base font-medium text-ink-gray-9">{{ windSummary }}</dd></div>
          <div class="rounded-xl bg-surface-base p-3"><dt class="text-xs text-ink-gray-5">Precipitation</dt><dd class="pt-1 text-base font-medium text-ink-gray-9">{{ formatValue(weather.current.value.precipitation, 1) }} {{ unit('precipitation') }}</dd></div>
        </dl>
      </section>

      <section class="pt-8" aria-labelledby="weather-hourly-heading">
        <h2 id="weather-hourly-heading" class="text-lg font-semibold text-ink-gray-9">Next 24 hours</h2>
        <div class="mt-4 flex gap-3 overflow-x-auto pb-2">
          <div v-for="hour in hourlyPreview" :key="hour.time" class="flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-xl border border-outline-gray-2 bg-surface-base p-3 text-center">
            <span class="text-xs text-ink-gray-5">{{ formatHour(hour.time) }}</span>
            <Icon :name="describeWeatherCode(hour.weatherCode).icon" class="size-6 text-ink-gray-7" />
            <span class="text-sm font-medium text-ink-gray-9">{{ formatValue(hour.temperature) }}{{ unit('temperature') }}</span>
            <span class="text-xs text-ink-gray-5">{{ formatValue(hour.precipitation, 1) }} {{ unit('precipitation') }}</span>
          </div>
        </div>
      </section>

      <section class="pt-8" aria-labelledby="weather-daily-heading">
        <h2 id="weather-daily-heading" class="text-lg font-semibold text-ink-gray-9">7-day forecast</h2>
        <ol class="mt-4 divide-y divide-outline-gray-2 rounded-2xl border border-outline-gray-2 bg-surface-base">
          <li v-for="day in dailyPreview" :key="day.date" class="flex flex-wrap items-center gap-3 p-4">
            <span class="w-20 text-sm font-medium text-ink-gray-8">{{ formatDay(day.date) }}</span>
            <Icon :name="describeWeatherCode(day.weatherCode).icon" class="size-6 shrink-0 text-ink-gray-7" />
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-6">{{ describeWeatherCode(day.weatherCode).label }}</span>
            <span v-if="day.precipitationProbabilityMax !== null && day.precipitationProbabilityMax !== undefined" class="text-sm text-ink-gray-5">{{ formatValue(day.precipitationProbabilityMax) }}%</span>
            <span class="text-sm font-medium text-ink-gray-9">{{ formatValue(day.temperatureMax) }}{{ unit('temperature') }} / {{ formatValue(day.temperatureMin) }}{{ unit('temperature') }}</span>
            <span class="w-full text-xs text-ink-gray-5">Sunrise {{ formatHour(day.sunrise) }} · Sunset {{ formatHour(day.sunset) }}</span>
          </li>
        </ol>
      </section>

      <section class="mt-8 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-labelledby="weather-source-heading">
        <h2 id="weather-source-heading" class="text-base font-semibold text-ink-gray-9">Source and freshness</h2>
        <dl class="divide-y divide-outline-gray-2 pt-3">
          <div v-if="forecastStatus" class="flex gap-3 py-3"><dt class="flex-1 text-sm text-ink-gray-6">Forecast status</dt><dd class="text-sm font-medium text-ink-gray-9">{{ forecastStatus }}</dd></div>
          <div v-if="weather.current.value?.time" class="flex gap-3 py-3"><dt class="flex-1 text-sm text-ink-gray-6">Source updated</dt><dd class="text-right text-sm text-ink-gray-8">{{ formatLocalStamp(weather.current.value.time) }}</dd></div>
          <div v-if="weather.forecast.value.providerCheckedAt" class="flex gap-3 py-3"><dt class="flex-1 text-sm text-ink-gray-6">Last checked</dt><dd class="text-right text-sm text-ink-gray-8">{{ formatTimestamp(weather.forecast.value.providerCheckedAt) }}</dd></div>
          <div v-if="weather.snapshotRefreshedAt.value" class="flex gap-3 py-3"><dt class="flex-1 text-sm text-ink-gray-6">Offline copy refreshed</dt><dd class="text-right text-sm text-ink-gray-8">{{ formatTimestamp(weather.snapshotRefreshedAt.value) }}</dd></div>
        </dl>
        <p v-if="weather.forecast.value.forecastNotice" class="border-t border-outline-gray-2 pt-4 text-sm leading-6 text-ink-gray-6">{{ weather.forecast.value.forecastNotice }}</p>
        <a v-if="weather.source.value?.url" class="inline-flex pt-4 text-sm font-medium text-ink-gray-8 underline underline-offset-4" :href="weather.source.value.url" target="_blank" rel="noreferrer">{{ weather.source.value.attribution }}</a>
      </section>
    </div>

    <div v-else class="mt-8 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-8 text-center">
      <Icon :name="weather.loadState.value === 'loading' ? 'lucide-loader' : 'lucide-cloud-sun'" class="size-7 text-ink-gray-5" />
      <p class="pt-4 text-sm font-medium text-ink-gray-8">{{ emptyHeading }}</p>
      <p class="max-w-sm pt-1 text-sm leading-6 text-ink-gray-6">{{ emptyBody }}</p>
      <Button v-if="weather.loadState.value === 'error' && weather.selectedPlace.value" class="mt-4" label="Try again" @click="weather.refresh" />
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useWeather } from '@/tools/weather/useWeather'
import { describeWeatherCode, windCompass } from '@/tools/weather/weatherCodes'

const TOOL_ID = 'weather'
const preferences = useToolboxPreferences()
const weather = useWeather({ preferences })
// A fresh fetch is never called "live"; the honest word is "updated" (mirrors currency §5.9).
const statusLabels = { live: 'updated', cached: 'server cache', stale: 'stale server cache' }
const forecastStatus = computed(() =>
  weather.loadState.value === 'offline' ? 'offline copy' : (statusLabels[weather.forecast.value?.cacheStatus] ?? ''),
)
const currentCondition = computed(() => describeWeatherCode(weather.current.value?.weatherCode))
const windSummary = computed(() => {
  const current = weather.current.value
  if (!current || !Number.isFinite(current.windSpeed)) return '—'
  const base = `${formatValue(current.windSpeed)} ${unit('windSpeed')}`.trim()
  const direction = windCompass(current.windDirection)
  return direction ? `${base} ${direction}` : base
})
const hourlyPreview = computed(() => weather.hourly.value.slice(0, 24))
const dailyPreview = computed(() => weather.daily.value.slice(0, 7))
const emptyHeading = computed(() => {
  if (weather.loadState.value === 'loading') return 'Loading the forecast'
  if (weather.loadState.value === 'error') return 'Forecast unavailable'
  return 'Search for a place'
})
const emptyBody = computed(() => {
  if (weather.loadState.value === 'loading') return 'Fetching current conditions and the forecast.'
  if (weather.loadState.value === 'error') return weather.errorMessage.value || 'Connect to the internet and try again.'
  return 'Type at least two letters to find a city, then select it to see the weather.'
})
const announcement = computed(() => {
  if (weather.searchError.value) return weather.searchError.value
  if (weather.errorMessage.value) return weather.errorMessage.value
  if (weather.loadState.value === 'loading') return 'Loading the forecast.'
  if (weather.forecast.value && weather.selectedPlace.value && forecastStatus.value) return `${weather.selectedPlace.value.name} forecast ${forecastStatus.value}.`
  return ''
})

const isPlaceSaved = computed(() => {
  const place = weather.selectedPlace.value
  return !!place && preferences.savedWeatherLocations.value.some((saved) => placeKey(saved) === placeKey(place))
})

function toggleSavedPlace() {
  const place = weather.selectedPlace.value
  if (!place) return
  const key = placeKey(place)
  const existing = preferences.savedWeatherLocations.value
  preferences.setSavedWeatherLocations(
    isPlaceSaved.value
      ? existing.filter((saved) => placeKey(saved) !== key)
      : [...existing, savablePlace(place)],
  )
}

function savablePlace(place) {
  return {
    id: place.id,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    country: place.country,
    countryCode: place.countryCode,
    admin1: place.admin1,
    timezone: place.timezone,
  }
}

onMounted(async () => {
  preferences.recordRecent(TOOL_ID)
  if (weather.selectedPlace.value) await weather.refresh()
})

function placeKey(place) { return place.id ?? `${place.latitude}:${place.longitude}` }
function placeRegion(place) { return [place.admin1, place.country].filter(Boolean).join(', ') }
function unit(key) { return weather.units.value?.[key] ?? '' }

function formatValue(value, digits = 0) {
  if (!Number.isFinite(value)) return '—'
  return digits > 0 ? value.toFixed(digits).replace(/\.0+$/, '') : String(Math.round(value))
}

// Provider times are already local to the place and carry no offset, so read the clock parts from the
// string rather than reinterpreting them in the browser's zone.
function formatHour(value) {
  const match = /T(\d{2}):(\d{2})/.exec(value ?? '')
  if (!match) return ''
  const hour = Number(match[1])
  if (preferences.settings.timeFormat === '24-hour') return `${match[1]}:${match[2]}`
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatDay(value) {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

function formatLocalStamp(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? '')
  if (!match) return ''
  const time = formatHour(value)
  return time ? `${formatDay(match[1])}, ${time}` : formatDay(match[1])
}

function formatTimestamp(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : ''
}
</script>
