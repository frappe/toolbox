<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader
      :icon="tool.icon"
      :category="categoryName"
      :title="tool.name"
      :description="tool.description"
    />

    <section class="pt-8">
      <BusinessDatasetPanel :key="variant" :dataset-type="variant" :label="datasetLabel" :metadata="datasetStatus?.[variant]" />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

import { useToolFamily } from '@/composables/useToolFamily'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import BusinessDatasetPanel from '@/tools/india-business-lookup/BusinessDatasetPanel.vue'
import { fetchDatasetStatus } from '@/tools/india-business-lookup/api'
import { getToolCategoryName } from '@/data/toolRegistry'

// The PIN and IFSC searches are two tools with two routes, rendered here together because they
// read one dataset-status response. Fetching it once keeps a move between them instant.
const DATASET_LABELS = { pin: 'PIN code', ifsc: 'IFSC' }

const preferences = useToolboxPreferences()
const { tool, variant } = useToolFamily()
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
