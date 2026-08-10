<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2"><Icon name="lucide-badge-dollar-sign" class="size-6 text-ink-gray-7" /></span>
      <div class="min-w-0 flex-1"><p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p><h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">Currency Converter</h1><p class="pt-2 text-base leading-7 text-ink-gray-6">Convert locally with dated European Central Bank reference rates.</p></div>
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div class="min-w-0">
        <section class="rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-5 sm:p-6" aria-labelledby="currency-input-heading">
          <div class="flex items-start justify-between gap-4"><div><h2 id="currency-input-heading" class="text-lg font-semibold text-ink-gray-9">Convert an amount</h2><p class="pt-1 text-sm leading-6 text-ink-gray-6">Your amount and selected currencies stay in this browser.</p></div><Button label="Refresh rates" variant="ghost" icon-left="lucide-refresh-cw" :loading="['loading', 'refreshing'].includes(converter.loadState.value)" @click="converter.loadRates" /></div>

          <div class="grid items-end gap-3 pt-6 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <FormControl class="[&_input]:tabular-nums" type="number" size="lg" variant="outline" label="Amount" :model-value="converter.sourceInput.value" min="0" max="1000000000000000" step="any" inputmode="decimal" aria-label="Source amount" aria-describedby="currency-feedback" @update:model-value="converter.updateSourceAmount" @change="converter.recordHistory()" />
            <CurrencyPicker v-model="converter.sourceCurrency.value" label="Source currency" picker-id="source-currency" :currencies="converter.currencies.value" />
          </div>

          <div class="flex justify-center py-2"><Button class="size-11" variant="subtle" icon="lucide-arrow-up-down" aria-label="Swap source and destination currencies" @click="converter.swapCurrencies" /></div>

          <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
            <FormControl class="[&_input]:tabular-nums" type="number" size="lg" variant="outline" label="Converts to" :model-value="converter.destinationInput.value" min="0" max="1000000000000000" step="any" inputmode="decimal" aria-label="Destination amount" @update:model-value="converter.updateDestinationAmount" @change="converter.recordHistory()" />
            <CurrencyPicker v-model="converter.destinationCurrency.value" label="Destination currency" picker-id="destination-currency" :currencies="converter.currencies.value" />
          </div>

          <div id="currency-feedback" class="pt-4"><ErrorMessage v-if="converter.amountError.value" :message="converter.amountError.value" /><Alert v-else-if="converter.errorMessage.value" theme="yellow" :dismissible="false" :title="converter.errorMessage.value" /><p v-else class="text-sm text-ink-gray-5">Type in either box — the other updates using the dated reference rate.</p></div>

          <div class="flex flex-wrap gap-2 pt-5"><Button :label="converter.isPairSaved.value ? 'Saved pair' : 'Save pair'" icon-left="lucide-star" variant="subtle" :disabled="!converter.rateData.value" @click="converter.toggleSavedPair" /><Button label="Copy" variant="subtle" icon-left="lucide-copy" :disabled="converter.convertedAmount.value === null" @click="converter.copyResult()" /></div>

          <div v-if="converter.savedPairs.value.length" class="pt-6"><h3 class="text-sm font-medium text-ink-gray-8">Saved pairs</h3><div class="flex flex-wrap gap-2 pt-2"><Button v-for="pair in converter.savedPairs.value" :key="`${pair.baseCurrency}:${pair.quoteCurrency}`" variant="subtle" :label="`${pair.baseCurrency} → ${pair.quoteCurrency}`" @click="converter.usePair(pair)" /></div></div>
        </section>

        <div v-if="converter.rateData.value" class="mt-6 space-y-2 text-sm leading-6 text-ink-gray-5">
          <!-- The content below the tool explains what each rate state means, so it carries the
               same words. A test needs this line, not any line that says them. -->
          <p data-testid="rate-state">
            Rate date <span class="font-medium text-ink-gray-7">{{ converter.rateData.value.rateDate }}</span>
            · <span class="capitalize">{{ rateStatus }}</span>
            · Server checked {{ formatTimestamp(converter.rateData.value.providerCheckedAt) }}
            <template v-if="converter.snapshotRefreshedAt.value"> · Offline snapshot {{ formatTimestamp(converter.snapshotRefreshedAt.value) }}</template>
          </p>
          <p>ECB reference rates are for information only and are not transaction rates.</p>
          <a class="inline-flex font-medium text-ink-gray-8 underline underline-offset-4" :href="converter.rateData.value.source.url" target="_blank" rel="noreferrer">Source: ECB statistics</a>
        </div>
      </div>

      <aside class="min-w-0 lg:sticky lg:top-6">
        <ToolHistory
          :entries="converter.historyEntries.value"
          :copied-entry-id="copiedHistoryId"
          list-label="Currency conversion history"
          clear-label="Clear currency history"
          empty-title="No conversions yet"
          empty-description="Converted amounts you copy or commit appear here."
          reuse-title="Reuse this conversion"
          @reuse="converter.reuseHistory"
          @copy="copyHistoryEntry"
          @remove="converter.removeHistory"
          @clear="converter.clearHistory"
        />
      </aside>
    </div>

    <div class="pt-8">
      <RateChart
        :series="rateChart.series.value"
        :range="rateChart.range.value"
        :ranges="RATE_CHART_RANGES"
        :state="rateChart.state.value"
        :error-message="rateChart.errorMessage.value"
        :base="converter.sourceCurrency.value"
        :quote="converter.destinationCurrency.value"
        @set-range="rateChart.setRange"
        @retry="rateChart.retry"
      />
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ converter.copyStatus.value }}</p>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { Alert, Button, ErrorMessage, FormControl, Icon } from 'frappe-ui'
import { useRoute } from 'vue-router'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import CurrencyPicker from '@/tools/currency-converter/CurrencyPicker.vue'
import RateChart from '@/tools/currency-converter/RateChart.vue'
import { RATE_CHART_RANGES } from '@/tools/currency-converter/rateHistory'
import { useRateChart } from '@/tools/currency-converter/useRateChart'
import { useCurrencyConverter } from '@/tools/currency-converter/useCurrencyConverter'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('currency-converter')
const preferences = useToolboxPreferences(), converter = useCurrencyConverter({ preferences }), route = useRoute()
const rateChart = useRateChart({ base: converter.sourceCurrency, quote: converter.destinationCurrency })
const copiedHistoryId = ref('')
// ECB reference rates are never described as "live" (spec §5.9); a fresh fetch reads "updated".
const rateStatusLabels = { live: 'updated', cached: 'server cache', stale: 'stale server cache' }
const rateStatus = computed(() =>
  converter.loadState.value === 'offline'
    ? 'offline snapshot'
    : (rateStatusLabels[converter.rateData.value?.cacheStatus] ?? ''),
)
function formatTimestamp(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not checked' }
async function copyHistoryEntry(entry) {
  try {
    await globalThis.navigator?.clipboard?.writeText(entry.value)
    copiedHistoryId.value = entry.id
  } catch {
    copiedHistoryId.value = ''
  }
}
onMounted(async () => {
  preferences.recordRecent('currency-converter')
  await converter.loadRates()
  converter.usePair({ baseCurrency: route.query.from, quoteCurrency: route.query.to })
  rateChart.load()
})
</script>
