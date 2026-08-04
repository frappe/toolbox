<template>
  <RouterLink
    :to="to"
    class="group flex h-9 w-full items-center rounded-lg px-2 text-sm font-medium text-ink-gray-6 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
    active-class="bg-surface-white font-semibold text-ink-gray-9 shadow-sm ring-1 ring-outline-gray-2"
    @click="$emit('navigate')"
  >
    <span class="flex size-7 shrink-0 items-center justify-center">
      <Icon :name="icon" class="size-4" />
    </span>
    <span class="min-w-0 flex-1 truncate">{{ label }}</span>
    <span v-if="suffix" class="w-8 shrink-0 text-right text-xs text-ink-gray-5">
      {{ suffix }}
    </span>
  </RouterLink>
</template>

<script setup>
import { Icon } from 'frappe-ui'

defineProps({
  to: { type: [String, Object], required: true },
  icon: { type: String, required: true },
  label: { type: String, required: true },
  suffix: { type: [String, Number], default: '' },
})

defineEmits(['navigate'])
</script>
