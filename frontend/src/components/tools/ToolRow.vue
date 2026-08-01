<template>
  <div class="group flex items-center rounded-xl px-2 transition-colors hover:bg-surface-gray-2">
    <RouterLink
      :to="tool.route"
      class="flex min-w-0 flex-1 items-center rounded-lg py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3 focus-visible:ring-offset-2"
    >
      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-gray-2">
        <Icon :name="tool.icon" class="size-5 text-ink-gray-7" />
      </span>
      <span class="min-w-0 flex-1 px-3">
        <span class="flex items-center gap-2">
          <span class="truncate text-sm font-medium text-ink-gray-9">{{ tool.name }}</span>
          <Badge v-if="!isToolAvailable(tool)" theme="gray" label="Validating" />
        </span>
        <span class="mt-0.5 block truncate text-sm text-ink-gray-5">{{ tool.description }}</span>
      </span>
    </RouterLink>
    <Button
      :variant="preferences.isFavourite(tool.id) ? 'subtle' : 'ghost'"
      :class="preferences.isFavourite(tool.id) ? 'ring-1 ring-outline-gray-3' : ''"
      icon="lucide-star"
      :aria-label="preferences.isFavourite(tool.id) ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`"
      :aria-pressed="preferences.isFavourite(tool.id)"
      @click="preferences.toggleFavourite(tool.id)"
    />
    <span class="flex size-8 shrink-0 items-center justify-center text-ink-gray-4">
      <Icon name="lucide-chevron-right" class="size-4" />
    </span>
  </div>
</template>

<script setup>
import { Badge, Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { isToolAvailable } from '@/data/toolRegistry'

defineProps({
  tool: { type: Object, required: true },
})

const preferences = useToolboxPreferences()
</script>
