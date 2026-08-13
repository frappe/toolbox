<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-globe-2" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">{{ tool.name }}</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">{{ tool.description }}</p>
      </div>
    </header>

    <div v-if="clock.mode.value === 'convert'" class="mt-8 grid gap-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:grid-cols-2">
      <FormControl type="datetime" size="md" label="Date and time" :model-value="clock.convertDateTime.value" @update:model-value="setConvertDateTime" />
      <FormControl type="select" size="md" label="In this city's time" :options="zoneOptions" :model-value="clock.convertZone.value" @update:model-value="clock.convertZone.value = $event" />
      <p class="text-sm leading-6 text-ink-gray-5 sm:col-span-2">The cards below show that exact moment in every city.</p>
    </div>

    <div class="pt-8">
      <div class="max-w-xl">
        <SearchSelect
          size="lg"
          label="Add a city or time zone"
          placeholder="Mumbai, London, New York"
          results-label="Time zone search results"
          option-key-field="id"
          :results="clock.searchResults.value"
          :model-value="clock.query.value"
          @update:model-value="clock.query.value = $event"
          @select="clock.addLocation($event)"
        >
          <template #option="{ result }">
            <span class="flex items-center justify-between gap-4">
              <span class="font-medium text-ink-gray-8">{{ result.label }}</span>
              <span class="truncate text-sm text-ink-gray-5">{{ result.region }}</span>
            </span>
          </template>
        </SearchSelect>
      </div>
    </div>

    <section class="pt-8" aria-labelledby="locations-title">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 id="locations-title" class="text-lg font-semibold text-ink-gray-9">Locations</h2>
        <Button class="h-11" variant="subtle" icon-left="lucide-copy" label="Copy times" @click="copyMeetingTimes" />
      </div>

      <ol class="grid gap-4 pt-5 md:grid-cols-2">
        <li v-for="(row, index) in clock.rows.value" :key="row.id" class="rounded-2xl border border-outline-gray-2 bg-surface-base p-5">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2"><h3 class="truncate font-semibold text-ink-gray-9">{{ row.label }}</h3><Icon v-if="row.favourite" name="lucide-star" class="size-4 fill-current text-ink-yellow-2" /></div>
              <p class="truncate pt-1 text-sm text-ink-gray-5">{{ row.zone }}</p>
            </div>
            <div class="flex gap-1">
              <Button variant="ghost" icon="lucide-arrow-up" :disabled="index === 0" :aria-label="`Move ${row.label} up`" @click="clock.moveLocation(index, -1)" />
              <Button variant="ghost" icon="lucide-arrow-down" :disabled="index === clock.rows.value.length - 1" :aria-label="`Move ${row.label} down`" @click="clock.moveLocation(index, 1)" />
              <Button variant="ghost" icon="lucide-star" :aria-label="`${row.favourite ? 'Unfavourite' : 'Favourite'} ${row.label}`" @click="clock.toggleFavourite(row.id)" />
              <Button variant="ghost" icon="lucide-x" :disabled="clock.rows.value.length === 1" :aria-label="`Remove ${row.label}`" @click="clock.removeLocation(row.id)" />
            </div>
          </div>
          <p class="pt-5 font-mono text-3xl font-semibold tracking-tight text-ink-gray-9">{{ formatTime(row) }}</p>
          <p class="pt-1 text-sm text-ink-gray-7">{{ formatDate(row) }} · {{ dayLabel(row.dayDifference) }}</p>
          <div class="flex flex-wrap gap-2 pt-4">
            <Badge theme="gray" variant="subtle" size="sm" :label="row.offsetLabel" />
            <Badge theme="gray" variant="subtle" size="sm" :label="row.daylightSaving ? 'Daylight saving time' : 'Standard time'" />
          </div>
        </li>
      </ol>
    </section>

    <p class="pt-6 text-sm text-ink-gray-5">Time-zone identifiers and daylight-saving rules come from the browser’s IANA time-zone data. Core use stays in this browser and works offline.</p>
    <p class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, Button, FormControl, Icon } from 'frappe-ui'

import SearchSelect from '@/components/search/SearchSelect.vue'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useWorldClock } from '@/tools/world-clock/useWorldClock'
import { getToolCategoryName } from '@/data/toolRegistry'

// Two tools, one view. World Clock reads the current time and Time Zone Converter reads a chosen
// one, over the same list of cities: a city added on either page is there on the other. The mode
// used to be a tab, which had no URL, so "time zone converter" could not be searched for.
const { tool, variant } = useToolFamily()
const preferences = useToolboxPreferences()
const clock = useWorldClock()
const copyStatus = ref('')
const categoryName = computed(() => getToolCategoryName(tool.value?.id))

// Zone picker over the cities already added (label shown, IANA zone stored).
const zoneOptions = computed(() => clock.locations.value.map((location) => ({ label: location.label, value: location.zone })))

// A move between the two does not remount this view, so the mode and the recent tool follow the
// route rather than the mount.
watch(variant, (mode) => {
  if (mode === 'convert' && !clock.convertDateTime.value) {
    clock.convertDateTime.value = currentLocalDateTime()
  }
  clock.mode.value = mode
}, { immediate: true })
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })

// DateTimePicker emits "YYYY-MM-DD HH:mm:ss"; the converter parses a datetime-local
// string ("YYYY-MM-DDTHH:mm"), so normalise before storing.
function setConvertDateTime(value) {
  clock.convertDateTime.value = value ? String(value).replace(' ', 'T').slice(0, 16) : ''
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
