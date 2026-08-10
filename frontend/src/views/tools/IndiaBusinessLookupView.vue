<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon :name="tool.icon" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-ink-gray-5">{{ categoryName }}</p>
        <h1 class="pt-1 text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">{{ tool.name }}</h1>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">{{ tool.description }}</p>
      </div>
    </header>

    <div class="mt-8 overflow-x-auto">
      <ToolFamilyNav label="Business lookup type" :links="siblingLinks" :current-route="currentRoute" />
    </div>

    <section class="pt-8">
      <BusinessDatasetPanel :key="variant" :dataset-type="variant" :label="datasetLabel" :metadata="datasetStatus?.[variant]" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from 'frappe-ui'

import ToolFamilyNav from '@/components/ToolFamilyNav.vue'
import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import BusinessDatasetPanel from '@/tools/india-business-lookup/BusinessDatasetPanel.vue'
import { fetchDatasetStatus } from '@/tools/india-business-lookup/api'
import { getToolCategoryName } from '@/data/toolRegistry'

// The PIN and IFSC searches are two tools with two routes, rendered here together because they
// read one dataset-status response. Fetching it once keeps a move between them instant.
const DATASET_LABELS = { pin: 'PIN code', ifsc: 'IFSC' }

const preferences = useToolboxPreferences()
const { tool, variant, siblingLinks, currentRoute } = useToolFamily()
const categoryName = computed(() => getToolCategoryName(tool.value?.id))
const datasetStatus = ref(null)
const datasetLabel = computed(() => DATASET_LABELS[variant.value])

// A move between the two does not remount this view, because it is the same component on a
// different route, so recording the recent tool has to follow the route rather than the mount.
watch(() => tool.value?.id, (toolId) => toolId && preferences.recordRecent(toolId), { immediate: true })

onMounted(async () => {
  try {
    datasetStatus.value = await fetchDatasetStatus()
  } catch {
    datasetStatus.value = null
  }
})
</script>
