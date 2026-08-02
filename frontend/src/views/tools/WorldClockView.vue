<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-globe-2" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Time</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">World Clock</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Compare local times and find a shared working-hour window.</p>
      </div>
      <Button variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <section class="grid gap-6 pt-8 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-label="Meeting time controls">
      <div class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5">
        <div class="flex items-center justify-between gap-4">
          <label for="meeting-offset" class="text-sm font-medium text-ink-gray-8">Selected time</label>
          <span class="rounded-lg bg-surface-base px-3 py-1.5 text-sm font-medium text-ink-gray-8">{{ offsetLabel }}</span>
        </div>
        <input id="meeting-offset" v-model.number="clock.offsetHours.value" class="mt-5 w-full accent-gray-900" type="range" min="-12" max="12" step="1" />
        <div class="flex justify-between pt-2 text-xs text-ink-gray-5"><span>12 hours earlier</span><span>Now</span><span>12 hours later</span></div>
      </div>

      <div class="rounded-2xl border border-outline-gray-2 p-5">
        <p class="text-sm font-medium text-ink-gray-8">Shared working hours</p>
        <div class="grid grid-cols-2 gap-3 pt-3">
          <label class="text-xs text-ink-gray-6">Start<select v-model.number="clock.workingStart.value" class="mt-1 h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-8"><option v-for="hour in startHours" :key="hour" :value="hour">{{ hourLabel(hour) }}</option></select></label>
          <label class="text-xs text-ink-gray-6">End<select v-model.number="clock.workingEnd.value" class="mt-1 h-10 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-2 text-sm text-ink-gray-8"><option v-for="hour in endHours" :key="hour" :value="hour">{{ hourLabel(hour) }}</option></select></label>
        </div>
      </div>
    </section>

    <div class="pt-8">
      <label for="zone-search" class="block text-sm font-medium text-ink-gray-7">Add a city or IANA time zone</label>
      <div class="relative mt-2 max-w-xl">
        <input id="zone-search" v-model="clock.query.value" class="h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9" type="search" autocomplete="off" placeholder="Kolkata, London, America/New_York" />
        <ul v-if="clock.searchResults.value.length" class="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-gray-2 bg-surface-base p-2 shadow-lg" aria-label="Time zone search results">
          <li v-for="result in clock.searchResults.value" :key="result.zone">
            <button type="button" class="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-surface-gray-2" @click="clock.addLocation(result)"><span class="font-medium text-ink-gray-8">{{ result.label }}</span><span class="truncate text-sm text-ink-gray-5">{{ result.zone }}</span></button>
          </li>
        </ul>
      </div>
    </div>

    <section class="pt-8" aria-labelledby="locations-title">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="locations-title" class="text-lg font-semibold text-ink-gray-9">Locations</h2>
          <p class="pt-1 text-sm text-ink-gray-6">{{ overlapMessage }}</p>
        </div>
        <Button class="h-11" variant="subtle" icon="lucide-copy" label="Copy meeting times" @click="copyMeetingTimes" />
      </div>

      <ol class="grid gap-4 pt-5 md:grid-cols-2">
        <li v-for="(row, index) in clock.rows.value" :key="row.zone" class="rounded-2xl border p-5" :class="row.withinWorkingHours ? 'border-outline-green-2 bg-surface-green-1' : 'border-outline-gray-2 bg-surface-base'">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2"><h3 class="truncate font-semibold text-ink-gray-9">{{ row.label }}</h3><Icon v-if="row.favourite" name="lucide-star" class="size-4 fill-current text-ink-yellow-2" /></div>
              <p class="truncate pt-1 text-sm text-ink-gray-5">{{ row.zone }}</p>
            </div>
            <div class="flex gap-1">
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="index === 0" :aria-label="`Move ${row.label} up`" @click="clock.moveLocation(index, -1)"><Icon name="lucide-arrow-up" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="index === clock.rows.value.length - 1" :aria-label="`Move ${row.label} down`" @click="clock.moveLocation(index, 1)"><Icon name="lucide-arrow-down" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2" :aria-label="`${row.favourite ? 'Unfavourite' : 'Favourite'} ${row.label}`" @click="clock.toggleFavourite(row.zone)"><Icon name="lucide-star" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="clock.rows.value.length === 1" :aria-label="`Remove ${row.label}`" @click="clock.removeLocation(row.zone)"><Icon name="lucide-x" class="size-4" /></button>
            </div>
          </div>
          <p class="pt-5 font-mono text-3xl font-semibold tracking-tight text-ink-gray-9">{{ formatTime(row) }}</p>
          <p class="pt-1 text-sm text-ink-gray-7">{{ formatDate(row) }} · {{ dayLabel(row.dayDifference) }}</p>
          <div class="flex flex-wrap gap-2 pt-4 text-xs"><span class="rounded-md bg-surface-gray-2 px-2 py-1 text-ink-gray-7">{{ row.offsetLabel }}</span><span class="rounded-md bg-surface-gray-2 px-2 py-1 text-ink-gray-7">{{ row.daylightSaving ? 'Daylight saving time' : 'Standard time' }}</span><span class="rounded-md px-2 py-1" :class="row.withinWorkingHours ? 'bg-surface-green-2 text-ink-green-3' : 'bg-surface-gray-2 text-ink-gray-6'">{{ row.withinWorkingHours ? 'Within working hours' : 'Outside working hours' }}</span></div>
        </li>
      </ol>
    </section>

    <p class="pt-6 text-sm text-ink-gray-5">Time-zone identifiers and daylight-saving rules come from the browser’s IANA time-zone data. Core use stays in this browser and works offline.</p>
    <p class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useWorldClock } from '@/tools/world-clock/useWorldClock'

