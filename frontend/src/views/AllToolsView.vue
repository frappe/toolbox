<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
    <header>
      <p class="text-sm font-medium text-ink-gray-5">Browse</p>
      <h1 class="pt-2 text-3xl font-semibold tracking-tight text-ink-gray-9">All tools</h1>
      <p class="pt-2 text-base text-ink-gray-6">Find a tool by name, task, or category.</p>
    </header>

    <div class="sticky top-0 z-10 -mx-2 bg-surface-base px-2 pb-4 pt-6">
      <TextInput
        v-model="query"
        size="lg"
        variant="outline"
        placeholder="Search all tools"
        aria-label="Search all tools"
      >
        <template #prefix>
          <Icon name="lucide-search" class="size-4 text-ink-gray-5" />
        </template>
      </TextInput>
      <div class="flex gap-2 overflow-x-auto pt-3 pb-1" aria-label="Tool categories">
        <button
          v-for="category in categoryOptions"
          :key="category.id"
          type="button"
          class="h-8 shrink-0 rounded-full px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
          :class="selectedCategory === category.id ? 'bg-surface-gray-7 text-ink-white' : 'bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3'"
          :aria-pressed="selectedCategory === category.id"
          @click="selectedCategory = category.id"
        >
          {{ category.name }}
        </button>
      </div>
    </div>

    <div v-if="visibleTools.length" class="space-y-8">
      <section v-for="group in groupedTools" :key="group.category.id">
        <div class="flex h-8 items-center gap-2 px-2">
          <Icon :name="group.category.icon" class="size-4 text-ink-gray-5" />
          <h2 class="text-sm font-semibold text-ink-gray-8">{{ group.category.name }}</h2>
          <span class="text-sm text-ink-gray-4">{{ group.tools.length }}</span>
        </div>
        <ToolRow v-for="tool in group.tools" :key="tool.id" :tool="tool" />
      </section>
    </div>

    <div v-else class="py-16 text-center">
      <Icon name="lucide-search-x" class="mx-auto size-7 text-ink-gray-4" />
      <h2 class="pt-3 text-base font-medium text-ink-gray-8">No matching tools</h2>
      <p class="pt-1 text-sm text-ink-gray-5">Try another name or clear the category filter.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon, TextInput } from 'frappe-ui'

import ToolRow from '@/components/tools/ToolRow.vue'
import { toolCategories, tools } from '@/data/toolRegistry'
import { searchTools } from '@/utils/toolSearch'

const route = useRoute()
const router = useRouter()
const query = ref('')
const categoryOptions = [{ id: 'all', name: 'All' }, ...toolCategories]
const selectedCategory = ref(validCategory(route.query.category))

const visibleTools = computed(() => {
  const matches = searchTools(query.value, tools)
  if (selectedCategory.value === 'all') return matches
  return matches.filter((tool) => tool.category === selectedCategory.value)
})
const groupedTools = computed(() =>
  toolCategories
    .map((category) => ({
      category,
      tools: visibleTools.value.filter((tool) => tool.category === category.id),
    }))
    .filter((group) => group.tools.length),
)

watch(selectedCategory, (category) => {
  router.replace({ query: category === 'all' ? {} : { category } })
})
watch(
  () => route.query.category,
  (category) => (selectedCategory.value = validCategory(category)),
)

function validCategory(category) {
  return toolCategories.some((item) => item.id === category) ? category : 'all'
}
</script>
