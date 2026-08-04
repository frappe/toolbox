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
      <Button class="h-11" variant="subtle" icon="lucide-star" :label="preferences.isFavourite(TOOL_ID) ? 'Favourited' : 'Favourite'" @click="preferences.toggleFavourite(TOOL_ID)" />
    </header>

    <div class="mt-8 inline-flex gap-1 overflow-x-auto rounded-lg bg-surface-gray-2 p-1" role="tablist" aria-label="Business lookup type">
      <button v-for="tab in tabs" :id="`${tab.id}-tab`" :key="tab.id" type="button" role="tab" class="h-9 shrink-0 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3" :class="activeTab === tab.id ? 'bg-surface-base text-ink-gray-9 shadow-sm' : 'text-ink-gray-6 hover:text-ink-gray-9'" :aria-selected="activeTab === tab.id" :aria-controls="`${tab.id}-panel`" :tabindex="activeTab === tab.id ? 0 : -1" @click="selectTab(tab.id)" @keydown="handleTabKeydown($event, tab.id)">{{ tab.label }}</button>
    </div>

    <section :id="`${activeTab}-panel`" class="pt-8" role="tabpanel" :aria-labelledby="`${activeTab}-tab`">
      <BusinessDatasetPanel :key="activeTab" :dataset-type="activeTab" :label="activeDataset.label" :metadata="datasetStatus?.[activeTab]" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import BusinessDatasetPanel from '@/tools/india-business-lookup/BusinessDatasetPanel.vue'
import { fetchDatasetStatus } from '@/tools/india-business-lookup/api'

const TOOL_ID = 'india-business-lookup'
const tabs = [{ id: 'pin', label: 'PIN code' }, { id: 'ifsc', label: 'IFSC' }]
const preferences = useToolboxPreferences()
const activeTab = ref('pin')
const datasetStatus = ref(null)
const activeDataset = computed(() => tabs.find((tab) => tab.id === activeTab.value))

function selectTab(tabId) {
  activeTab.value = tabId
}

function handleTabKeydown(event, tabId) {
  const currentIndex = tabs.findIndex((tab) => tab.id === tabId)
  const targetIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? tabs.length - 1
      : event.key === 'ArrowRight'
        ? (currentIndex + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : null
  if (targetIndex === null) return

  event.preventDefault()
  selectTab(tabs[targetIndex].id)
  document.getElementById(`${tabs[targetIndex].id}-tab`)?.focus()
}

onMounted(async () => {
  preferences.recordRecent(TOOL_ID)
  try {
    datasetStatus.value = await fetchDatasetStatus()
  } catch {
    datasetStatus.value = null
  }
})
</script>
