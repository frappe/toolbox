<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-search" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">HSN &amp; SAC Lookup</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Search Indian HSN (goods) and SAC (services) codes and descriptions.</p>
      </div>
    </header>

    <div v-if="!hsn.available.value" class="mt-8 rounded-xl bg-surface-gray-1 px-5 py-8">
      <Icon name="lucide-database" class="size-6 text-ink-gray-5" />
      <h2 class="pt-4 text-lg font-semibold text-ink-gray-9">HSN and SAC dataset is not available yet</h2>
      <p class="max-w-xl pt-2 text-sm leading-6 text-ink-gray-6">The dataset import, validation, and safe replacement process is queued. Toolbox will not search an incomplete or unverified dataset.</p>
    </div>

    <div v-else class="pt-8">
      <form class="flex flex-col gap-3 sm:flex-row" role="search" @submit.prevent="hsn.submit">
        <FormControl class="min-w-0 flex-1 [&_input]:h-12" type="search" size="lg" variant="outline" label="Code or description" minlength="2" maxlength="80" required placeholder="8517 or telephone" :model-value="hsn.query.value" @update:model-value="hsn.query.value = $event" />
        <Button class="h-12 self-end sm:w-28" variant="solid" label="Search" :loading="hsn.loading.value" type="submit" />
      </form>

      <Alert v-if="hsn.errorMessage.value" class="mt-4" theme="red" :dismissible="false" :title="hsn.errorMessage.value" />
      <div v-else-if="hsn.searched.value && !hsn.results.value.length" class="mt-6 rounded-xl bg-surface-gray-1 px-5 py-6 text-sm text-ink-gray-6">No matching HSN or SAC codes were found.</div>
      <ol v-else-if="hsn.results.value.length" class="divide-y divide-outline-gray-2 pt-6" aria-label="Search results">
        <li v-for="result in hsn.results.value" :key="result.code" class="py-4">
          <div class="flex items-center gap-3">
            <span class="font-mono text-sm font-semibold text-ink-gray-9">{{ result.code }}</span>
            <Badge theme="gray" variant="subtle" size="sm" :label="result.code_type" />
          </div>
          <p class="pt-1.5 text-sm leading-6 text-ink-gray-7">{{ result.description }}</p>
        </li>
      </ol>

      <div class="mt-8 border-t border-outline-gray-2 pt-5 text-xs leading-5 text-ink-gray-5">
        <p v-if="hsn.source.value"><a class="font-medium underline underline-offset-2" :href="hsn.source.value.url" target="_blank" rel="noreferrer">{{ hsn.source.value.attribution }}</a></p>
        <p class="pt-1">Source updated {{ formatDate(hsn.sourceUpdatedAt.value) }} · {{ hsn.recordCount.value.toLocaleString('en-IN') }} codes</p>
        <p class="pt-1">Codes and descriptions only. GST rates depend on notifications and effective dates; confirm the current rate with an official source.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Alert, Badge, Button, FormControl, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { useHsnLookup } from '@/tools/hsn-sac-lookup/useHsnLookup'
import { getToolCategoryName } from '@/data/toolRegistry'

const categoryName = getToolCategoryName('hsn-sac-lookup')
const TOOL_ID = 'hsn-sac-lookup'
const preferences = useToolboxPreferences()
const hsn = useHsnLookup()

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—'
}

onMounted(() => {
  preferences.recordRecent(TOOL_ID)
  hsn.loadStatus()
})
</script>
