<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-percent" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">Calculate</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">
          GST Calculator
        </h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">
          Add or remove GST and see the intra-state or inter-state tax split.
        </p>
      </div>
    </header>

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section
        class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-6"
        aria-labelledby="gst-inputs-heading"
      >
        <h2 id="gst-inputs-heading" class="sr-only">GST calculation inputs</h2>

        <fieldset>
          <legend class="text-sm font-medium text-ink-gray-7">Calculation</legend>
          <div class="overflow-x-auto pt-2">
            <TabButtons
              :model-value="calculator.mode.value"
              :options="modeTabs"
              size="md"
              aria-label="Calculation"
              @update:model-value="calculator.setMode"
            />
          </div>
        </fieldset>

        <div class="pt-6">
          <FormControl
            id="gst-amount"
            type="text"
            size="lg"
            variant="outline"
            class="[&_input]:h-12 [&_input]:font-medium [&_input]:tabular-nums"
            :label="calculator.amountLabel.value"
            :model-value="calculator.amountInput.value"
            inputmode="decimal"
            placeholder="0.00"
            aria-describedby="gst-feedback"
            :aria-invalid="Boolean(calculator.errorMessage.value) || undefined"
            @update:model-value="calculator.updateAmount"
            @change="calculator.recordHistory()"
          >
            <template #prefix>
              <span class="text-base text-ink-gray-5">₹</span>
            </template>
          </FormControl>
        </div>

        <fieldset class="pt-5">
          <legend class="text-sm font-medium text-ink-gray-7">Place of supply</legend>
          <div class="overflow-x-auto pt-2">
            <TabButtons
              :model-value="calculator.supplyType.value"
              :options="supplyTabs"
              size="md"
              aria-label="Place of supply"
              @update:model-value="calculator.setSupplyType"
            />
          </div>
        </fieldset>

        <div class="pt-5">
          <GstRatePicker
            :selected-rate-id="calculator.selectedRateId.value"
            :custom-rate-input="calculator.customRateInput.value"
            @select="calculator.selectRate"
            @update:custom-rate-input="calculator.updateCustomRate"
          />
          <Alert
            v-if="calculator.handoffApplied.value"
            class="mt-3"
            theme="blue"
            :dismissible="false"
            title="Rate supplied by HSN lookup."
          />
        </div>

        <div id="gst-feedback" class="pt-4">
          <ErrorMessage v-if="calculator.errorMessage.value" :message="calculator.errorMessage.value" />
          <p v-else-if="calculator.inputHint.value" class="text-sm leading-6 text-ink-gray-5">
            {{ calculator.inputHint.value }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2 pt-5">
          <Button class="h-11" label="Clear" variant="subtle" @click="calculator.clear" />
        </div>
      </section>

      <div class="flex flex-col gap-8 lg:sticky lg:top-6">
        <GstResults
          :result="calculator.result.value"
          :final-amount-label="calculator.finalAmountLabel.value"
          :can-copy="calculator.canCopy.value"
          @copy="calculator.copyResult()"
        />
        <ToolHistory
          :entries="calculator.historyEntries.value"
          :copied-entry-id="copiedHistoryId"
          list-label="GST calculation history"
          clear-label="Clear GST history"
          empty-title="No calculations yet"
          empty-description="GST results you copy or commit appear here."
          reuse-title="Reuse these inputs"
          @reuse="calculator.reuseHistory"
          @copy="copyHistoryEntry"
          @remove="calculator.removeHistory"
          @clear="calculator.clearHistory"
        />
      </div>
    </div>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="gst-result-status">
      {{ calculator.resultAnnouncement.value }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" data-testid="gst-copy-status">
      {{ calculator.copyStatus.value }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Alert, Button, ErrorMessage, FormControl, Icon, TabButtons } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolHistory from '@/components/history/ToolHistory.vue'
import GstRatePicker from '@/tools/gst-calculator/GstRatePicker.vue'
import GstResults from '@/tools/gst-calculator/GstResults.vue'
import { GST_MODES, GST_SUPPLY_TYPES } from '@/tools/gst-calculator'
import { useGstCalculator } from '@/tools/gst-calculator/useGstCalculator'

const preferences = useToolboxPreferences()
const initialRate = new URLSearchParams(globalThis.location?.search ?? '').get('rate')
const calculator = useGstCalculator({ initialRate })
const copiedHistoryId = ref('')
const modeTabs = [
  { label: 'Add GST', value: GST_MODES.ADD },
  { label: 'Remove GST', value: GST_MODES.REMOVE },
]
const supplyTabs = [
  { label: 'Intra-state · CGST + SGST', value: GST_SUPPLY_TYPES.INTRA_STATE },
  { label: 'Inter-state · IGST', value: GST_SUPPLY_TYPES.INTER_STATE },
]

onMounted(() => preferences.recordRecent('gst-calculator'))

async function copyHistoryEntry(entry) {
  try {
    await globalThis.navigator?.clipboard?.writeText(entry.value)
    copiedHistoryId.value = entry.id
  } catch {
    copiedHistoryId.value = ''
  }
}
</script>
