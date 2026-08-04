import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import {
  describeZonedTime,
  localTimeZone,
  locationKey,
  parseDateTimeLocal,
  searchTimeZones,
  zonedWallTimeToInstant,
  zoneLabel,
} from './worldClock'
import { canonicalizeZone } from './worldClockCities'

const DEFAULT_ZONES = ['Asia/Kolkata', 'Europe/London', 'America/New_York']
const MAX_LOCATIONS = 12

export function useWorldClock({ now = () => new Date() } = {}) {
  const preferences = useToolboxPreferences()
  const clock = ref(now())
  const query = ref('')
  const mode = ref('clocks') // 'clocks' = current time · 'convert' = a chosen date/time
  const convertDateTime = ref('') // datetime-local string, interpreted in convertZone
  const convertZone = ref(canonicalizeZone(localTimeZone()))
  let intervalId = null

  ensureLocations(preferences)

  const savedLocations = preferences.savedWorldClockLocations
  // A location keeps a friendly label (e.g. "Pune") alongside its canonical zone.
  // Legacy saved rows without an id get a deterministic one from label + zone.
  const locations = computed(() => savedLocations.value.map((location) => ({
    ...location,
    id: location.id ?? locationKey(location.label ?? zoneLabel(location.zone), location.zone),
  })))
  // "Clocks" shows the current time; "Convert" shows a chosen wall-clock time (in
  // convertZone) as the equivalent instant across every location.
  const selectedTime = computed(() => {
    if (mode.value === 'convert') {
      const parts = parseDateTimeLocal(convertDateTime.value)
      if (parts) return zonedWallTimeToInstant(parts, convertZone.value)
    }
    return clock.value
  })
  const searchResults = computed(() => searchTimeZones(query.value).filter(
    (result) => !locations.value.some((location) => location.id === result.id),
  ))
  const rows = computed(() => locations.value.map((location) => {
    const description = describeZonedTime(selectedTime.value, location.zone)
    // Spread the location last so its friendly label wins over the zone-derived one.
    return { ...description, ...location }
  }))

  onMounted(() => {
    intervalId = globalThis.setInterval(() => { clock.value = now() }, 30_000)
  })
  onBeforeUnmount(() => globalThis.clearInterval(intervalId))

  function addLocation(result) {
    if (!result?.zone || locations.value.length >= MAX_LOCATIONS) return
    const label = result.label || zoneLabel(result.zone)
    const id = result.id ?? locationKey(label, result.zone)
    if (locations.value.some((location) => location.id === id)) return
    save([...locations.value, { id, zone: result.zone, label, favourite: false }])
    query.value = ''
  }

  function removeLocation(id) {
    if (locations.value.length === 1) return
    save(locations.value.filter((location) => location.id !== id))
  }

  function moveLocation(index, direction) {
    const target = index + direction
    if (target < 0 || target >= locations.value.length) return
    const next = [...locations.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    save(next)
  }

  function toggleFavourite(id) {
    save(locations.value.map((location) => (
      location.id === id ? { ...location, favourite: !location.favourite } : location
    )))
  }

  function save(next) {
    preferences.setSavedWorldClockLocations(next.map((location) => ({
      id: location.id ?? locationKey(location.label ?? zoneLabel(location.zone), location.zone),
      zone: location.zone,
      label: location.label ?? zoneLabel(location.zone),
      favourite: Boolean(location.favourite),
    })))
  }

  return {
    query,
    mode,
    convertDateTime,
    convertZone,
    locations,
    selectedTime,
    searchResults,
    rows,
    addLocation,
    removeLocation,
    moveLocation,
    toggleFavourite,
  }
}

function ensureLocations(preferences) {
  if (preferences.savedWorldClockLocations.value.length) return
  const zones = [...new Set([localTimeZone(), ...DEFAULT_ZONES].map(canonicalizeZone))]
  preferences.setSavedWorldClockLocations(zones.map((zone, index) => ({
    id: locationKey(zoneLabel(zone), zone),
    zone,
    label: zoneLabel(zone),
    favourite: index === 0,
  })))
}
