<template>
  <fieldset>
    <legend class="text-sm font-medium text-ink-gray-7">GST rate</legend>
    <div class="grid grid-cols-4 gap-2 pt-2">
      <Button
        v-for="rate in STANDARD_GST_RATES"
        :key="rate.id"
        class="h-11 min-w-0"
        :label="rate.label"
        :variant="selectedRateId === rate.id ? 'solid' : 'outline'"
        :aria-pressed="selectedRateId === rate.id"
        :data-rate-id="rate.id"
        @click="$emit('select', rate.id)"
      />
      <Button
        class="h-11 min-w-0"
        label="Custom"
        :variant="selectedRateId === CUSTOM_RATE_ID ? 'solid' : 'outline'"
        :aria-pressed="selectedRateId === CUSTOM_RATE_ID"
        data-rate-id="custom"
        @click="$emit('select', CUSTOM_RATE_ID)"
      />
    </div>

    <div v-if="selectedRateId === CUSTOM_RATE_ID" class="pt-4">
      <label for="custom-gst-rate" class="block text-sm font-medium text-ink-gray-7">
        Custom rate
      </label>
      <div class="relative mt-2 max-w-48">
        <input
          id="custom-gst-rate"
          :value="customRateInput"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          class="h-11 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 pr-9 text-base text-ink-gray-9 outline-none focus:ring-2 focus:ring-outline-gray-3"
          placeholder="Example: 7.5"
          aria-describedby="gst-feedback"
          @input="$emit('update:customRateInput', $event.target.value)"
        />
        <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-gray-5">
          %
        </span>
      </div>
    </div>
  </fieldset>
</template>

<script setup>
import { Button } from 'frappe-ui'

import { STANDARD_GST_RATES } from './index'
import { CUSTOM_RATE_ID } from './useGstCalculator'

defineProps({
  selectedRateId: { type: String, required: true },
  customRateInput: { type: String, required: true },
})
defineEmits(['select', 'update:customRateInput'])
</script>
