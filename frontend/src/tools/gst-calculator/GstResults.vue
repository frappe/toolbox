<template>
  <section
    class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-base p-5 sm:p-6"
    aria-labelledby="gst-results-heading"
  >
    <h2 id="gst-results-heading" class="text-base font-semibold text-ink-gray-9">Result</h2>

    <div v-if="result" class="pt-5">
      <p class="text-sm text-ink-gray-5">{{ finalAmountLabel }}</p>
      <output
        class="block break-words pt-1 text-3xl font-semibold tracking-tight text-ink-gray-9 sm:text-4xl"
        aria-label="GST final amount"
      >
        {{ formatInr(result.inclusiveAmount) }}
      </output>

      <dl class="divide-y divide-outline-gray-2 pt-6">
        <div v-for="row in resultRows" :key="row.label" class="flex items-center gap-4 py-3">
          <dt class="min-w-0 flex-1 text-sm text-ink-gray-6">{{ row.label }}</dt>
          <dd class="shrink-0 text-right text-sm font-medium tabular-nums text-ink-gray-9">
            {{ formatInr(row.value) }}
          </dd>
        </div>
      </dl>

    </div>

    <div v-else class="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center">
      <span class="flex size-10 items-center justify-center rounded-xl bg-surface-gray-2">
        <Icon name="lucide-receipt-indian-rupee" class="size-5 text-ink-gray-6" />
      </span>
      <p class="pt-4 text-sm font-medium text-ink-gray-8">Enter an amount to calculate GST</p>
      <p class="max-w-64 pt-2 text-sm leading-6 text-ink-gray-5">
        The tax split and final value will appear here immediately.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from 'frappe-ui'

import { formatInr } from './useGstCalculator'

const props = defineProps({
  result: { type: Object, default: null },
  finalAmountLabel: { type: String, required: true },
})


const resultRows = computed(() => {
  if (!props.result) return []
  return [
    { label: 'Taxable value', value: props.result.taxableValue },
    { label: 'CGST', value: props.result.cgst },
    { label: 'SGST', value: props.result.sgst },
    { label: 'IGST', value: props.result.igst },
    { label: 'Total GST', value: props.result.totalGst },
  ]
})
</script>
