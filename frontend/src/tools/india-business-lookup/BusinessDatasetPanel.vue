<template>
  <div v-if="!metadata" class="rounded-xl bg-surface-gray-1 px-5 py-8">
    <Icon name="lucide-database" class="size-6 text-ink-gray-5" />
    <h2 class="pt-4 text-lg font-semibold text-ink-gray-9">{{ label }} dataset is not available yet</h2>
    <p class="max-w-xl pt-2 text-sm leading-6 text-ink-gray-6">The dataset import, validation, and safe replacement process is queued. Toolbox will not search an incomplete or unverified dataset.</p>
  </div>

  <div v-else>
    <form class="flex flex-col gap-3 sm:flex-row" role="search" @submit.prevent="submit">
      <label class="min-w-0 flex-1 text-sm font-medium text-ink-gray-7">{{ searchLabel }}
        <input v-model="query" class="mt-2 h-12 w-full rounded-lg border border-outline-gray-2 bg-surface-base px-3 text-base text-ink-gray-9" type="search" minlength="2" maxlength="80" required :placeholder="placeholder" />
      </label>
      <Button class="h-12 self-end sm:w-28" variant="solid" label="Search" :loading="loading" type="submit" />
    </form>

    <p v-if="errorMessage" class="mt-4 rounded-lg bg-surface-red-1 px-3 py-2 text-sm text-ink-red-3" role="alert">{{ errorMessage }}</p>
    <div v-else-if="searched && !results.length" class="mt-6 rounded-xl bg-surface-gray-1 px-5 py-6 text-sm text-ink-gray-6">No matching {{ label }} records were found.</div>
    <ol v-else-if="results.length" class="divide-y divide-outline-gray-2 pt-6" aria-label="Search results">
      <li v-for="result in results" :key="resultKey(result)" class="py-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2"><h2 class="font-semibold text-ink-gray-9">{{ resultTitle(result) }}</h2><span class="font-mono text-sm font-medium text-ink-gray-8">{{ resultCode(result) }}</span></div>
        <p class="pt-1 text-sm text-ink-gray-6">{{ resultLocation(result) }}</p>
        <p v-if="result.address" class="pt-2 text-sm leading-6 text-ink-gray-5">{{ result.address }}</p>
      </li>
    </ol>

    <div class="mt-8 border-t border-outline-gray-2 pt-5 text-xs leading-5 text-ink-gray-5">
      <p>Source: <a class="font-medium underline underline-offset-2" :href="metadata.source.url" target="_blank" rel="noreferrer">{{ metadata.source.name }}</a> · {{ metadata.source.license }}</p>
      <p class="pt-1">Source updated {{ formatDate(metadata.sourceUpdatedAt) }} · {{ metadata.recordCount.toLocaleString('en-IN') }} validated records<span v-if="metadata.exclusionCount"> · {{ metadata.exclusionCount.toLocaleString('en-IN') }} excluded</span></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { searchBusinessDataset } from './api'

const props = defineProps({
  datasetType: { type: String, required: true },
  label: { type: String, required: true },
  metadata: { type: Object, default: null },
})
const query = ref('')
const results = ref([])
const loading = ref(false)
const searched = ref(false)
const errorMessage = ref('')
const searchLabel = props.datasetType === 'pin' ? 'PIN code, office, district, or state' : 'IFSC, bank, branch, city, or state'
const placeholder = props.datasetType === 'pin' ? '560001 or Bengaluru' : 'HDFC0000001 or Mumbai'

async function submit() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await searchBusinessDataset(props.datasetType, query.value)
    results.value = response.results ?? []
    searched.value = true
  } catch {
    errorMessage.value = `The ${props.label} search is unavailable. Try again.`
  } finally {
    loading.value = false
  }
}

function resultKey(result) { return result.pin_code ? `${result.pin_code}:${result.office_name}` : result.ifsc_code }
function resultCode(result) { return result.pin_code || result.ifsc_code }
function resultTitle(result) { return result.office_name || `${result.bank_name} — ${result.branch}` }
function resultLocation(result) { return [result.city, result.district, result.state].filter(Boolean).join(', ') }
function formatDate(value) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) }
</script>
