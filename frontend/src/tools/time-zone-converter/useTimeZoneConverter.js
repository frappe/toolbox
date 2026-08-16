import { computed, ref } from 'vue'

import {
  describeZonedTime,
  localTimeZone,
  locationKey,
  parseDateTimeLocal,
  searchTimeZones,
  zonedWallTimeToInstant,
  zoneLabel,
} from './timeZone'
import { canonicalizeZone } from './timeZoneCities'

const DEFAULT_ZONES = ['Asia/Kolkata', 'Europe/London', 'America/New_York']
const MAX_LOCATIONS = 12

// The list of cities lives for as long as the page is open and no longer. It used to persist,
// until #283 settled that a record of the places a visitor looked at is exactly what this site
// does not keep. Every visit opens on the same set: their own zone first, then three that make
// the tool useful before anything is typed.
export function useTimeZoneConverter({ now = () => new Date() } = {}) {
  const query = ref('')
  const convertZone = ref(canonicalizeZone(localTimeZone()))
  const convertDateTime = ref('') // datetime-local string, interpreted in convertZone
  const locations = ref(defaultLocations())
  // The fallback for an empty date field. A converter reads one chosen moment, so this is fixed
  // at arrival rather than ticking: times that move while they are being read are wrong here.
  const openedAt = now()

  const selectedTime = computed(() => {
    const parts = parseDateTimeLocal(convertDateTime.value)
    return parts ? zonedWallTimeToInstant(parts, convertZone.value) : openedAt
  })
  const searchResults = computed(() => searchTimeZones(query.value).filter(
    (result) => !locations.value.some((location) => location.id === result.id),
  ))
  const rows = computed(() => locations.value.map((location) => {
    const description = describeZonedTime(selectedTime.value, location.zone)
    // Spread the location last so its friendly label wins over the zone-derived one.
    return { ...description, ...location }
  }))

  function addLocation(result) {
    if (!result?.zone || locations.value.length >= MAX_LOCATIONS) return
    const label = result.label || zoneLabel(result.zone)
    const id = result.id ?? locationKey(label, result.zone)
    if (locations.value.some((location) => location.id === id)) return
    locations.value = [...locations.value, { id, zone: result.zone, label }]
    query.value = ''
  }

  function removeLocation(id) {
    if (locations.value.length === 1) return
    locations.value = locations.value.filter((location) => location.id !== id)
  }

  function moveLocation(index, direction) {
    const target = index + direction
    if (target < 0 || target >= locations.value.length) return
    const next = [...locations.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    locations.value = next
  }

  return {
    query,
    convertDateTime,
    convertZone,
    locations,
    selectedTime,
    searchResults,
    rows,
    addLocation,
    removeLocation,
    moveLocation,
  }
}

function defaultLocations() {
  const zones = [...new Set([localTimeZone(), ...DEFAULT_ZONES].map(canonicalizeZone))]
  return zones.map((zone) => ({ id: locationKey(zoneLabel(zone), zone), zone, label: zoneLabel(zone) }))
}
