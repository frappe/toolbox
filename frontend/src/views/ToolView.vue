<template>
  <div v-if="tool" class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
    <ToolPageHeader :icon="tool.icon" :title="tool.name" :description="tool.description">
      <template #title-suffix>
        <Badge v-if="!available" theme="gray" label="Dependency validation" />
      </template>
    </ToolPageHeader>

    <ToolState
      v-if="available"
      class="mt-10"
      status="empty"
      title="Implementation queued"
      message="This committed tool is ready for its focused implementation and acceptance tests."
    />

    <ToolState
      v-else
      class="mt-10"
      status="disabled"
      title="Not enabled yet"
      message="This tool stays disabled until its data source, license, reliability, and update process pass validation."
      detail-label="Dependency state"
      :detail-value="dependencyLabel"
    />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Badge } from 'frappe-ui'

import ToolPageHeader from '@/components/layout/ToolPageHeader.vue'
import ToolState from '@/components/states/ToolState.vue'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { isToolAvailable, toolsById } from '@/data/toolRegistry'

const route = useRoute()
const preferences = useToolboxPreferences()
const tool = computed(() => toolsById.get(route.meta.toolId))
const available = computed(() => tool.value && isToolAvailable(tool.value))
const dependencyLabel = computed(() => tool.value?.externalDependencyStatus.replaceAll('-', ' '))

watch(
  tool,
  (currentTool) => {
    // Don't record tools that aren't usable yet (disabled/validating) as "recent".
    if (currentTool && isToolAvailable(currentTool)) preferences.recordRecent(currentTool.id)
  },
  { immediate: true },
)
</script>
