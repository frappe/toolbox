<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      icon="lucide-percent"
      :category="categoryName"
      title="GST Calculator"
      description="Add or remove GST and see the intra-state or inter-state tax split."
    />

    <div class="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <section
        class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-gray-1 p-4 sm:p-5"
        aria-labelledby="gst-inputs-heading"
      >
        <h2 id="gst-inputs-heading" class="sr-only">GST calculation inputs</h2>

        <fieldset class="min-w-0">
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
            class="[&_input]:font-medium [&_input]:tabular-nums"
            :label="calculator.amountLabel.value"
            :model-value="calculator.amountInput.value"
            inputmode="decimal"
            placeholder="0.00"
            aria-describedby="gst-feedback"
            :aria-invalid="Boolean(calculator.errorMessage.value) || undefined"
            @update:model-value="calculator.updateAmount"
          >
            <template #prefix>
              <span class="text-base text-ink-gray-5">₹</span>
            </template>
          </FormControl>
        </div>

        <fieldset class="min-w-0 pt-4">
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

        <div id="gst-feedback" class="pt-3">
          <ErrorMessage v-if="calculator.errorMessage.value" :message="calculator.errorMessage.value" />
          <p v-else-if="calculator.inputHint.value" class="text-sm leading-6 text-ink-gray-5">
            {{ calculator.inputHint.value }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2 pt-4">
          <Button size="md" label="Clear" variant="subtle" @click="calculator.clear" />
        </div>
      </section>

      <div class="lg:sticky lg:top-6">
        <GstResults
          :result="calculator.result.value"
          :final-amount-label="calculator.finalAmountLabel.value"
        />
      </div>
    </div>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="gst-result-status">
      {{ calculator.resultAnnouncement.value }}
    </p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Alert, Button, ErrorMessage, FormControl, TabButtons } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import GstRatePicker from '@/tools/gst-calculator/GstRatePicker.vue'
import GstResults from '@/tools/gst-calculator/GstResults.vue'
import { GST_MODES, GST_SUPPLY_TYPES } from '@/tools/gst-calculator'
import { useGstCalculator } from '@/tools/gst-calculator/useGstCalculator'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('gst-calculator')
const preferences = useToolboxPreferences()
const initialRate = new URLSearchParams(globalThis.location?.search ?? '').get('rate')
const calculator = useGstCalculator({ initialRate })
const modeTabs = [
  { label: 'Add GST', value: GST_MODES.ADD },
  { label: 'Remove GST', value: GST_MODES.REMOVE },
]
const supplyTabs = [
  { label: 'Intra-state · CGST + SGST', value: GST_SUPPLY_TYPES.INTRA_STATE },
  { label: 'Inter-state · IGST', value: GST_SUPPLY_TYPES.INTER_STATE },
]

onMounted(() => preferences.recordRecent('gst-calculator'))
</script>
