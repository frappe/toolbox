import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import {
  describeZonedTime,
  isWithinWorkingHours,
  localTimeZone,
  searchTimeZones,
  selectedInstant,
  zoneLabel,
} from './worldClock'

const DEFAULT_ZONES = ['Asia/Kolkata', 'Europe/London', 'America/New_York']
const MAX_LOCATIONS = 12

export function useWorldClock({ now = () => new Date() } = {}) {
  const preferences = useToolboxPreferences()
  const clock = ref(now())
  const query = ref('')
  const offsetHours = ref(0)
  const workingStart = ref(9)
  const workingEnd = ref(17)
  let intervalId = null

  ensureLocations(preferences)

  const locations = preferences.savedWorldClockLocations
  const selectedTime = computed(() => selectedInstant(clock.value, offsetHours.value))
  const searchResults = computed(() => searchTimeZones(query.value).filter(
    ({ zone }) => !locations.value.some((location) => location.zone === zone),
  ))
  const rows = computed(() => locations.value.map((location) => {
    const description = describeZonedTime(selectedTime.value, location.zone)
    return {
      ...location,
      ...description,
      withinWorkingHours: isWithinWorkingHours(description, workingStart.value, workingEnd.value),
    }
  }))
  const hasSharedWorkingTime = computed(() => (
    rows.value.length > 1 && rows.value.every(({ withinWorkingHours }) => withinWorkingHours)
  ))

  onMounted(() => {
    intervalId = globalThis.setInterval(() => { clock.value = now() }, 30_000)
  })
  onBeforeUnmount(() => globalThis.clearInterval(intervalId))

  function addLocation(result) {
    if (!result?.zone || locations.value.length >= MAX_LOCATIONS) return
    if (locations.value.some(({ zone }) => zone === result.zone)) return
    save([...locations.value, { zone: result.zone, label: result.label || zoneLabel(result.zone), favourite: false }])
    query.value = ''
  }

  function removeLocation(zone) {
    if (locations.value.length === 1) return
    save(locations.value.filter((location) => location.zone !== zone))
  }

  function moveLocation(index, direction) {
    const target = index + direction
    if (target < 0 || target >= locations.value.length) return
    const next = [...locations.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    save(next)
  }

  function toggleFavourite(zone) {
    save(locations.value.map((location) => (
      location.zone === zone ? { ...location, favourite: !location.favourite } : location
    )))
  }

  function save(next) {
    preferences.setSavedWorldClockLocations(next)
  }

  return {
    query,
    offsetHours,
    workingStart,
    workingEnd,
    locations,
    selectedTime,
    searchResults,
    rows,
    hasSharedWorkingTime,
    addLocation,
    removeLocation,
    moveLocation,
    toggleFavourite,
  }
}

function ensureLocations(preferences) {
  if (preferences.savedWorldClockLocations.value.length) return
  const zones = [...new Set([localTimeZone(), ...DEFAULT_ZONES])]
  preferences.setSavedWorldClockLocations(zones.map((zone, index) => ({
    zone,
    label: zoneLabel(zone),
    favourite: index === 0,
  })))
}
