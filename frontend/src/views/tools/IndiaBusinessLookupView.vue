<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon name="lucide-building-2" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">India</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">India Business Lookup</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">Search Indian PIN codes and bank IFSC codes.</p>
      </div>
    </header>

    <div class="mt-8 overflow-x-auto">
      <TabButtons v-model="activeTab" :options="tabs" size="md" aria-label="Business lookup type" />
    </div>

    <section class="pt-8">
      <BusinessDatasetPanel :key="activeTab" :dataset-type="activeTab" :label="activeDataset.label" :metadata="datasetStatus?.[activeTab]" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon, TabButtons } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import BusinessDatasetPanel from '@/tools/india-business-lookup/BusinessDatasetPanel.vue'
import { fetchDatasetStatus } from '@/tools/india-business-lookup/api'

const TOOL_ID = 'india-business-lookup'
const tabs = [{ value: 'pin', label: 'PIN code' }, { value: 'ifsc', label: 'IFSC' }]
const preferences = useToolboxPreferences()
const activeTab = ref('pin')
const datasetStatus = ref(null)
const activeDataset = computed(() => tabs.find((tab) => tab.value === activeTab.value))

onMounted(async () => {
  preferences.recordRecent(TOOL_ID)
  try {
    datasetStatus.value = await fetchDatasetStatus()
  } catch {
    datasetStatus.value = null
  }
})
</script>
