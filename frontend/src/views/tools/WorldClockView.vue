<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-globe-2" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Time</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">World Clock</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">See the current time across the cities you care about.</p>
      </div>
    </header>

    <div class="mt-8 inline-flex gap-1 rounded-lg bg-surface-gray-2 p-1" role="tablist" aria-label="World clock mode">
      <button v-for="tab in modeTabs" :key="tab.id" type="button" role="tab" class="h-9 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" :class="clock.mode.value === tab.id ? 'bg-surface-base text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-9'" :aria-selected="clock.mode.value === tab.id" :data-mode="tab.id" @click="setMode(tab.id)">{{ tab.label }}</button>
    </div>

    <div v-if="clock.mode.value === 'convert'" class="mt-5 grid gap-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:grid-cols-2">
      <label class="grid gap-2 text-sm font-medium text-ink-gray-7">Date and time
        <input v-model="clock.convertDateTime.value" type="datetime-local" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9" />
      </label>
      <label class="grid gap-2 text-sm font-medium text-ink-gray-7">In this city's time
        <select v-model="clock.convertZone.value" class="h-11 rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-8">
          <option v-for="location in clock.locations.value" :key="location.id" :value="location.zone">{{ location.label }}</option>
        </select>
      </label>
      <p class="text-sm leading-6 text-ink-gray-5 sm:col-span-2">The cards below show that exact moment in every city.</p>
    </div>

    <div class="pt-8">
      <label for="zone-search" class="block text-sm font-medium text-ink-gray-7">Add a city or time zone</label>
      <div class="relative mt-2 max-w-xl">
        <input id="zone-search" v-model="clock.query.value" class="h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9" type="search" autocomplete="off" placeholder="Mumbai, London, New York" />
        <ul v-if="clock.searchResults.value.length" class="absolute z-10 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-gray-2 bg-surface-base p-2 shadow-lg" aria-label="Time zone search results">
          <li v-for="result in clock.searchResults.value" :key="result.id">
            <button type="button" class="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left hover:bg-surface-gray-2" @click="clock.addLocation(result)"><span class="font-medium text-ink-gray-8">{{ result.label }}</span><span class="truncate text-sm text-ink-gray-5">{{ result.region }}</span></button>
          </li>
        </ul>
      </div>
    </div>

    <section class="pt-8" aria-labelledby="locations-title">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 id="locations-title" class="text-lg font-semibold text-ink-gray-9">Locations</h2>
        <Button class="h-11" variant="subtle" icon="lucide-copy" label="Copy times" @click="copyMeetingTimes" />
      </div>

      <ol class="grid gap-4 pt-5 md:grid-cols-2">
        <li v-for="(row, index) in clock.rows.value" :key="row.id" class="rounded-2xl border border-outline-gray-2 bg-surface-base p-5">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2"><h3 class="truncate font-semibold text-ink-gray-9">{{ row.label }}</h3><Icon v-if="row.favourite" name="lucide-star" class="size-4 fill-current text-ink-yellow-2" /></div>
              <p class="truncate pt-1 text-sm text-ink-gray-5">{{ row.zone }}</p>
            </div>
            <div class="flex gap-1">
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="index === 0" :aria-label="`Move ${row.label} up`" @click="clock.moveLocation(index, -1)"><Icon name="lucide-arrow-up" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="index === clock.rows.value.length - 1" :aria-label="`Move ${row.label} down`" @click="clock.moveLocation(index, 1)"><Icon name="lucide-arrow-down" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2" :aria-label="`${row.favourite ? 'Unfavourite' : 'Favourite'} ${row.label}`" @click="clock.toggleFavourite(row.id)"><Icon name="lucide-star" class="size-4" /></button>
              <button type="button" class="flex size-10 items-center justify-center rounded-lg hover:bg-surface-gray-2 disabled:opacity-40" :disabled="clock.rows.value.length === 1" :aria-label="`Remove ${row.label}`" @click="clock.removeLocation(row.id)"><Icon name="lucide-x" class="size-4" /></button>
            </div>
          </div>
          <p class="pt-5 font-mono text-3xl font-semibold tracking-tight text-ink-gray-9">{{ formatTime(row) }}</p>
          <p class="pt-1 text-sm text-ink-gray-7">{{ formatDate(row) }} · {{ dayLabel(row.dayDifference) }}</p>
          <div class="flex flex-wrap gap-2 pt-4 text-xs"><span class="rounded-md bg-surface-gray-2 px-2 py-1 text-ink-gray-7">{{ row.offsetLabel }}</span><span class="rounded-md bg-surface-gray-2 px-2 py-1 text-ink-gray-7">{{ row.daylightSaving ? 'Daylight saving time' : 'Standard time' }}</span></div>
        </li>
      </ol>
    </section>

    <p class="pt-6 text-sm text-ink-gray-5">Time-zone identifiers and daylight-saving rules come from the browser’s IANA time-zone data. Core use stays in this browser and works offline.</p>
    <p class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useWorldClock } from '@/tools/world-clock/useWorldClock'

const TOOL_ID = 'world-clock'
const preferences = useToolboxPreferences()
const clock = useWorldClock()
const copyStatus = ref('')
const modeTabs = [
  { id: 'clocks', label: 'Clocks' },
  { id: 'convert', label: 'Time converter' },
]

onMounted(() => preferences.recordRecent(TOOL_ID))

function setMode(id) {
  if (id === 'convert' && !clock.convertDateTime.value) {
    clock.convertDateTime.value = currentLocalDateTime()
  }
  clock.mode.value = id
}

function currentLocalDateTime() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function formatTime(row) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: row.zone, hour: '2-digit', minute: '2-digit', hour12: preferences.settings.timeFormat === '12-hour' }).format(clock.selectedTime.value)
}

function formatDate(row) {
  const parts = { day: String(row.day).padStart(2, '0'), month: String(row.month).padStart(2, '0'), year: row.year }
  if (preferences.settings.dateFormat === 'MM/DD/YYYY') return `${parts.month}/${parts.day}/${parts.year}`
  if (preferences.settings.dateFormat === 'YYYY-MM-DD') return `${parts.year}-${parts.month}-${parts.day}`
  return `${parts.day}/${parts.month}/${parts.year}`
}

function dayLabel(difference) {
  return difference < 0 ? 'Previous day' : difference > 0 ? 'Next day' : 'Same day'
}

async function copyMeetingTimes() {
  const summary = clock.rows.value.map((row) => `${row.label}: ${formatDate(row)} ${formatTime(row)} (${row.offsetLabel})`).join('\n')
  try {
    await navigator.clipboard.writeText(summary)
    copyStatus.value = 'Times copied.'
  } catch {
    copyStatus.value = 'Copy is unavailable in this browser.'
  }
}
</script>
