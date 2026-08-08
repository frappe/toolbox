<template>
  <fieldset>
    <legend class="text-sm font-medium text-ink-gray-7">GST rate</legend>
    <div class="overflow-x-auto pt-2">
      <TabButtons
        :model-value="selectedRateId"
        :options="rateTabs"
        size="md"
        aria-label="GST rate"
        @update:model-value="$emit('select', $event)"
      />
    </div>

    <div v-if="selectedRateId === CUSTOM_RATE_ID" class="max-w-48 pt-4">
      <FormControl
        id="custom-gst-rate"
        type="text"
        size="md"
        variant="outline"
        label="Custom rate"
        inputmode="decimal"
        placeholder="Example: 7.5"
        aria-describedby="gst-feedback"
        :model-value="customRateInput"
        @update:model-value="$emit('update:customRateInput', $event)"
      >
        <template #suffix>
          <span class="text-sm text-ink-gray-5">%</span>
        </template>
      </FormControl>
    </div>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'
import { FormControl, TabButtons } from 'frappe-ui'

import { STANDARD_GST_RATES } from './index'
import { CUSTOM_RATE_ID } from './useGstCalculator'

defineProps({
  selectedRateId: { type: String, required: true },
  customRateInput: { type: String, required: true },
})
defineEmits(['select', 'update:customRateInput'])

const rateTabs = computed(() => [
  ...STANDARD_GST_RATES.map((rate) => ({ label: rate.label, value: rate.id })),
  { label: 'Custom', value: CUSTOM_RATE_ID },
])
</script>
