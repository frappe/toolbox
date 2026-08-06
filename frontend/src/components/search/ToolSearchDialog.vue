<template>
  <Dialog v-model:open="open" bare size="lg" position="top">
    <div class="overflow-hidden rounded-xl bg-surface-elevation-1 shadow-xl">
      <div class="flex h-14 items-center border-b border-outline-gray-2 px-4">
        <Icon name="lucide-search" class="mr-3 size-5 shrink-0 text-ink-gray-5" />
        <input
          ref="input"
          v-model="query"
          type="search"
          class="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink-gray-9 outline-none placeholder:text-ink-gray-4"
          placeholder="Search calculators, converters, and lookups"
          aria-label="Search tools"
          autocomplete="off"
        />
        <kbd class="rounded border border-outline-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">Esc</kbd>
      </div>

      <div class="max-h-[min(520px,65vh)] overflow-y-auto p-2">
        <p v-if="!query" class="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
          All tools
        </p>
        <button
          v-for="tool in results"
          :key="tool.id"
          type="button"
          class="flex w-full items-center rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-gray-2 focus-visible:bg-surface-gray-2 focus-visible:outline-none"
          @click="selectTool(tool)"
        >
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-gray-2">
            <Icon :name="tool.icon" class="size-4 text-ink-gray-7" />
          </span>
          <span class="min-w-0 flex-1 px-3">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ tool.name }}</span>
            </span>
            <span class="mt-0.5 block truncate text-sm text-ink-gray-5">{{ tool.description }}</span>
          </span>
          <Icon name="lucide-arrow-up-right" class="size-4 shrink-0 text-ink-gray-4" />
        </button>

        <div v-if="query && !results.length" class="px-4 py-10 text-center">
          <Icon name="lucide-search-x" class="mx-auto size-6 text-ink-gray-4" />
          <p class="pt-3 text-sm font-medium text-ink-gray-8">No matching tools</p>
          <p class="pt-1 text-sm text-ink-gray-5">Try a unit, formula, or category name.</p>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog, Icon } from 'frappe-ui'

import { isToolAvailable, tools } from '@/data/toolRegistry'
import { searchTools } from '@/utils/toolSearch'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const router = useRouter()
const input = ref(null)
const query = ref('')

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const searchableTools = tools.filter(isToolAvailable)
// The tool set is small and bounded by the registry, so show every match rather than capping it.
const results = computed(() => searchTools(query.value, searchableTools))

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    input.value?.focus()
  } else {
    query.value = ''
  }
})

function selectTool(tool) {
  open.value = false
  router.push(tool.route)
}
</script>
