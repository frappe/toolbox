<template>
  <div v-if="tool" class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header class="flex items-start gap-4">
      <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-gray-2">
        <Icon :name="tool.icon" class="size-6 text-ink-gray-7" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold tracking-tight text-ink-gray-9 sm:text-3xl">{{ tool.name }}</h1>
          <Badge v-if="!available" theme="gray" label="Dependency validation" />
        </div>
        <p class="pt-2 text-base leading-7 text-ink-gray-6">{{ tool.description }}</p>
      </div>
      <Button
        variant="subtle"
        icon="lucide-star"
        :label="preferences.isFavourite(tool.id) ? 'Favourited' : 'Favourite'"
        @click="preferences.toggleFavourite(tool.id)"
      />
    </header>

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
import { Badge, Button, Icon } from 'frappe-ui'

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
    if (currentTool) preferences.recordRecent(currentTool.id)
  },
  { immediate: true },
)
</script>
