<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="max-w-2xl">
      <p class="text-sm font-medium text-ink-gray-5">Frappe Toolbox</p>
      <h1 class="pt-2 text-3xl font-semibold tracking-tight text-ink-gray-9 sm:text-4xl">
        Everything useful, in one place.
      </h1>
      <p class="pt-3 text-base leading-7 text-ink-gray-6">
        Calculate, convert, compare, and look things up without jumping between websites.
      </p>
      <Button
        class="mt-6"
        label="Search tools"
        variant="solid"
        icon-left="lucide-search"
        @click="openSearch"
      />
    </header>

    <div class="grid grid-cols-[minmax(0,1fr)] gap-10 pt-12 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div class="min-w-0 space-y-10">
        <HomeSection v-if="favourites.length" title="Favourites" link-label="View all" link-to="/all-tools">
          <ToolRow v-for="tool in favourites" :key="tool.id" :tool="tool" />
        </HomeSection>

        <HomeSection :title="recentTools.length ? 'Recently used' : 'Start here'">
          <ToolRow v-for="tool in primaryTools" :key="tool.id" :tool="tool" />
        </HomeSection>
      </div>

      <aside class="min-w-0 space-y-4" aria-label="Saved items">
        <div class="rounded-xl bg-surface-gray-1 p-5">
          <div class="flex items-center gap-2">
            <Icon name="lucide-bookmark" class="size-4 text-ink-gray-6" />
            <h2 class="text-sm font-medium text-ink-gray-9">Saved items</h2>
          </div>
          <div v-if="hasSavedItems" class="space-y-5 pt-4">
            <section v-if="savedCurrencyPairs.length" aria-labelledby="saved-currency-title">
              <h3 id="saved-currency-title" class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Currency pairs</h3>
              <div class="flex flex-wrap gap-2 pt-2">
                <RouterLink v-for="pair in savedCurrencyPairs" :key="`${pair.baseCurrency}:${pair.quoteCurrency}`" :to="currencyPairRoute(pair)" class="rounded-lg bg-surface-base px-3 py-2 text-sm font-medium text-ink-gray-8 hover:bg-surface-gray-2">{{ pair.baseCurrency }} → {{ pair.quoteCurrency }}</RouterLink>
              </div>
            </section>
            <section v-if="savedWorldClockLocations.length" aria-labelledby="saved-clock-title">
              <div class="flex items-center justify-between gap-3"><h3 id="saved-clock-title" class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">World Clock</h3><RouterLink to="/world-clock" class="text-xs font-medium text-ink-gray-6 underline underline-offset-2">Open planner</RouterLink></div>
              <ul class="space-y-2 pt-2">
                <li v-for="location in savedWorldClockLocations" :key="location.zone" class="flex items-center gap-2 text-sm text-ink-gray-7"><Icon v-if="location.favourite" name="lucide-star" class="size-3.5 fill-current text-ink-yellow-2" /><span class="min-w-0 truncate">{{ location.label || location.zone }}</span></li>
              </ul>
            </section>
            <section v-if="savedWeatherLocations.length" aria-labelledby="saved-weather-title">
              <div class="flex items-center justify-between gap-3"><h3 id="saved-weather-title" class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Weather</h3><RouterLink to="/weather" class="text-xs font-medium text-ink-gray-6 underline underline-offset-2">Open weather</RouterLink></div>
              <ul class="space-y-2 pt-2">
                <li v-for="place in savedWeatherLocations" :key="place.id ?? `${place.latitude}:${place.longitude}`" class="flex items-center gap-2 text-sm text-ink-gray-7"><Icon name="lucide-cloud-sun" class="size-3.5 text-ink-gray-5" /><span class="min-w-0 truncate">{{ place.name }}</span></li>
              </ul>
            </section>
          </div>
          <p v-else class="pt-3 text-sm leading-6 text-ink-gray-5">Save a currency pair, World Clock location, or weather place to keep it close at hand.</p>
        </div>
        <div class="rounded-xl border border-dashed border-outline-gray-3 p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">
            {{ privacyNote.title }}
          </p>
          <p class="pt-2 text-sm leading-6 text-ink-gray-6">
            {{ privacyNote.description }}
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Button, Icon } from 'frappe-ui'

import HomeSection from '@/components/home/HomeSection.vue'
import ToolRow from '@/components/tools/ToolRow.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { tools, toolsById } from '@/data/toolRegistry'

const preferences = useToolboxPreferences()
const openSearch = inject('openToolSearch', () => {})
const favourites = computed(() => resolveTools(preferences.favouriteIds.value).slice(0, 4))
const recentTools = computed(() => resolveTools(preferences.recentToolIds.value).slice(0, 4))
const savedCurrencyPairs = computed(() => preferences.savedCurrencyPairs.value.slice(0, 6))
const savedWorldClockLocations = computed(() => (
  preferences.savedWorldClockLocations.value
    .filter(({ zone }) => typeof zone === 'string' && zone)
    .sort((left, right) => Number(Boolean(right.favourite)) - Number(Boolean(left.favourite)))
    .slice(0, 6)
))
const savedWeatherLocations = computed(() => (
  preferences.savedWeatherLocations.value
    .filter((place) => place && typeof place.name === 'string' && place.name)
    .slice(0, 6)
))
const hasSavedItems = computed(() => savedCurrencyPairs.value.length || savedWorldClockLocations.value.length || savedWeatherLocations.value.length)
const privacyNote = computed(() => {
  if (preferences.mode.value === 'frappe') {
    if (preferences.syncError.value) {
      return {
        title: 'Account sync unavailable',
        description:
          'Preference changes may remain only in this tab until you reconnect. Calculator and health inputs still stay private.',
      }
    }
    return {
      title: preferences.isSaving.value ? 'Syncing preferences' : 'Preferences synced',
      description:
        'Favourites and settings follow your Frappe account. Calculator and health inputs stay private in this browser.',
    }
  }
  if (preferences.mode.value === 'memory') {
    return {
      title: 'Private this session',
      description:
        'Preferences last until this tab closes. Calculator and health inputs are not sent to the server.',
    }
  }
  return {
    title: 'Local by default',
    description:
      'Preferences, calculator inputs, and health inputs stay in this browser while you are a guest.',
  }
})
const starters = tools.filter((tool) => ['calculator', 'unit-converter', 'gst-calculator', 'timer'].includes(tool.id))
const primaryTools = computed(() => (recentTools.value.length ? recentTools.value : starters))

function resolveTools(ids) {
  return ids.map((id) => toolsById.get(id)).filter(Boolean)
}

function currencyPairRoute(pair) {
  return {
    path: '/currency-converter',
    query: { from: pair.baseCurrency, to: pair.quoteCurrency },
  }
}
</script>
