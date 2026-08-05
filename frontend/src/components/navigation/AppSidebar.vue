<template>
  <aside
    class="flex h-full shrink-0 flex-col bg-surface-gray-1 px-3 py-3 transition-[width] duration-200"
    :class="collapsed ? 'w-[76px]' : 'w-[272px]'"
  >
    <AppBrandMenu v-if="showBrand" :collapsed="collapsed" @navigate="$emit('navigate')" />

    <button
      type="button"
      class="mt-3 flex h-9 items-center rounded-lg border border-outline-gray-2 bg-surface-base text-sm text-ink-gray-5 shadow-sm transition-colors hover:border-outline-gray-3 hover:text-ink-gray-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
      :class="collapsed ? 'justify-center px-0' : 'px-2'"
      :aria-label="collapsed ? 'Search tools' : undefined"
      :title="collapsed ? 'Search tools' : undefined"
      @click="$emit('search')"
    >
      <span class="flex size-7 shrink-0 items-center justify-center">
        <Icon name="lucide-search" class="size-4" />
      </span>
      <template v-if="!collapsed">
        <span class="flex-1 text-left">Search tools</span>
        <kbd class="rounded border border-outline-gray-2 bg-surface-gray-1 px-1.5 py-0.5 text-xs">⌘K</kbd>
      </template>
    </button>

    <nav class="mt-4 min-h-0 flex-1 overflow-y-auto" aria-label="Toolbox navigation">
      <div class="space-y-0.5">
        <NavigationItem
          to="/all-tools"
          icon="lucide-layout-grid"
          label="All tools"
          :suffix="tools.length"
          :collapsed="collapsed"
          @navigate="$emit('navigate')"
        />
      </div>

      <SidebarSection
        v-for="category in categoryGroups"
        :key="category.id"
        :label="category.name"
        :collapsed="collapsed"
      >
        <NavigationItem
          v-for="tool in category.tools"
          :key="tool.id"
          :to="tool.route"
          :icon="tool.icon"
          :label="tool.name"
          :collapsed="collapsed"
          @navigate="$emit('navigate')"
        />
      </SidebarSection>

      <SidebarSection v-if="favourites.length" label="Favourites" :collapsed="collapsed">
        <NavigationItem
          v-for="tool in favourites"
          :key="tool.id"
          :to="tool.route"
          :icon="tool.icon"
          :label="tool.name"
          :collapsed="collapsed"
          @navigate="$emit('navigate')"
        />
      </SidebarSection>
    </nav>

    <div class="mt-2 border-t border-outline-gray-2 pt-2">
      <!-- A new build is waiting: offer the refresh here rather than as a floating card. -->
      <button
        v-if="pwa.updateReady.value"
        type="button"
        class="mb-1 flex h-9 w-full items-center rounded-lg bg-surface-gray-2 text-sm font-medium text-ink-gray-8 transition-colors hover:bg-surface-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        :class="collapsed ? 'justify-center px-0' : 'px-2'"
        :aria-label="collapsed ? 'Update ready — refresh Toolbox' : undefined"
        :title="collapsed ? 'Update ready' : undefined"
        @click="pwa.applyUpdate"
      >
        <span class="flex size-7 shrink-0 items-center justify-center">
          <Icon name="lucide-refresh-cw" class="size-4" :class="pwa.updateApplying.value ? 'animate-spin motion-reduce:animate-none' : ''" />
        </span>
        <template v-if="!collapsed">
          <span class="min-w-0 flex-1 truncate text-left">Update ready</span>
          <Icon name="lucide-arrow-right" class="size-4 shrink-0 text-ink-gray-5" />
        </template>
      </button>

      <!-- Mobile keeps Settings in the footer; on desktop it moves into the brand menu. -->
      <NavigationItem
        v-if="!showBrand"
        to="/settings"
        icon="lucide-settings-2"
        label="Settings"
        @navigate="$emit('navigate')"
      />
      <button
        v-if="collapsible"
        type="button"
        class="flex h-9 w-full items-center rounded-lg text-sm font-medium text-ink-gray-6 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        :class="collapsed ? 'justify-center px-0' : 'px-2'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-pressed="collapsed"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="$emit('toggle-collapse')"
      >
        <span class="flex size-7 shrink-0 items-center justify-center">
          <Icon
            :name="collapsed ? 'lucide-chevrons-right' : 'lucide-chevrons-left'"
            class="size-4"
          />
        </span>
        <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">Collapse</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { Icon } from 'frappe-ui'

import { usePwaStatus } from '@/composables/usePwaStatus'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getToolsByCategory, toolCategories, tools, toolsById } from '@/data/toolRegistry'
import AppBrandMenu from './AppBrandMenu.vue'
import NavigationItem from './NavigationItem.vue'
import SidebarSection from './SidebarSection.vue'

defineProps({
  showBrand: { type: Boolean, default: true },
  collapsible: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
})

defineEmits(['navigate', 'search', 'toggle-collapse'])

const preferences = useToolboxPreferences()
const pwa = usePwaStatus()
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
