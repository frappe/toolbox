<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-clock-arrow-up"
      :category="categoryName"
      title="Time Zone Converter"
      description="Take one date and time and read it in every city at once."
    />

    <div class="mt-8 grid gap-4 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:grid-cols-2">
      <FormControl type="datetime" size="md" label="Date and time" :model-value="converter.convertDateTime.value" @update:model-value="setConvertDateTime" />
      <FormControl type="select" size="md" label="In this city's time" :options="zoneOptions" :model-value="converter.convertZone.value" @update:model-value="converter.convertZone.value = $event" />
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
          :results="converter.searchResults.value"
          :model-value="converter.query.value"
          @update:model-value="converter.query.value = $event"
          @select="converter.addLocation($event)"
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
        <Button size="md" variant="subtle" icon-left="lucide-copy" label="Copy times" @click="copyMeetingTimes" />
      </div>

      <ol class="grid gap-4 pt-5 md:grid-cols-2">
        <li v-for="(row, index) in converter.rows.value" :key="row.id" class="rounded-2xl border border-outline-gray-2 bg-surface-base p-5">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="truncate font-semibold text-ink-gray-9">{{ row.label }}</h3>
              <p class="truncate pt-1 text-sm text-ink-gray-5">{{ row.zone }}</p>
            </div>
            <div class="flex gap-1">
              <Button variant="ghost" icon="lucide-arrow-up" :disabled="index === 0" :aria-label="`Move ${row.label} up`" @click="converter.moveLocation(index, -1)" />
              <Button variant="ghost" icon="lucide-arrow-down" :disabled="index === converter.rows.value.length - 1" :aria-label="`Move ${row.label} down`" @click="converter.moveLocation(index, 1)" />
              <Button variant="ghost" icon="lucide-x" :disabled="converter.rows.value.length === 1" :aria-label="`Remove ${row.label}`" @click="converter.removeLocation(row.id)" />
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
import { computed, onMounted, ref } from 'vue'
import { Badge, Button, FormControl } from 'frappe-ui'

import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import SearchSelect from '@/components/search/SearchSelect.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useTimeZoneConverter } from '@/tools/time-zone-converter/useTimeZoneConverter'
import { getToolCategoryName } from '@/data/toolRegistry'

const TOOL_ID = 'time-zone-converter'

const preferences = useToolboxPreferences()
const converter = useTimeZoneConverter()
const copyStatus = ref('')
const categoryName = getToolCategoryName(TOOL_ID)

// Zone picker over the cities already added (label shown, IANA zone stored).
const zoneOptions = computed(() => converter.locations.value.map((location) => ({ label: location.label, value: location.zone })))

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  // Arriving on an empty field would read every city at the moment the page opened, with nothing
  // saying so. Seeding it to now makes the answer on screen match the question in the field.
  if (!converter.convertDateTime.value) converter.convertDateTime.value = currentLocalDateTime()
})

// DateTimePicker emits "YYYY-MM-DD HH:mm:ss"; the converter parses a datetime-local
// string ("YYYY-MM-DDTHH:mm"), so normalise before storing.
function setConvertDateTime(value) {
  converter.convertDateTime.value = value ? String(value).replace(' ', 'T').slice(0, 16) : ''
}

function currentLocalDateTime() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function formatTime(row) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: row.zone, hour: '2-digit', minute: '2-digit', hour12: preferences.settings.timeFormat === '12-hour' }).format(converter.selectedTime.value)
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
  const summary = converter.rows.value.map((row) => `${row.label}: ${formatDate(row)} ${formatTime(row)} (${row.offsetLabel})`).join('\n')
  try {
    await navigator.clipboard.writeText(summary)
    copyStatus.value = 'Times copied.'
  } catch {
    copyStatus.value = 'Copy is unavailable in this browser.'
  }
}
</script>
