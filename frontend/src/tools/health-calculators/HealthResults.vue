<template>
  <section class="min-w-0 rounded-2xl border border-outline-gray-2 bg-surface-base p-5 sm:p-6" aria-labelledby="health-results-heading">
    <h2 id="health-results-heading" class="text-base font-semibold text-ink-gray-9">Result</h2>
    <div v-if="presentation" class="pt-5">
      <p class="text-sm text-ink-gray-5">{{ presentation.primary.label }}</p>
      <output class="block break-words pt-1 text-3xl font-semibold tracking-tight text-ink-gray-9 sm:text-4xl" aria-label="Primary health result">{{ presentation.primary.value }}</output>
      <dl class="divide-y divide-outline-gray-2 pt-6">
        <div v-for="row in presentation.rows" :key="row.label" class="flex items-start gap-4 py-3">
          <dt class="min-w-0 flex-1 text-sm text-ink-gray-6">{{ row.label }}</dt>
          <dd class="max-w-[60%] shrink-0 text-right text-sm font-medium tabular-nums text-ink-gray-9">{{ row.value }}</dd>
        </div>
      </dl>
      <div class="grid gap-4 border-t border-outline-gray-2 py-5">
        <div><h3 class="text-sm font-medium text-ink-gray-8">Formula</h3><p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ presentation.formula }}</p></div>
        <div><h3 class="text-sm font-medium text-ink-gray-8">Assumption and limits</h3><p class="pt-1 text-sm leading-6 text-ink-gray-6">{{ presentation.assumption }}</p></div>
      </div>
    </div>
    <div v-else class="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center">
      <span class="flex size-10 items-center justify-center rounded-xl bg-surface-gray-2"><Icon name="lucide-activity" class="size-5 text-ink-gray-6" /></span>
      <p class="pt-4 text-sm font-medium text-ink-gray-8">Complete the inputs to calculate</p>
      <p class="max-w-64 pt-2 text-sm leading-6 text-ink-gray-5">The estimate, formula, and assumptions will appear here.</p>
    </div>
    <p class="border-t border-outline-gray-2 pt-5 text-sm leading-6 text-ink-gray-6">These results are general estimates and are not medical advice, diagnosis or treatment. Individual needs may vary.</p>
  </section>
</template>
<script setup>
import { Icon } from 'frappe-ui'
defineProps({ presentation: { type: Object, default: null } })
</script>
