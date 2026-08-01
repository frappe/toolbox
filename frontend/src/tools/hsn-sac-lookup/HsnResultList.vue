<template>
  <section aria-labelledby="hsn-results-heading">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-medium text-ink-gray-5">Results</p>
        <h2 id="hsn-results-heading" class="pt-1 text-lg font-semibold text-ink-gray-9">
          {{ resultHeading }}
        </h2>
      </div>
      <p v-if="query" class="text-sm tabular-nums text-ink-gray-5">{{ results.length }} shown</p>
    </div>

    <div v-if="!query" class="flex min-h-56 flex-col items-center justify-center text-center">
      <Icon name="lucide-search" class="size-6 text-ink-gray-5" />
      <p class="pt-4 text-sm font-medium text-ink-gray-8">Enter a code or description</p>
      <p class="max-w-sm pt-1 text-sm leading-6 text-ink-gray-5">
        Search exact codes, prefixes, phrases, words, or close spellings.
      </p>
    </div>

    <div v-else-if="!results.length" class="flex min-h-56 flex-col items-center justify-center text-center" role="status">
      <Icon name="lucide-search-x" class="size-6 text-ink-gray-5" />
      <p class="pt-4 text-sm font-medium text-ink-gray-8">No classifications found</p>
      <p class="pt-1 text-sm text-ink-gray-5">Try a shorter code or fewer description words.</p>
    </div>

    <ol v-else class="divide-y divide-outline-gray-2 pt-4">
      <li v-for="result in results" :key="result.code" class="flex gap-4 py-5 first:pt-0">
        <div class="w-24 shrink-0">
          <p class="font-mono text-base font-semibold text-ink-gray-9">{{ result.code }}</p>
          <p class="pt-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
            {{ result.code.startsWith('99') ? 'SAC' : 'HSN' }}
          </p>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-6 text-ink-gray-8">{{ result.description }}</p>
          <div class="flex flex-wrap items-center gap-3 pt-3">
            <RouterLink
              v-if="Number.isFinite(result.gstRate)"
              class="text-sm font-medium text-ink-gray-9 underline underline-offset-4"
              :to="`/gst-calculator?rate=${result.gstRate}`"
            >
              Use {{ result.gstRate }}% in GST Calculator
            </RouterLink>
            <span v-else class="text-xs leading-5 text-ink-gray-5">
              Statutory GST rate is not available in this source master.
            </span>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from 'frappe-ui'

const props = defineProps({
  query: { type: String, default: '' },
  results: { type: Array, required: true },
})

const resultHeading = computed(() => (props.query ? `Matches for “${props.query}”` : 'HSN and SAC classifications'))
</script>