const TOOL_ID = 'world-clock'
const preferences = useToolboxPreferences()
const clock = useWorldClock()
const copyStatus = ref('')
const startHours = Array.from({ length: 23 }, (_, index) => index)
// End must stay after Start, so the range can never become unsatisfiable.
const endHours = computed(() =>
  Array.from({ length: 23 - clock.workingStart.value }, (_, index) => clock.workingStart.value + 1 + index),
)
watch(
  () => clock.workingStart.value,
  (start) => {
    if (clock.workingEnd.value <= start) clock.workingEnd.value = start + 1
  },
)
const offsetLabel = computed(() => clock.offsetHours.value === 0 ? 'Now' : `${clock.offsetHours.value > 0 ? '+' : '−'}${Math.abs(clock.offsetHours.value)} hours`)
const overlapMessage = computed(() => clock.hasSharedWorkingTime.value ? 'All locations are within the shared working hours.' : 'The selected time is not within working hours for every location.')

onMounted(() => preferences.recordRecent(TOOL_ID))

function formatTime(row) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: row.zone, hour: '2-digit', minute: '2-digit', hour12: preferences.settings.timeFormat === '12-hour' }).format(clock.selectedTime.value)
}

function formatDate(row) {
  const parts = { day: String(row.day).padStart(2, '0'), month: String(row.month).padStart(2, '0'), year: row.year }
  if (preferences.settings.dateFormat === 'MM/DD/YYYY') return `${parts.month}/${parts.day}/${parts.year}`
  if (preferences.settings.dateFormat === 'YYYY-MM-DD') return `${parts.year}-${parts.month}-${parts.day}`
  return `${parts.day}/${parts.month}/${parts.year}`
}

function hourLabel(hour) {
  if (preferences.settings.timeFormat === '24-hour') return `${String(hour).padStart(2, '0')}:00`
  if (hour === 0) return '12:00 AM'
  if (hour === 12) return '12:00 PM'
  return `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
}

function dayLabel(difference) {
  return difference < 0 ? 'Previous day' : difference > 0 ? 'Next day' : 'Same day'
}

async function copyMeetingTimes() {
  const summary = clock.rows.value.map((row) => `${row.label}: ${formatDate(row)} ${formatTime(row)} (${row.offsetLabel})`).join('\n')
  try {
    await navigator.clipboard.writeText(summary)
    copyStatus.value = 'Meeting times copied.'
  } catch {
    copyStatus.value = 'Copy is unavailable in this browser.'
  }
}
</script>
