<template>
  <aside class="flex h-full w-[272px] shrink-0 flex-col bg-surface-gray-1 px-3 py-3">
    <div v-if="showBrand" class="flex h-10 items-center gap-2 px-2">
      <img :src="logoUrl" alt="" class="size-7 rounded-lg" />
      <span class="text-base font-semibold text-ink-gray-9">Toolbox</span>
      <Button
        v-if="showClose"
        class="ml-auto"
        variant="ghost"
        icon="lucide-x"
        aria-label="Close navigation"
        @click="$emit('close')"
      />
    </div>

    <button
      type="button"
      class="flex h-9 items-center rounded-lg border border-outline-gray-2 bg-surface-white px-2 text-sm text-ink-gray-5 shadow-sm transition-colors hover:border-outline-gray-3 hover:text-ink-gray-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      :class="showBrand ? 'mt-3' : ''"
      @click="$emit('search')"
    >
      <span class="flex size-7 shrink-0 items-center justify-center">
        <Icon name="lucide-search" class="size-4" />
      </span>
      <span class="flex-1 text-left">Search tools</span>
      <kbd class="rounded border border-outline-gray-2 bg-surface-gray-1 px-1.5 py-0.5 text-xs">⌘K</kbd>
    </button>

    <nav class="mt-4 min-h-0 flex-1 overflow-y-auto" aria-label="Toolbox navigation">
      <div class="space-y-0.5">
        <NavigationItem to="/" icon="lucide-house" label="Home" @navigate="$emit('navigate')" />
        <NavigationItem
          to="/all-tools"
          icon="lucide-layout-grid"
          label="All tools"
          :suffix="tools.length"
          @navigate="$emit('navigate')"
        />
      </div>

      <SidebarSection
        v-for="category in categoryGroups"
        :key="category.id"
        :label="category.name"
      >
        <NavigationItem
          v-for="tool in category.tools"
          :key="tool.id"
          :to="tool.route"
          :icon="tool.icon"
          :label="tool.name"
          @navigate="$emit('navigate')"
        />
      </SidebarSection>

      <SidebarSection v-if="favourites.length" label="Favourites">
        <NavigationItem
          v-for="tool in favourites"
          :key="tool.id"
          :to="tool.route"
          :icon="tool.icon"
          :label="tool.name"
          @navigate="$emit('navigate')"
        />
      </SidebarSection>

    </nav>

    <div class="border-t border-outline-gray-2 pt-2">
      <NavigationItem
        to="/settings"
        icon="lucide-settings-2"
        label="Settings"
        @navigate="$emit('navigate')"
      />
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Icon } from 'frappe-ui'

import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getToolsByCategory, toolCategories, tools, toolsById } from '@/data/toolRegistry'
import NavigationItem from './NavigationItem.vue'
import SidebarSection from './SidebarSection.vue'

defineProps({
  showClose: { type: Boolean, default: false },
  showBrand: { type: Boolean, default: true },
})

defineEmits(['close', 'navigate', 'search'])

const preferences = useToolboxPreferences()
const logoUrl = '/assets/toolbox/toolbox-logo.svg'
const categoryGroups = computed(() =>
  toolCategories
    .map((category) => ({
      ...category,
      tools: getToolsByCategory(category.id).filter((tool) => !preferences.isHidden(tool.id)),
    }))
    .filter((category) => category.tools.length),
)
const favourites = computed(() =>
  resolveTools(preferences.favouriteIds.value).filter((tool) => !preferences.isHidden(tool.id)),
)

function resolveTools(ids) {
  return ids.map((id) => toolsById.get(id)).filter(Boolean)
}
</script>
