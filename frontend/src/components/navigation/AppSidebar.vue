<template>
  <Sidebar v-model:collapsed="collapsed" :disable-collapse="disableCollapse" :width="width">
    <div class="flex h-full min-h-0 flex-col p-2">
      <AppBrandMenu v-if="showBrand" @navigate="$emit('navigate')" />

      <SidebarItem label="Search tools" icon="lucide-search" @click="$emit('search')">
        <template #suffix>
          <kbd class="mr-2 rounded border border-outline-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">
            ⌘K
          </kbd>
        </template>
      </SidebarItem>

      <!-- -mx/px: rows sit flush with the clip edge, so without this the active row's shadow ring
           is cut off at both sides. frappe-ui's own layout does the same. -->
      <nav class="-mx-1 mt-2 min-h-0 flex-1 overflow-y-auto px-1" aria-label="Toolbox navigation">
        <SidebarItem
          to="/all-tools"
          icon="lucide-layout-grid"
          label="All tools"
          @click="$emit('navigate')"
        >
          <!-- The count goes through the slot rather than the `suffix` prop, because that prop
               draws in `ink-gray-4`, which is 2.68:1 on this background and fails WCAG AA. -->
          <template #suffix>
            <span class="mr-2 text-sm tabular-nums text-ink-gray-5">{{ tools.length }}</span>
          </template>
        </SidebarItem>

        <ToolCategorySection
          v-for="category in categoryGroups"
          :key="category.id"
          :label="category.name"
          :count="category.tools.length"
          :open="isOpen(category.id)"
          @toggle="toggleCategory(category.id)"
        >
          <SidebarItem
            v-for="tool in category.tools"
            :key="tool.id"
            :to="tool.route"
            :icon="tool.icon"
            :label="tool.name"
            @click="$emit('navigate')"
          />
        </ToolCategorySection>
      </nav>

      <div class="mt-2 border-t border-outline-gray-2 pt-2">
        <!-- A new build is waiting: offer the refresh here rather than as a floating card. -->
        <SidebarItem v-if="pwa.updateReady.value" label="Update ready" @click="pwa.applyUpdate">
          <template #prefix>
            <Icon
              name="lucide-refresh-cw"
              class="size-4 text-ink-gray-6"
              :class="pwa.updateApplying.value ? 'animate-spin motion-reduce:animate-none' : ''"
            />
          </template>
          <template #suffix>
            <Icon name="lucide-arrow-right" class="mr-2 size-4 text-ink-gray-5" />
          </template>
        </SidebarItem>

        <!-- Mobile keeps Settings in the footer; on desktop it moves into the brand menu. -->
        <SidebarItem
          v-if="!showBrand"
          to="/settings"
          icon="lucide-settings-2"
          label="Settings"
          @click="$emit('navigate')"
        />

        <SidebarCollapseToggle v-if="!disableCollapse" />
      </div>
    </div>
  </Sidebar>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Icon, Sidebar, SidebarCollapseToggle, SidebarItem } from 'frappe-ui'

import { usePwaStatus } from '@/composables/usePwaStatus'
import { useToolboxPreferences } from '@/composables/useToolboxPreferences'
import { getToolsByCategory, toolCategories, tools, toolsById } from '@/data/toolRegistry'
import AppBrandMenu from './AppBrandMenu.vue'
import ToolCategorySection from './ToolCategorySection.vue'

defineProps({
  showBrand: { type: Boolean, default: true },
  // Pins the sidebar open and drops the toggle, for the copy inside the mobile sheet.
  disableCollapse: { type: Boolean, default: false },
  width: { type: String, default: undefined },
})

defineEmits(['navigate', 'search'])

// Left untyped on purpose. Sidebar reads an unset model as "decide for yourself", and a Boolean
// type here would turn that into `false` before Sidebar ever saw it.
const collapsed = defineModel('collapsed', { default: null })

const preferences = useToolboxPreferences()
const pwa = usePwaStatus()
const route = useRoute()
const categoryGroups = computed(() =>
  toolCategories
    .map((category) => ({
      ...category,
      tools: getToolsByCategory(category.id).filter((tool) => !preferences.isHidden(tool.id)),
    }))
    .filter((category) => category.tools.length),
)

// Two levels, and one of them open. Thirty-four tools listed at once is a scroll rather than a
// navigation, so a category opens when it holds the tool being used, and stays open after that.
// A visitor who wants everything at once has All Tools, which is what the first link goes to.
const openCategories = ref([])
const activeCategory = computed(() => toolsById.get(route.meta.toolId)?.category)

watch(
  activeCategory,
  (category) => {
    if (category && !openCategories.value.includes(category)) openCategories.value.push(category)
  },
  { immediate: true },
)

function isOpen(category) {
  return openCategories.value.includes(category)
}

function toggleCategory(category) {
  openCategories.value = isOpen(category)
    ? openCategories.value.filter((id) => id !== category)
    : [...openCategories.value, category]
}
</script>
